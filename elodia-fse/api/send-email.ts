/**
 * ElodiaTech FSE — Fonction serveur d'envoi d'email (Vercel)
 *
 * Endpoint : POST /api/send-email
 *
 * Sécurité :
 *   - La clé Resend (RESEND_API_KEY) reste côté serveur, jamais exposée au navigateur.
 *   - L'appelant doit fournir un jeton de session Supabase valide (utilisateur connecté).
 *
 * Variables d'environnement Vercel (sans préfixe VITE_) :
 *   RESEND_API_KEY  = re_...           (secret, côté serveur uniquement)
 *   FROM_EMAIL      = ElodiaTech FSE <noreply@elodiatech.com>   (optionnel)
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  (déjà présentes, pour vérifier le jeton)
 */

import { createClient } from '@supabase/supabase-js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  // 1. Vérifier l'authentification Supabase
  const authHeader = (req.headers.authorization || req.headers.Authorization || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  const supabase = createClient(supabaseUrl, supabaseAnon)

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Session invalide' })
  }

  // 2. Valider le corps de la requête
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
    to?: string; subject?: string; html?: string
  }
  const { to, subject, html } = body || {}
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Champs requis manquants (to, subject, html)' })
  }

  // 3. Envoyer via Resend (clé côté serveur)
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = process.env.FROM_EMAIL || 'ElodiaTech FSE <noreply@elodiatech.com>'
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY non configurée sur le serveur' })
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ error: 'Échec envoi Resend', detail })
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(err) })
  }
}
