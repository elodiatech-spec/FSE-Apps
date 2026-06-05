/**
 * ElodiaTech FSE — Service email
 *
 * Les emails sont envoyés via la fonction serveur sécurisée /api/send-email
 * (la clé Resend reste côté serveur, jamais exposée au navigateur).
 * L'utilisateur doit être connecté (jeton Supabase vérifié côté serveur).
 */

import { supabase, Medecin, RejetFSE, Facturation } from './supabase'
import { formatCurrency, formatDate, formatPeriode } from './utils'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      console.warn('Aucune session active — email non envoyé')
      return false
    }

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Erreur envoi email:', err)
    }
    return res.ok
  } catch (err) {
    console.error('Erreur envoi email:', err)
    return false
  }
}

// ─── Templates HTML ───────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f1f5f9; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 24px 16px; }
    .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #0D1B2A; padding: 24px 32px; }
    .header-logo { color: white; font-size: 20px; font-weight: 700; margin: 0; }
    .header-sub { color: #00C4CC; font-size: 12px; margin: 2px 0 0; }
    .body { padding: 32px; }
    .title { color: #0D1B2A; font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    .subtitle { color: #64748b; font-size: 14px; margin: 0 0 24px; }
    .alert-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; margin: 0 0 24px; }
    .alert-box.red { background: #fef2f2; border-color: #ef4444; }
    .alert-title { color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 4px; }
    .alert-title.red { color: #991b1b; }
    .alert-text { color: #b45309; font-size: 13px; margin: 0; }
    .alert-text.red { color: #dc2626; }
    .rejet-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 0 0 12px; }
    .rejet-fse { font-family: monospace; font-weight: 700; color: #0D1B2A; font-size: 13px; }
    .rejet-libelle { color: #475569; font-size: 13px; margin: 4px 0; }
    .rejet-meta { color: #94a3b8; font-size: 12px; }
    .rejet-steps { background: #eff6ff; border-radius: 8px; padding: 12px; margin-top: 10px; }
    .rejet-steps-title { color: #1e40af; font-size: 12px; font-weight: 600; margin: 0 0 6px; }
    .rejet-steps ol { margin: 0; padding-left: 20px; }
    .rejet-steps li { color: #1d4ed8; font-size: 12px; margin-bottom: 3px; }
    .btn { display: inline-block; background: #00C4CC; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .btn-outline { display: inline-block; background: white; color: #0D1B2A; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 13px; border: 2px solid #e2e8f0; margin: 8px 8px 8px 0; }
    .stat-row { display: flex; gap: 12px; margin: 20px 0; }
    .stat-box { flex: 1; background: #f8fafc; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-value { color: #0D1B2A; font-size: 20px; font-weight: 700; }
    .stat-value.teal { color: #00C4CC; }
    .stat-label { color: #94a3b8; font-size: 11px; margin-top: 2px; }
    .divider { height: 1px; background: #f1f5f9; margin: 20px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; }
    .footer-text { color: #94a3b8; font-size: 11px; text-align: center; margin: 0; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <p class="header-logo">ElodiaTech</p>
      <p class="header-sub">FSE Manager</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p class="footer-text">ElodiaTech — Martinique — contact@elodiatech.com</p>
      <p class="footer-text" style="margin-top:4px">Ce message est confidentiel et destine uniquement a son destinataire.</p>
    </div>
  </div>
</div>
</body>
</html>`
}

// ─── Email 1 : Escalade médecin (File C) ─────────────────────────────────────

export async function sendEmailEscaladeMedecin(
  medecin: Medecin,
  rejets: RejetFSE[]
): Promise<boolean> {
  if (!medecin.email) return false

  const portalUrl = `${APP_URL}/medecin/${medecin.id}`
  const totalMontant = rejets.reduce((s, r) => s + r.montant_fse, 0)

  const rejetsHtml = rejets.map(r => {
    const ticket = r.ticket_correction as { diagnostic?: string; procedure?: string[] } | null
    const stepsHtml = ticket?.procedure?.length
      ? `<div class="rejet-steps">
          <p class="rejet-steps-title">Action a effectuer :</p>
          <ol>${ticket.procedure.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>`
      : ''
    return `
      <div class="rejet-card">
        <div class="rejet-fse">${r.id_fse}</div>
        <div class="rejet-libelle">${r.libelle_erreur}</div>
        <div class="rejet-meta">Code ${r.code_erreur} &bull; ${formatDate(r.date_rejet)} &bull; <strong>${formatCurrency(r.montant_fse)}</strong></div>
        ${ticket?.diagnostic ? `<div class="rejet-meta" style="margin-top:6px;color:#475569">${ticket.diagnostic}</div>` : ''}
        ${stepsHtml}
      </div>`
  }).join('')

  const content = `
    <p class="title">Action requise de votre part</p>
    <p class="subtitle">${rejets.length} rejet${rejets.length > 1 ? 's' : ''} necessitent votre intervention — ${medecin.nom_cabinet}</p>

    <div class="alert-box red">
      <p class="alert-title red">Intervention du medecin necessaire</p>
      <p class="alert-text red">Les rejets ci-dessous ne peuvent pas etre traites sans votre action directe. Montant total concerne : <strong>${formatCurrency(totalMontant)}</strong></p>
    </div>

    ${rejetsHtml}

    <div class="divider"></div>

    <p style="color:#475569;font-size:13px;margin:0 0 8px">Acces a votre espace de suivi :</p>
    <a href="${portalUrl}" class="btn">Voir mon espace en ligne</a>

    <p style="color:#94a3b8;font-size:12px;margin-top:16px">
      Si vous avez des questions, contactez directement votre gestionnaire ElodiaTech.
    </p>`

  return sendEmail(
    medecin.email,
    `[ElodiaTech] ${rejets.length} action(s) requise(s) — ${medecin.nom_cabinet}`,
    baseTemplate(content)
  )
}

// ─── Email 2 : Relevé mensuel + lien espace ───────────────────────────────────

export async function sendEmailReleve(
  medecin: Medecin,
  facture: Facturation,
  rejets: RejetFSE[]
): Promise<boolean> {
  if (!medecin.email) return false

  const portalUrl = `${APP_URL}/medecin/${medecin.id}`
  const periodeLabel = formatPeriode(facture.periode)
  const resolus = rejets.filter(r => r.statut === 'résolu' || r.statut === 'retransmis')
  const taux = rejets.length > 0 ? Math.round((resolus.length / rejets.length) * 100) : 0

  const content = `
    <p class="title">Votre releve mensuel</p>
    <p class="subtitle">${periodeLabel} — ${medecin.nom_cabinet}</p>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-value">${facture.nb_rejets_traites}</div>
        <div class="stat-label">Rejets traites</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${taux}%</div>
        <div class="stat-label">Taux resolution</div>
      </div>
      <div class="stat-box">
        <div class="stat-value teal">${formatCurrency(facture.montant_recupere)}</div>
        <div class="stat-label">Recupere</div>
      </div>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:0 0 20px">
      <p style="color:#166534;font-size:13px;font-weight:600;margin:0 0 4px">Montant de votre facture</p>
      <p style="color:#15803d;font-size:24px;font-weight:700;margin:0">${formatCurrency(facture.total_facture)}</p>
      <p style="color:#4ade80;font-size:12px;margin:4px 0 0">
        ${facture.statut_paiement === 'payé' ? 'Paye — Merci' : 'En attente de reglement (30 jours)'}
      </p>
    </div>

    <div class="divider"></div>

    <p style="color:#475569;font-size:13px;margin:0 0 12px">Depuis votre espace en ligne, telechargez votre releve detaille et votre facture :</p>
    <a href="${portalUrl}" class="btn">Acceder a mon espace</a>

    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      Pour toute question concernant cette facture, contactez-nous a contact@elodiatech.com
    </p>`

  return sendEmail(
    medecin.email,
    `[ElodiaTech] Votre releve ${periodeLabel} — ${formatCurrency(facture.total_facture)}`,
    baseTemplate(content)
  )
}

// ─── Email 3 : Lien espace médecin (à la demande) ────────────────────────────

export async function sendEmailLienEspace(medecin: Medecin): Promise<boolean> {
  if (!medecin.email) return false

  const portalUrl = `${APP_URL}/medecin/${medecin.id}`

  const content = `
    <p class="title">Votre espace ElodiaTech</p>
    <p class="subtitle">${medecin.nom_cabinet} — ${medecin.nom_medecin}</p>

    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">
      Bonjour,<br><br>
      Votre espace personnel ElodiaTech vous permet de suivre en temps reel le traitement de vos rejets FSE,
      consulter vos releves mensuels et telecharger vos factures.
    </p>

    <a href="${portalUrl}" class="btn">Acceder a mon espace</a>

    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      Ce lien est personnel et confidentiel. Ne le partagez pas.<br>
      Offre souscrite : <strong>${medecin.offre.replace(/_/g, ' ').toUpperCase()}</strong>
    </p>`

  return sendEmail(
    medecin.email,
    `[ElodiaTech] Acces a votre espace de suivi FSE`,
    baseTemplate(content)
  )
}
