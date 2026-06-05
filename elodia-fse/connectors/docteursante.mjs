/**
 * ElodiaTech FSE — Connecteur Docteur Santé
 *
 * Usage :
 *   DS_EMAIL="email" DS_PASSWORD="pwd" MEDECIN_ID="uuid" node connectors/docteursante.mjs
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  email: process.env.DS_EMAIL || '',
  password: process.env.DS_PASSWORD || '',
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
  console.log('🚀 Connecteur Docteur Sante...')
  if (!CONFIG.medecinId) { console.error('❌ MEDECIN_ID requis'); process.exit(1) }

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  let inseres = 0

  try {
    console.log('⏳ Connexion Docteur Sante...')
    await page.goto('https://www.docteursante.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('input[type="email"], input[name="login"]', { timeout: 15000 })
    await page.fill('input[type="email"], input[name="login"]', CONFIG.email)
    await page.fill('input[type="password"]', CONFIG.password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 20000 })
    console.log('✅ Connecte')

    const urls = [
      'https://www.docteursante.com/fse/rejets',
      'https://www.docteursante.com/facturation',
      'https://pro.docteursante.com/billing',
    ]
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const c = await page.content()
        if (c.includes('rejet') || c.includes('FSE')) break
      } catch { /* continuer */ }
    }

    await page.waitForTimeout(2000)

    const rows = await page.$$('table tbody tr, [class*="rejection"], .rejet-row')
    console.log(`   ${rows.length} lignes`)

    for (const row of rows) {
      try {
        const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''))
        if (cells.length < 2) continue
        const code = cells.find(c => c.match(/^\d{4}$/)) || '9999'
        const montantStr = cells.find(c => c.match(/\d+[,.]?\d*\s*€/))
        const montant = montantStr ? parseFloat(montantStr.replace(/[€\s]/g, '').replace(',', '.')) : 0
        const { famille, voie } = classifier(code)
        const { error } = await supabase.from('rejets_fse').insert({
          id_fse: 'DS-' + Date.now() + '-' + inseres,
          date_rejet: new Date().toISOString().split('T')[0],
          medecin_id: CONFIG.medecinId,
          logiciel_source: 'docteursante',
          code_erreur: code,
          libelle_erreur: `Rejet ${code} Docteur Sante`,
          famille_rejet: famille,
          niveau_rejet: 'fse',
          part_concernee: 'amo',
          montant_fse: montant,
          statut: 'en_attente',
          voie_traitement: voie,
          fichier_valide: false,
          ticket_correction: { famille, voie, confiance: 0.70, diagnostic: `Import Docteur Sante`, procedure: ['Verifier dans Docteur Sante'] }
        })
        if (!error) inseres++
      } catch { /* ignorer */ }
    }

  } catch (e) {
    console.error('❌', e.message)
    await page.screenshot({ path: 'debug-docteursante.png' }).catch(() => {})
  } finally {
    await browser.close()
  }

  console.log(`✅ ${inseres} rejet(s) insere(s)`)
}

main().catch(e => { console.error(e); process.exit(1) })
