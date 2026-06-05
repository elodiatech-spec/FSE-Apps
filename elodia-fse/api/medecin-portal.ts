/**
 * ElodiaTech FSE — Données de l'espace médecin (Vercel)
 *
 * Endpoint : GET /api/medecin-portal?id=<uuid>
 *
 * Sécurité :
 *   - Utilise la clé SERVICE côté serveur (jamais exposée au navigateur).
 *   - Ne renvoie QUE les données du médecin dont l'UUID est fourni
 *     (l'UUID, non devinable, fait office de jeton d'accès).
 *   - Remplace l'ancien accès "anon" qui exposait toute la base.
 *
 * Variable d'environnement Vercel (sans préfixe VITE_) :
 *   SUPABASE_SERVICE_KEY = sb_secret_...   (clé service Supabase)
 *   VITE_SUPABASE_URL    (déjà présente)
 */

import { createClient } from '@supabase/supabase-js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
}
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (k: string, v: string) => void
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ''
  if (!serviceKey) {
    return res.status(503).json({ error: 'Service non configuré (SUPABASE_SERVICE_KEY manquante)' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: medecin, error: medErr } = await supabase
      .from('medecins')
      .select('*')
      .eq('id', id)
      .single()

    if (medErr || !medecin) {
      return res.status(404).json({ error: 'Médecin introuvable' })
    }

    const [rejetsRes, facturesRes] = await Promise.all([
      supabase.from('rejets_fse').select('*').eq('medecin_id', id)
        .order('date_rejet', { ascending: false }).limit(50),
      supabase.from('facturation').select('*').eq('medecin_id', id)
        .order('periode', { ascending: false }).limit(12),
    ])

    // Cache léger côté CDN (30 s) pour limiter les appels répétés
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')

    return res.status(200).json({
      medecin,
      rejets: rejetsRes.data || [],
      factures: facturesRes.data || [],
    })
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(err) })
  }
}
