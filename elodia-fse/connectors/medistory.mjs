/**
 * ElodiaTech FSE — Connecteur Medistory
 *
 * Usage :
 *   MEDISTORY_EMAIL="email" MEDISTORY_PASSWORD="pwd" MEDECIN_ID="uuid" node connectors/medistory.mjs
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  email: process.env.MEDISTORY_EMAIL || '',
  password: process.env.MEDISTORY_PASSWORD || '',
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

const FAMILLES = {
  '1': 'droits_adri', '2': 'cotation', '3': 'parametrage', '4': 'caisse', '5': 'amc_dre'
}

function classifier(code) {
  const f = FAMILLES[code?.[0]] || 'parametrage'
  const v = f === 'cotation' ? 'agent' : f === 'droits_adri' ? 'auto' : f === 'caisse' ? 'agent' : f === 'amc_dre' ? 'auto' : 'medecin'
  return { famille: f, voie: v }
}

async function dejaIngere(idFse) {
  const { data } = await supabase.from('rejets_fse').select('id').eq('id_fse', idFse).eq('medecin_id', CONFIG.medecinId).limit(1)
  return data?.length > 0
}

async function main() {
  console.log('🚀 Connecteur Medistory...')
  if (!CONFIG.email || !CONFIG.medecinId) { console.error('❌ Config manquante'); process.exit(1) }

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const rejets = []

  try {
    // Login Medistory
    console.log('⏳ Connexion Medistory...')
    await page.goto('https://app.medistory.fr/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
    await page.fill('input[type="email"], input[name="email"]', CONFIG.email)
    await page.fill('input[type="password"]', CONFIG.password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 20000 })
    console.log('✅ Connecte')

    // Navigation vers FSE/Rejets
    console.log('⏳ Navigation rejets FSE...')
    const urls = [
      'https://app.medistory.fr/facturation/rejets',
      'https://app.medistory.fr/fse/rejets',
      'https://app.medistory.fr/billing/rejections',
    ]
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const c = await page.content()
        if (c.includes('rejet') || c.includes('FSE')) { console.log('✅ Page rejets:', url); break }
      } catch { /* continuer */ }
    }

    await page.waitForTimeout(2000)

    // Extraction
    const rows = await page.$$('table tbody tr, [class*="rejection"], [class*="rejet"]')
    console.log(`   ${rows.length} lignes trouvees`)

    for (const row of rows) {
      try {
        const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''))
        if (cells.length < 3) continue

        const fseId = cells.find(c => c.match(/\d{8,}/)) || ('MDS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6))
        const code = cells.find(c => c.match(/^\d{4}$/)) || '9999'
        const montantStr = cells.find(c => c.match(/\d+[,.]?\d*\s*€/))
        const montant = montantStr ? parseFloat(montantStr.replace(/[€\s]/g, '').replace(',', '.')) : 0
        const dateStr = cells.find(c => c.match(/\d{2}\/\d{2}\/\d{4}/))
        let dateRejet = new Date().toISOString().split('T')[0]
        if (dateStr) { const [d, m, y] = dateStr.split('/'); dateRejet = `${y}-${m}-${d}` }

        if (await dejaIngere(fseId)) continue

        const { famille, voie } = classifier(code)
        const libelle = cells.find(c => c.length > 10 && !c.match(/^\d/) && !c.includes('€')) || 'Rejet Medistory'

        const { error } = await supabase.from('rejets_fse').insert({
          id_fse: fseId, date_rejet: dateRejet, medecin_id: CONFIG.medecinId,
          logiciel_source: 'medistory', code_erreur: code, libelle_erreur: libelle,
          famille_rejet: famille, niveau_rejet: 'fse', part_concernee: 'amo',
          montant_fse: montant, statut: 'en_attente', voie_traitement: voie, fichier_valide: false,
          ticket_correction: { famille, voie, confiance: 0.75, diagnostic: `Rejet ${code} depuis Medistory`, procedure: ['Verifier le dossier dans Medistory'] }
        })
        if (!error) { rejets.push(fseId); console.log(`  ✅ ${fseId}`) }
      } catch { /* ignorer */ }
    }

  } catch (e) {
    console.error('❌', e.message)
    await page.screenshot({ path: 'debug-medistory.png' }).catch(() => {})
  } finally {
    await browser.close()
  }

  console.log(`\n✅ ${rejets.length} rejet(s) insere(s)`)
}

main().catch(e => { console.error(e); process.exit(1) })
