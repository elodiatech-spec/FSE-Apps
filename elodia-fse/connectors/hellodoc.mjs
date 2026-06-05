/**
 * ElodiaTech FSE — Connecteur HelloDoc
 *
 * HelloDoc est un logiciel local. Ce connecteur utilise AnyDesk pour :
 *   1. Se connecter au poste cabinet à distance
 *   2. Copier les fichiers .rsp depuis le dossier HelloDoc
 *   3. Les parser et insérer dans Supabase
 *
 * Prérequis :
 *   - AnyDesk installé sur le poste cabinet
 *   - AnyDesk CLI disponible sur votre machine (anydesk --version)
 *   - Accès non supervisé configuré (mot de passe AnyDesk cabinet)
 *
 * Usage :
 *   ANYDESK_ID="123456789" ANYDESK_PASSWORD="pwd" MEDECIN_ID="uuid" node connectors/hellodoc.mjs
 *
 * Méthode alternative (sans AnyDesk) :
 *   Le médecin envoie manuellement le .rsp → upload via la page Ingestion RSP
 */

import { createClient } from '@supabase/supabase-js'
import { execSync, exec } from 'child_process'
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  supabaseKey: process.env.SUPABASE_KEY || '',
  medecinId: process.env.MEDECIN_ID || '',
  anyDeskId: process.env.ANYDESK_ID || '',
  anyDeskPassword: process.env.ANYDESK_PASSWORD || '',
  // Chemin typique des fichiers RSP HelloDoc sur le poste cabinet
  hellodocRspPath: process.env.HELLODOC_RSP_PATH || 'C:\\HelloDoc\\RSP',
  // Dossier local où copier les fichiers RSP récupérés
  localRspDir: process.env.LOCAL_RSP_DIR || './tmp/rsp',
}

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--medecin') CONFIG.medecinId = args[i + 1]
  if (args[i] === '--anydesk-id') CONFIG.anyDeskId = args[i + 1]
  if (args[i] === '--anydesk-pwd') CONFIG.anyDeskPassword = args[i + 1]
  if (args[i] === '--rsp-path') CONFIG.hellodocRspPath = args[i + 1]
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)

// ─── Parser RSP simplifié (même logique que noemieParser.ts) ─────────────────

const FAMILLES_MAP = {
  '1': { famille: 'droits_adri', voie: 'auto' },
  '2': { famille: 'cotation', voie: 'agent' },
  '3': { famille: 'parametrage', voie: 'medecin' },
  '4': { famille: 'caisse', voie: 'agent' },
  '5': { famille: 'amc_dre', voie: 'auto' },
}

function parseRspContent(content, filename) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const rejets = []
  let currentFSE = ''
  let currentMontant = 0
  let currentDate = new Date().toISOString().split('T')[0]

  for (const line of lines) {
    if (line.length < 2) continue
    const code = line.slice(0, 2)
    const data = line.slice(2).trim()

    if (code === '11') {
      currentFSE = data.slice(0, 13).trim() || ('HD-' + Date.now())
      const dateRaw = data.slice(13, 21).trim()
      if (dateRaw.length === 8) {
        currentDate = `${dateRaw.slice(4, 8)}-${dateRaw.slice(2, 4)}-${dateRaw.slice(0, 2)}`
      }
      currentMontant = parseFloat(data.slice(21, 34).trim()) / 100 || 0
    }

    if (['51', '52', '54'].includes(code)) {
      const codeErreur = data.slice(0, 6).trim() || data.slice(0, 4).trim()
      if (!codeErreur) continue
      const prefix = codeErreur[0]
      const { famille, voie } = FAMILLES_MAP[prefix] || { famille: 'parametrage', voie: 'medecin' }
      rejets.push({
        id_fse: currentFSE,
        code_erreur: codeErreur,
        famille,
        voie,
        montant: currentMontant,
        date: currentDate,
        niveau: code === '51' ? 'lot' : code === '52' ? 'fse' : 'acte',
      })
    }
  }
  return rejets
}

// ─── Récupération via AnyDesk (méthode robuste) ───────────────────────────────

async function recupViaAnyDesk() {
  console.log('🔌 Connexion AnyDesk...')

  // Vérifier que AnyDesk CLI est disponible
  try {
    execSync('anydesk --version', { stdio: 'ignore' })
  } catch {
    console.error('❌ AnyDesk CLI non trouvé. Installez AnyDesk : https://anydesk.com')
    console.log('\n💡 Alternative : le médecin peut envoyer le .rsp manuellement')
    console.log('   → Upload via http://localhost:3000/ingestion')
    return []
  }

  if (!existsSync(CONFIG.localRspDir)) mkdirSync(CONFIG.localRspDir, { recursive: true })

  // Connexion AnyDesk et copie des fichiers RSP
  // AnyDesk CLI : anydesk --with-password <ID> --start --silent
  console.log(`   ID AnyDesk cabinet : ${CONFIG.anyDeskId}`)

  try {
    // Commande AnyDesk pour copier les fichiers RSP
    const cmd = `anydesk --with-password "${CONFIG.anyDeskPassword}" ${CONFIG.anyDeskId} --download "${CONFIG.hellodocRspPath}\\*.rsp" --to "${CONFIG.localRspDir}"`
    await execAsync(cmd, { timeout: 60000 })
    console.log('✅ Fichiers RSP recuperes via AnyDesk')
  } catch (e) {
    console.error('❌ Erreur AnyDesk:', e.message)
    console.log('\n💡 Assurez-vous que :')
    console.log('   1. AnyDesk est installe et connecte sur le poste cabinet')
    console.log('   2. L acces non supervise est configure')
    console.log('   3. Le mot de passe AnyDesk est correct')
    return []
  }

  // Parser les fichiers RSP récupérés
  const rspFiles = existsSync(CONFIG.localRspDir)
    ? readdirSync(CONFIG.localRspDir).filter(f => f.toLowerCase().endsWith('.rsp'))
    : []

  console.log(`   ${rspFiles.length} fichier(s) .rsp trouve(s)`)
  const allRejets = []

  for (const file of rspFiles) {
    const content = readFileSync(join(CONFIG.localRspDir, file), 'latin1')
    const rejets = parseRspContent(content, file)
    console.log(`   ${file} : ${rejets.length} rejet(s)`)
    allRejets.push(...rejets)
  }

  return allRejets
}

// ─── Méthode de fallback : dossier local ─────────────────────────────────────

async function recupLocale() {
  const localPath = process.env.LOCAL_RSP_PATH
  if (!localPath || !existsSync(localPath)) return []

  console.log(`📂 Lecture dossier local : ${localPath}`)
  const files = readdirSync(localPath).filter(f => f.toLowerCase().endsWith('.rsp'))
  const allRejets = []

  for (const file of files) {
    const content = readFileSync(join(localPath, file), 'latin1')
    const rejets = parseRspContent(content, file)
    allRejets.push(...rejets)
  }
  return allRejets
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Connecteur HelloDoc...')
  if (!CONFIG.medecinId) { console.error('❌ MEDECIN_ID requis'); process.exit(1) }

  // Tenter AnyDesk, sinon local
  let rejets = await recupViaAnyDesk()
  if (!rejets.length) rejets = await recupLocale()
  if (!rejets.length) {
    console.log('\n⚠️  Aucun rejet recupere automatiquement.')
    console.log('   Methode manuelle : demander au medecin de copier les .rsp sur une cle USB')
    console.log('   puis les uploader via http://localhost:3000/ingestion')
    return
  }

  // Insertion Supabase
  console.log(`\n📊 Insertion de ${rejets.length} rejet(s)...`)
  let inseres = 0

  for (const r of rejets) {
    const { error } = await supabase.from('rejets_fse').insert({
      id_fse: r.id_fse,
      date_rejet: r.date,
      medecin_id: CONFIG.medecinId,
      logiciel_source: 'hellodoc',
      code_erreur: r.code_erreur,
      libelle_erreur: `Rejet ${r.code_erreur} HelloDoc`,
      famille_rejet: r.famille,
      niveau_rejet: r.niveau,
      part_concernee: 'amo',
      montant_fse: r.montant,
      statut: 'en_attente',
      voie_traitement: r.voie,
      fichier_valide: false,
      ticket_correction: {
        famille: r.famille, voie: r.voie, confiance: 0.80,
        diagnostic: `Rejet code ${r.code_erreur} depuis HelloDoc`,
        procedure: r.voie === 'auto'
          ? ['Verification automatique', 'Validation agent requise']
          : ['Verification manuelle dans HelloDoc requise']
      }
    })
    if (!error) { inseres++; console.log(`  ✅ ${r.id_fse}`) }
  }

  console.log(`\n✅ ${inseres}/${rejets.length} rejet(s) insere(s)`)
}

main().catch(e => { console.error(e); process.exit(1) })
