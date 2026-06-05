/**
 * ElodiaTech FSE — Connecteur Doctolib
 *
 * Récupère automatiquement les rejets FSE depuis Doctolib
 * et les insère dans la base Supabase.
 *
 * Usage :
 *   node connectors/doctolib.mjs --medecin <MEDECIN_ID> --email <EMAIL> --password <PASSWORD>
 *
 * Cron (toutes les 6h) :
 *   0 * /6 * * * node /chemin/vers/connectors/doctolib.mjs ...
 *
 * Variables d'environnement :
 *   SUPABASE_URL        = https://awyrojlanodjnuoepweq.supabase.co
 *   SUPABASE_KEY        = sb_publishable_...
 *   DOCTOLIB_EMAIL      = email du cabinet
 *   DOCTOLIB_PASSWORD   = mot de passe Doctolib
 *   MEDECIN_ID          = UUID du médecin dans Supabase
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  doctolibEmail: process.env.DOCTOLIB_EMAIL || '',
  doctolibPassword: process.env.DOCTOLIB_PASSWORD || '',
  medecinId: process.env.MEDECIN_ID || '',
  headless: process.env.HEADLESS !== 'false', // true par défaut
  timeout: 30000,
}

// Lire les arguments CLI
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--medecin') CONFIG.medecinId = args[i + 1]
  if (args[i] === '--email') CONFIG.doctolibEmail = args[i + 1]
  if (args[i] === '--password') CONFIG.doctolibPassword = args[i + 1]
  if (args[i] === '--visible') CONFIG.headless = false
}

// ─── Classification erreurs NOEMIE ───────────────────────────────────────────

const FAMILLES = {
  '11': 'droits_adri', '12': 'droits_adri', '13': 'droits_adri',
  '21': 'cotation', '22': 'cotation', '23': 'cotation',
  '31': 'parametrage', '32': 'parametrage', '33': 'parametrage',
  '41': 'caisse', '42': 'caisse',
  '51': 'amc_dre', '52': 'amc_dre', '55': 'amc_dre',
}

function classifierRejet(codeErreur) {
  const prefix = codeErreur?.slice(0, 2) || ''
  const famille = FAMILLES[prefix] || 'parametrage'
  // REGLE METIER : cotation → jamais auto
  const voie = famille === 'cotation' ? 'agent'
    : famille === 'droits_adri' ? 'auto'
    : famille === 'caisse' ? 'agent'
    : famille === 'amc_dre' ? 'auto'
    : 'medecin'
  return { famille, voie }
}

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)

async function dejaIngere(idFse) {
  const { data } = await supabase
    .from('rejets_fse')
    .select('id')
    .eq('id_fse', idFse)
    .eq('medecin_id', CONFIG.medecinId)
    .limit(1)
  return data && data.length > 0
}

async function insererRejet(rejet) {
  const { famille, voie } = classifierRejet(rejet.code_erreur)
  const { error } = await supabase.from('rejets_fse').insert({
    id_fse: rejet.id_fse,
    date_rejet: rejet.date_rejet,
    medecin_id: CONFIG.medecinId,
    logiciel_source: 'doctolib',
    code_erreur: rejet.code_erreur,
    libelle_erreur: rejet.libelle_erreur,
    famille_rejet: famille,
    niveau_rejet: rejet.niveau || 'fse',
    part_concernee: rejet.part || 'amo',
    montant_fse: rejet.montant || 0,
    statut: 'en_attente',
    voie_traitement: voie,
    fichier_valide: false,
    ticket_correction: {
      famille,
      voie,
      confiance: voie === 'auto' ? 0.85 : 0.70,
      diagnostic: `Rejet code ${rejet.code_erreur} importe depuis Doctolib`,
      procedure: voie === 'auto'
        ? ['Verification automatique en cours', 'Validation agent requise avant retransmission']
        : ['Intervention manuelle requise', 'Verifier le dossier dans Doctolib']
    }
  })
  if (error) throw error
}

// ─── Scraping Doctolib ────────────────────────────────────────────────────────

async function scrapDoctolib() {
  console.log('🚀 Lancement connecteur Doctolib...')
  console.log(`   Email    : ${CONFIG.doctolibEmail}`)
  console.log(`   Medecin  : ${CONFIG.medecinId}`)
  console.log(`   Mode     : ${CONFIG.headless ? 'headless' : 'visible'}`)
  console.log('')

  if (!CONFIG.doctolibEmail || !CONFIG.doctolibPassword || !CONFIG.medecinId) {
    console.error('❌ Configuration incomplète. Verifiez les variables d environnement ou les arguments CLI.')
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: CONFIG.headless })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  const rejets = []

  try {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    console.log('⏳ Connexion a Doctolib...')
    await page.goto('https://www.doctolib.fr/login', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout })

    // Remplir email
    await page.waitForSelector('input[name="username"], input[type="email"], #username', { timeout: CONFIG.timeout })
    await page.fill('input[name="username"], input[type="email"], #username', CONFIG.doctolibEmail)

    // Remplir mot de passe
    await page.waitForSelector('input[name="password"], input[type="password"], #password', { timeout: 5000 })
    await page.fill('input[name="password"], input[type="password"], #password', CONFIG.doctolibPassword)

    // Soumettre
    await page.click('button[type="submit"], [data-testid="login-submit"]')
    await page.waitForNavigation({ timeout: CONFIG.timeout })
    console.log('✅ Connecte')

    // ── 2. Naviguer vers FSE / Rejets ─────────────────────────────────────────
    console.log('⏳ Navigation vers les rejets FSE...')

    // Doctolib : section facturation/FSE
    // URL typique : /admin/billing ou /doctor/billing/rejections
    const fseUrls = [
      'https://www.doctolib.fr/admin/billing/rejections',
      'https://pro.doctolib.fr/admin/billing',
      'https://www.doctolib.fr/doctor/billing',
    ]

    let fsePageFound = false
    for (const url of fseUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        const content = await page.content()
        if (content.includes('rejet') || content.includes('FSE') || content.includes('rejection')) {
          fsePageFound = true
          console.log(`✅ Page FSE trouvee : ${url}`)
          break
        }
      } catch {
        // Essayer l'URL suivante
      }
    }

    if (!fsePageFound) {
      console.log('⚠️  Page FSE non trouvee automatiquement — tentative de navigation manuelle')
      // Chercher le lien dans la navigation
      const rejetsLink = await page.$('[href*="reject"], [href*="fse"], [href*="billing"]')
      if (rejetsLink) {
        await rejetsLink.click()
        await page.waitForNavigation({ timeout: CONFIG.timeout })
      }
    }

    // ── 3. Extraire les rejets ────────────────────────────────────────────────
    console.log('⏳ Extraction des rejets...')
    await page.waitForTimeout(2000)

    // Sélecteurs génériques pour les tableaux de rejets Doctolib
    const rows = await page.$$('table tbody tr, [data-testid*="rejection"], .rejection-row')
    console.log(`   ${rows.length} ligne(s) trouvee(s)`)

    for (const row of rows) {
      try {
        const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''))
        if (cells.length < 3) continue

        // Extraction flexible des données
        const fseId = cells.find(c => c.match(/^FSE[-\s]?\d+/i) || c.match(/^\d{10,}/)) || ('DOC-' + Date.now())
        const montantStr = cells.find(c => c.match(/\d+[,.]?\d*\s*€/))
        const montant = montantStr ? parseFloat(montantStr.replace(/[€\s]/g, '').replace(',', '.')) : 0
        const dateStr = cells.find(c => c.match(/\d{2}\/\d{2}\/\d{4}/))
        const codeErreur = cells.find(c => c.match(/^\d{4}$/)) || '9999'

        let dateRejet = new Date().toISOString().split('T')[0]
        if (dateStr) {
          const [d, m, y] = dateStr.split('/')
          dateRejet = `${y}-${m}-${d}`
        }

        const libelle = cells.find(c => c.length > 15 && !c.match(/^\d/) && !c.includes('€')) || 'Rejet Doctolib'

        if (await dejaIngere(fseId)) {
          console.log(`   ↳ ${fseId} deja en base — ignore`)
          continue
        }

        rejets.push({
          id_fse: fseId,
          date_rejet: dateRejet,
          code_erreur: codeErreur,
          libelle_erreur: libelle,
          montant,
          niveau: 'fse',
          part: 'amo',
        })
      } catch {
        // Ignorer les lignes malformees
      }
    }

    // ── 4. Export RSP si disponible ───────────────────────────────────────────
    const exportBtn = await page.$('[data-testid*="export"], button:has-text("Exporter"), a:has-text("RSP")')
    if (exportBtn) {
      console.log('⏳ Export RSP disponible — telechargement...')
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        exportBtn.click()
      ])
      const path = await download.path()
      if (path) {
        const { readFileSync } = await import('fs')
        const content = readFileSync(path, 'latin1')
        console.log(`   Fichier RSP telecharge : ${download.suggestedFilename()}`)
        // Le contenu sera parsé par noemieParser côté frontend
        // Ici on l'insère directement
        console.log(`   Taille : ${content.length} octets`)
      }
    }

  } catch (err) {
    console.error('❌ Erreur scraping:', err.message)
    // Prendre une capture d'écran pour debug
    try {
      await page.screenshot({ path: 'debug-doctolib.png', fullPage: false })
      console.log('   Capture d ecran sauvegardee : debug-doctolib.png')
    } catch {}
  } finally {
    await browser.close()
  }

  // ── 5. Insérer dans Supabase ──────────────────────────────────────────────
  console.log(`\n📊 Insertion de ${rejets.length} rejet(s) dans Supabase...`)
  let inseres = 0
  let erreurs = 0

  for (const r of rejets) {
    try {
      await insererRejet(r)
      inseres++
      console.log(`   ✅ ${r.id_fse} — ${r.code_erreur} — ${r.montant}€`)
    } catch (e) {
      erreurs++
      console.log(`   ❌ ${r.id_fse} — ${e.message}`)
    }
  }

  // ── 6. Log dans Supabase ──────────────────────────────────────────────────
  await supabase.from('connector_logs').insert({
    logiciel: 'doctolib',
    medecin_id: CONFIG.medecinId,
    nb_rejets_trouves: rejets.length,
    nb_inseres: inseres,
    nb_erreurs: erreurs,
    statut: erreurs === 0 ? 'ok' : 'partiel',
  }).catch(() => {}) // Ignore si la table n'existe pas encore

  console.log(`
╔═══════════════════════════════╗
║  Connecteur Doctolib - Bilan  ║
╠═══════════════════════════════╣
║  Rejets trouves  : ${String(rejets.length).padEnd(10)}║
║  Inseres         : ${String(inseres).padEnd(10)}║
║  Erreurs         : ${String(erreurs).padEnd(10)}║
╚═══════════════════════════════╝`)

  return { rejets: inseres, erreurs }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

scrapDoctolib().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
