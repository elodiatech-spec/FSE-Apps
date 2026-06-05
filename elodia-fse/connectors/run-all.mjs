/**
 * ElodiaTech FSE — Lanceur centralisé de tous les connecteurs
 *
 * Lance les connecteurs pour tous les médecins actifs depuis Supabase.
 * Chaque connecteur tourne séquentiellement par médecin.
 *
 * Usage :
 *   node connectors/run-all.mjs
 *
 * Cron recommandé (toutes les 6h) :
 *   0 6,12,18,0 * * * cd /path/to/elodia-fse && node connectors/run-all.mjs >> logs/connectors.log 2>&1
 */

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
  process.env.SUPABASE_KEY || ''
)

const CONNECTOR_MAP = {
  doctolib: 'doctolib.mjs',
  medistory: 'medistory.mjs',
  maiia: 'maiia.mjs',
  axisante: 'axisante.mjs',
  hellodoc: 'hellodoc.mjs',
  docteursante: 'docteursante.mjs',
}

const CREDS_MAP = {
  doctolib: { email: 'DOCTOLIB_EMAIL', password: 'DOCTOLIB_PASSWORD' },
  medistory: { email: 'MEDISTORY_EMAIL', password: 'MEDISTORY_PASSWORD' },
  maiia: { email: 'MAIIA_EMAIL', password: 'MAIIA_PASSWORD' },
  axisante: { email: 'AXISANTE_EMAIL', password: 'AXISANTE_PASSWORD' },
  hellodoc: { id: 'ANYDESK_ID', password: 'ANYDESK_PASSWORD' },
  docteursante: { email: 'DS_EMAIL', password: 'DS_PASSWORD' },
}

function runConnector(script, env) {
  return new Promise((resolve) => {
    const proc = spawn('node', [join(__dirname, script)], {
      env: { ...process.env, ...env },
      stdio: 'inherit'
    })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

async function main() {
  console.log('\n' + '═'.repeat(50))
  console.log(' ElodiaTech FSE — Ingestion automatique')
  console.log(' ' + new Date().toLocaleString('fr-FR'))
  console.log('═'.repeat(50) + '\n')

  // Récupérer tous les médecins actifs
  const { data: medecins } = await supabase
    .from('medecins')
    .select('id, nom_cabinet, logiciel, email')
    .eq('actif', true)

  if (!medecins?.length) {
    console.log('⚠️  Aucun médecin actif trouvé en base')
    return
  }

  console.log(`📋 ${medecins.length} médecin(s) actif(s)\n`)

  let totalOk = 0
  let totalErr = 0

  for (const med of medecins) {
    const script = CONNECTOR_MAP[med.logiciel]
    if (!script) {
      console.log(`⏭️  ${med.nom_cabinet} — logiciel ${med.logiciel} non supporté`)
      continue
    }

    console.log(`\n▶  ${med.nom_cabinet} (${med.logiciel})`)

    const creds = CREDS_MAP[med.logiciel]
    const env = {
      MEDECIN_ID: med.id,
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co',
      SUPABASE_KEY: process.env.SUPABASE_KEY || '',
    }

    // Ajouter les credentials depuis les variables d'env
    if (creds.email && process.env[creds.email]) env[creds.email] = process.env[creds.email]
    if (creds.password && process.env[creds.password]) env[creds.password] = process.env[creds.password]

    const ok = await runConnector(script, env)
    if (ok) totalOk++
    else totalErr++
  }

  // Enregistrer le bilan
  await supabase.from('connector_logs').insert({
    logiciel: 'run-all',
    nb_inseres: totalOk,
    nb_erreurs: totalErr,
    statut: totalErr === 0 ? 'ok' : 'partiel',
  }).catch(() => {})

  console.log('\n' + '═'.repeat(50))
  console.log(` Bilan : ${totalOk} OK / ${totalErr} erreur(s)`)
  console.log('═'.repeat(50) + '\n')
}

main().catch(e => { console.error(e); process.exit(1) })
