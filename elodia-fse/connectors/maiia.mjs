/**
 * ElodiaTech FSE — Connecteur Maiia (Cegedim)
 *
 * Usage :
 *   MAIIA_EMAIL="email" MAIIA_PASSWORD="pwd" MEDECIN_ID="uuid" node connectors/maiia.mjs
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  email: process.env.MAIIA_EMAIL || '',
  password: process.env.MAIIA_PASSWORD || '',
  medecinId: process.env.MEDECIN_ID || '',
  headless: process.env.HEADLESS !== 'false',
}

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--email') CONFIG.email = args[i + 1]
  if (args[i] === '--password') CONFIG.password = args[i + 1]
  if (args[i] === '--medecin') CONFIG.medecinId = args[i + 1]
  if (args[i] === '--visible') CONFIG.headless = false
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)

function classifier(code) {
  const f = { '1': 'droits_adri', '2': 'cotation', '3': 'parametrage', '4': 'caisse', '5': 'amc_dre' }[code?.[0]] || 'parametrage'
  const v = f === 'cotation' ? 'agent' : f === 'droits_adri' ? 'auto' : f === 'caisse' ? 'agent' : f === 'amc_dre' ? 'auto' : 'medecin'
  return { famille: f, voie: v }
}

async function main() {
  console.log('🚀 Connecteur Maiia (Cegedim)...')
  if (!CONFIG.email || !CONFIG.medecinId) { console.error('❌ Config manquante'); process.exit(1) }

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  let inseres = 0

  try {
    // Login Maiia
    console.log('⏳ Connexion Maiia...')
    await page.goto('https://pro.maiia.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 15000 })
    await page.fill('input[name="email"], input[type="email"]', CONFIG.email)
    await page.fill('input[type="password"]', CONFIG.password)
    await page.click('button[type="submit"], [data-cy="login-btn"]')
    await page.waitForNavigation({ timeout: 20000 })
    console.log('✅ Connecte')

    // Navigation FSE
    const urls = [
      'https://pro.maiia.com/facturation/rejets',
      'https://pro.maiia.com/telemedecine/fse',
      'https://pro.maiia.com/billing',
    ]
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const c = await page.content()
        if (c.includes('rejet') || c.includes('FSE') || c.includes('rejection')) break
      } catch { /* continuer */ }
    }

    await page.waitForTimeout(2000)

    // Tenter export CSV si disponible (plus fiable que le scraping)
    const exportBtn = await page.$('[data-cy*="export"], button:has-text("Exporter"), a[href*="csv"]')
    if (exportBtn) {
      console.log('📥 Export CSV disponible...')
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        exportBtn.click()
      ])
      const path = await dl.path()
      if (path) {
        const { readFileSync } = await import('fs')
        const csv = readFileSync(path, 'utf8')
        const lines = csv.split('\n').filter(Boolean)
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = lines[0].toLowerCase().split(sep)
        const codeIdx = headers.findIndex(h => h.includes('code'))
        const montantIdx = headers.findIndex(h => h.includes('montant'))
        const dateIdx = headers.findIndex(h => h.includes('date'))
        const fseIdx = headers.findIndex(h => h.includes('fse') || h.includes('id'))

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''))
          const code = cells[codeIdx] || '9999'
          const { famille, voie } = classifier(code)
          const montant = parseFloat((cells[montantIdx] || '0').replace(',', '.')) || 0
          const fseId = cells[fseIdx] || `MAI-${i}-${Date.now()}`
          const dateRaw = cells[dateIdx] || ''
          let dateRejet = new Date().toISOString().split('T')[0]
          if (dateRaw.match(/\d{2}\/\d{2}\/\d{4}/)) {
            const [d, m, y] = dateRaw.split('/')
            dateRejet = `${y}-${m}-${d}`
          }

          const { error } = await supabase.from('rejets_fse').insert({
            id_fse: fseId, date_rejet: dateRejet, medecin_id: CONFIG.medecinId,
            logiciel_source: 'maiia', code_erreur: code, libelle_erreur: `Rejet ${code} Maiia`,
            famille_rejet: famille, niveau_rejet: 'fse', part_concernee: 'amo',
            montant_fse: montant, statut: 'en_attente', voie_traitement: voie, fichier_valide: false,
            ticket_correction: { famille, voie, confiance: 0.75, diagnostic: `Import Maiia CSV`, procedure: ['Verifier dans Maiia'] }
          })
          if (!error) inseres++
        }
      }
    } else {
      // Scraping tableau
      const rows = await page.$$('table tbody tr')
      for (const row of rows) {
        try {
          const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''))
          if (cells.length < 2) continue
          const code = cells.find(c => c.match(/^\d{4}$/)) || '9999'
          const montantStr = cells.find(c => c.match(/\d+[,.]?\d*\s*€/))
          const montant = montantStr ? parseFloat(montantStr.replace(/[€\s]/g, '').replace(',', '.')) : 0
          const { famille, voie } = classifier(code)
          const { error } = await supabase.from('rejets_fse').insert({
            id_fse: 'MAI-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            date_rejet: new Date().toISOString().split('T')[0],
            medecin_id: CONFIG.medecinId, logiciel_source: 'maiia',
            code_erreur: code, libelle_erreur: `Rejet ${code}`,
            famille_rejet: famille, niveau_rejet: 'fse', part_concernee: 'amo',
            montant_fse: montant, statut: 'en_attente', voie_traitement: voie, fichier_valide: false,
            ticket_correction: { famille, voie, confiance: 0.70, diagnostic: `Import Maiia`, procedure: ['Verifier dans Maiia'] }
          })
          if (!error) inseres++
        } catch { /* ignorer */ }
      }
    }

  } catch (e) {
    console.error('❌', e.message)
    await page.screenshot({ path: 'debug-maiia.png' }).catch(() => {})
  } finally {
    await browser.close()
  }

  console.log(`✅ ${inseres} rejet(s) insere(s) depuis Maiia`)
}

main().catch(e => { console.error(e); process.exit(1) })
