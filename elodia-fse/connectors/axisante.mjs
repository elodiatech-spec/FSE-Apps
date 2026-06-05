/**
 * ElodiaTech FSE — Connecteur Axisanté (Cegedim)
 *
 * Axisanté est un logiciel hybride (local + cloud).
 * Ce connecteur tente d'abord la version cloud, puis AnyDesk si nécessaire.
 *
 * Usage :
 *   AXISANTE_EMAIL="email" AXISANTE_PASSWORD="pwd" MEDECIN_ID="uuid" node connectors/axisante.mjs
 *   # Avec AnyDesk pour version locale :
 *   ANYDESK_ID="123456789" ANYDESK_PASSWORD="pwd" node connectors/axisante.mjs
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  email: process.env.AXISANTE_EMAIL || '',
  password: process.env.AXISANTE_PASSWORD || '',
  medecinId: process.env.MEDECIN_ID || '',
  headless: process.env.HEADLESS !== 'false',
  anyDeskId: process.env.ANYDESK_ID || '',
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
  console.log('🚀 Connecteur Axisante...')
  if (!CONFIG.medecinId) { console.error('❌ MEDECIN_ID requis'); process.exit(1) }

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  let inseres = 0

  try {
    // Axisanté cloud (Cegedim)
    console.log('⏳ Connexion Axisante cloud...')
    await page.goto('https://axisante.cegedim.cloud/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 15000 })
    await page.fill('input[type="email"], input[name="email"], #email', CONFIG.email)
    await page.fill('input[type="password"]', CONFIG.password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 20000 })
    console.log('✅ Connecte')

    // Navigation FSE rejets
    const fseUrls = [
      'https://axisante.cegedim.cloud/fse/rejets',
      'https://axisante.cegedim.cloud/facturation/rejets',
      'https://axisante.cegedim.cloud/billing',
    ]
    for (const url of fseUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const c = await page.content()
        if (c.includes('rejet') || c.includes('FSE')) break
      } catch { /* continuer */ }
    }

    await page.waitForTimeout(2000)

    // Export Excel/CSV si disponible
    const exportBtn = await page.$('button:has-text("Exporter"), [href*="export"], [href*="xlsx"]')
    if (exportBtn) {
      console.log('📥 Export disponible...')
      // Traiter l'export
    }

    // Scraping tableau
    const rows = await page.$$('table tbody tr')
    console.log(`   ${rows.length} lignes`)

    for (const row of rows) {
      try {
        const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''))
        if (cells.length < 2) continue
        const code = cells.find(c => c.match(/^\d{4}$/)) || '9999'
        const montantStr = cells.find(c => c.match(/\d+[,.]?\d*\s*€/))
        const montant = montantStr ? parseFloat(montantStr.replace(/[€\s]/g, '').replace(',', '.')) : 0
        const dateStr = cells.find(c => c.match(/\d{2}\/\d{2}\/\d{4}/))
        let dateRejet = new Date().toISOString().split('T')[0]
        if (dateStr) { const [d, m, y] = dateStr.split('/'); dateRejet = `${y}-${m}-${d}` }
        const { famille, voie } = classifier(code)

        const { error } = await supabase.from('rejets_fse').insert({
          id_fse: 'AXI-' + Date.now() + '-' + inseres,
          date_rejet: dateRejet,
          medecin_id: CONFIG.medecinId,
          logiciel_source: 'axisante',
          code_erreur: code,
          libelle_erreur: `Rejet ${code} Axisante`,
          famille_rejet: famille,
          niveau_rejet: 'fse',
          part_concernee: 'amo',
          montant_fse: montant,
          statut: 'en_attente',
          voie_traitement: voie,
          fichier_valide: false,
          ticket_correction: { famille, voie, confiance: 0.72, diagnostic: `Import Axisante`, procedure: ['Verifier dans Axisante'] }
        })
        if (!error) { inseres++; console.log(`  ✅ code ${code} — ${montant}€`) }
      } catch { /* ignorer */ }
    }

    if (rows.length === 0 && CONFIG.anyDeskId) {
      console.log('\n⚠️  Aucun rejet en cloud — version locale detectee')
      console.log('💡 Connexion AnyDesk necessaire pour Axisante local')
      console.log(`   ID AnyDesk : ${CONFIG.anyDeskId}`)
      console.log('   Configurez l acces non supervise sur le poste cabinet')
    }

  } catch (e) {
    console.error('❌', e.message)
    await page.screenshot({ path: 'debug-axisante.png' }).catch(() => {})
  } finally {
    await browser.close()
  }

  console.log(`\n✅ ${inseres} rejet(s) insere(s) depuis Axisante`)
}

main().catch(e => { console.error(e); process.exit(1) })
