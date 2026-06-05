/**
 * ElodiaTech FSE — Relances automatiques File C
 *
 * Vérifie tous les rejets en escalade médecin et envoie des emails
 * de relance si le médecin n'a pas répondu après 3 et 7 jours.
 *
 * Usage :
 *   node connectors/relances.mjs
 *
 * Cron recommandé (tous les jours à 8h) :
 *   0 8 * * * cd /path/to/elodia-fse && node connectors/relances.mjs >> logs/relances.log 2>&1
 *
 * Variables d'environnement :
 *   SUPABASE_URL    = https://awyrojlanodjnuoepweq.supabase.co
 *   SUPABASE_KEY    = service_role key
 *   RESEND_API_KEY  = re_...
 *   FROM_EMAIL      = ElodiaTech FSE <noreply@elodiatech.com>
 *   APP_URL         = https://votre-domaine.com
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://awyrojlanodjnuoepweq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || ''
const FROM_EMAIL = process.env.FROM_EMAIL || 'ElodiaTech FSE <noreply@elodiatech.com>'
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:3000'

// Délais de relance en jours
const RELANCE_J3 = 3
const RELANCE_J7 = 7
const RELANCE_J14 = 14 // Dernière relance avant clôture

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Calcul du délai ──────────────────────────────────────────────────────────

function joursDepuis(dateStr) {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ─── Template email relance ───────────────────────────────────────────────────

function emailRelance(medecin, rejets, joursEcoules, nbRelance) {
  const portalUrl = `${APP_URL}/medecin/${medecin.id}`
  const urgence = nbRelance >= 3 ? 'URGENT — ' : ''
  const montantTotal = rejets.reduce((s, r) => s + (r.montant_fse || 0), 0)

  const listeRejets = rejets.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px">${r.id_fse}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px">${r.code_erreur}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px">${r.montant_fse?.toFixed(2) || '0.00'} €</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#ef4444">${joursEcoules}j sans réponse</td>
    </tr>`).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9">
<div style="max-width:580px;margin:0 auto;padding:24px 16px">
  <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0D1B2A;padding:24px 32px">
      <p style="color:white;font-size:18px;font-weight:700;margin:0">ElodiaTech</p>
      <p style="color:#00C4CC;font-size:11px;margin:2px 0 0">FSE Manager</p>
    </div>
    <div style="padding:32px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:24px">
        <p style="color:#991b1b;font-weight:600;margin:0 0 4px;font-size:14px">
          ${urgence}Relance n°${nbRelance} — ${joursEcoules} jours sans réponse
        </p>
        <p style="color:#dc2626;font-size:13px;margin:0">
          Votre intervention est requise sur ${rejets.length} rejet(s) FSE.
          Montant total concerné : <strong>${montantTotal.toFixed(2)} €</strong>
        </p>
      </div>

      <p style="color:#475569;font-size:14px;margin:0 0 16px">
        Bonjour,<br><br>
        Malgré notre précédent message, nous n'avons pas reçu votre intervention sur les rejets suivants.
        Ces dossiers ne peuvent être traités sans votre action directe.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#0D1B2A">
            <th style="color:white;text-align:left;padding:8px 12px;font-size:12px">N° FSE</th>
            <th style="color:white;text-align:left;padding:8px 12px;font-size:12px">Code</th>
            <th style="color:white;text-align:left;padding:8px 12px;font-size:12px">Montant</th>
            <th style="color:white;text-align:left;padding:8px 12px;font-size:12px">Délai</th>
          </tr>
        </thead>
        <tbody>${listeRejets}</tbody>
      </table>

      <a href="${portalUrl}" style="display:inline-block;background:#00C4CC;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:20px">
        Accéder à mon espace et traiter les rejets
      </a>

      ${nbRelance >= 3 ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;margin-top:16px">
        <p style="color:#9a3412;font-size:12px;margin:0;font-weight:600">
          ⚠️ Dernière relance avant clôture administrative
        </p>
        <p style="color:#c2410c;font-size:12px;margin:4px 0 0">
          Sans réponse de votre part sous 7 jours, ce dossier sera clôturé et les montants définitivement perdus.
        </p>
      </div>` : ''}

      <p style="color:#94a3b8;font-size:12px;margin-top:20px">
        Pour toute question : <a href="mailto:contact@elodiatech.com" style="color:#00C4CC">contact@elodiatech.com</a>
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">ElodiaTech FSE — Martinique</p>
    </div>
  </div>
</div>
</body>
</html>`

  return {
    subject: `${urgence}[ElodiaTech] Relance ${nbRelance} — ${rejets.length} rejet(s) en attente — ${medecin.nom_cabinet}`,
    html
  }
}

// ─── Envoi email ──────────────────────────────────────────────────────────────

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`   📧 [DRY RUN] Email → ${to} : "${subject}"`)
    return true
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  })
  return res.ok
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(50))
  console.log(' ElodiaTech FSE — Relances automatiques File C')
  console.log(' ' + new Date().toLocaleString('fr-FR'))
  console.log('═'.repeat(50) + '\n')

  // Récupérer tous les rejets en escalade médecin
  const { data: rejets, error } = await supabase
    .from('rejets_fse')
    .select('*, medecins(id, nom_cabinet, nom_medecin, email)')
    .eq('statut', 'escalade_medecin')
    .order('statut_change_at', { ascending: true })

  if (error) {
    console.error('❌ Erreur Supabase:', error.message)
    process.exit(1)
  }

  if (!rejets?.length) {
    console.log('✅ Aucun rejet en escalade médecin — rien à relancer\n')
    return
  }

  console.log(`📋 ${rejets.length} rejet(s) en escalade médecin\n`)

  // Grouper par médecin
  const parMedecin = {}
  for (const r of rejets) {
    const med = r.medecins
    if (!med?.email) {
      console.log(`   ⚠️  ${r.id_fse} — email médecin manquant (${med?.nom_cabinet})`)
      continue
    }
    if (!parMedecin[med.id]) parMedecin[med.id] = { medecin: med, rejets: [] }
    parMedecin[med.id].rejets.push(r)
  }

  let envoyes = 0
  let ignores = 0

  for (const { medecin, rejets: rejetsGrp } of Object.values(parMedecin)) {
    // Calculer le rejet le plus ancien pour déterminer le délai
    const rejetLePlusAncien = rejetsGrp.reduce((oldest, r) => {
      const dateR = new Date(r.statut_change_at || r.updated_at || r.created_at)
      const dateO = new Date(oldest.statut_change_at || oldest.updated_at || oldest.created_at)
      return dateR < dateO ? r : oldest
    })

    const jours = joursDepuis(rejetLePlusAncien.statut_change_at || rejetLePlusAncien.updated_at)
    const nbRelancesActuelles = Math.max(...rejetsGrp.map(r => r.nb_relances || 0))

    console.log(`\n👤 ${medecin.nom_cabinet}`)
    console.log(`   Email    : ${medecin.email}`)
    console.log(`   Rejets   : ${rejetsGrp.length}`)
    console.log(`   Délai    : ${jours} jours`)
    console.log(`   Relances : ${nbRelancesActuelles}`)

    // Déterminer si une relance est nécessaire
    const doitRelancer = (
      (jours >= RELANCE_J3 && nbRelancesActuelles === 0) ||
      (jours >= RELANCE_J7 && nbRelancesActuelles === 1) ||
      (jours >= RELANCE_J14 && nbRelancesActuelles === 2)
    )

    if (!doitRelancer) {
      const prochaine = nbRelancesActuelles === 0
        ? `J+${RELANCE_J3 - jours} jours`
        : nbRelancesActuelles === 1
          ? `J+${RELANCE_J7 - jours} jours`
          : 'aucune'
      console.log(`   ⏭️  Pas encore — prochaine relance dans ${prochaine}`)
      ignores++
      continue
    }

    const numRelance = nbRelancesActuelles + 1
    console.log(`   📧 Envoi relance n°${numRelance}...`)

    const { subject, html } = emailRelance(medecin, rejetsGrp, jours, numRelance)
    const ok = await sendEmail(medecin.email, subject, html)

    if (ok) {
      // Mettre à jour nb_relances et derniere_relance_at
      const ids = rejetsGrp.map(r => r.id)
      await supabase
        .from('rejets_fse')
        .update({
          nb_relances: numRelance,
          derniere_relance_at: new Date().toISOString(),
        })
        .in('id', ids)

      console.log(`   ✅ Relance n°${numRelance} envoyée à ${medecin.email}`)
      envoyes++
    } else {
      console.log(`   ❌ Échec envoi email`)
    }
  }

  console.log('\n' + '═'.repeat(50))
  console.log(` Bilan : ${envoyes} relance(s) envoyée(s) / ${ignores} ignorée(s)`)
  console.log('═'.repeat(50) + '\n')
}

main().catch(e => { console.error(e); process.exit(1) })
