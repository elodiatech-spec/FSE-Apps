/**
 * ElodiaTech FSE — Diagnostic IA génératif d'un rejet (Anthropic Claude)
 *
 * Endpoint : POST /api/diagnostic-rejet
 * Body : { rejet: { id_fse, code_erreur, libelle_erreur, famille_rejet,
 *                    montant_fse, logiciel_source, part_concernee, niveau_rejet } }
 *
 * Sécurité : clé Claude côté serveur + jeton Supabase vérifié (utilisateur connecté).
 * Renvoie : { diagnostic, procedure[], confiance, voie }
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

const SYSTEM_PROMPT = `Tu es un expert du traitement des rejets de Feuilles de Soins Électroniques (FSE) en France, spécialiste des retours NOEMIE-PS / SESAM-Vitale.

On te donne les informations d'UN rejet FSE. Tu produis un diagnostic précis et une procédure de correction concrète, destinés à un agent ElodiaTech (non-médecin).

RÈGLES IMPÉRATIVES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.
- Format exact :
  {
    "diagnostic": "explication claire de la cause probable (2-4 phrases)",
    "procedure": ["étape 1", "étape 2", "..."],
    "confiance": 0.0 à 1.0,
    "voie": "auto" | "agent" | "medecin"
  }
- "voie" : "auto" si corrigeable automatiquement (droits/ADRi simples), "agent" si intervention manuelle d'un agent, "medecin" si action du médecin indispensable.
- RÈGLE MÉTIER : un rejet de COTATION (code CCAM, association d'actes, tarif) impose TOUJOURS "voie":"medecin" ou "agent" avec validation médecin — JAMAIS "auto".
- Ne donne jamais de cotation médicale précise à la place du médecin ; rappelle la validation médecin si pertinent.
- Procédure : 2 à 5 étapes concrètes et actionnables.
- En français.`

async function callClaude(apiKey: string, userContent: string): Promise<string> {
  // Découverte du modèle disponible (le moins cher)
  let model = process.env.CLAUDE_MODEL || ''
  if (!model) {
    const mr = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })
    if (!mr.ok) throw new Error('models: ' + (await mr.text()))
    const md = await mr.json() as { data?: { id?: string }[] }
    const ids = (md.data || []).map(m => m.id || '').filter(Boolean)
    model = ids.find(id => id.includes('haiku')) || ids.find(id => id.includes('sonnet')) || ids[0] || ''
  }
  if (!model) throw new Error('Aucun modèle disponible')

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!r.ok) throw new Error('claude: ' + (await r.text()))
  const data = await r.json() as { content?: { type?: string; text?: string }[] }
  return data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  // Auth Supabase
  const authHeader = (req.headers.authorization || req.headers.Authorization || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Session invalide' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'assistant_non_configure', message: 'Clé Anthropic manquante.' })
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { rejet?: Record<string, unknown> }
  const r = body?.rejet
  if (!r) return res.status(400).json({ error: 'Rejet manquant' })

  const userContent = `Analyse ce rejet FSE :
- Code erreur : ${r.code_erreur ?? '?'}
- Libellé : ${r.libelle_erreur ?? '?'}
- Famille : ${r.famille_rejet ?? '?'}
- Niveau : ${r.niveau_rejet ?? '?'}
- Part concernée : ${r.part_concernee ?? '?'}
- Montant : ${r.montant_fse ?? '?'} €
- Logiciel source : ${r.logiciel_source ?? '?'}

Donne le diagnostic et la procédure au format JSON demandé.`

  try {
    const raw = await callClaude(ANTHROPIC_API_KEY, userContent)
    // Extraction JSON robuste (au cas où le modèle ajoute du texte)
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : null
    if (!parsed || !parsed.diagnostic) {
      return res.status(502).json({ error: 'Réponse IA non exploitable', detail: raw.slice(0, 300) })
    }
    // Garde-fou métier : cotation jamais "auto"
    if (String(r.famille_rejet) === 'cotation' && parsed.voie === 'auto') {
      parsed.voie = 'agent'
    }
    return res.status(200).json({
      diagnostic: String(parsed.diagnostic),
      procedure: Array.isArray(parsed.procedure) ? parsed.procedure.map(String) : [],
      confiance: typeof parsed.confiance === 'number' ? parsed.confiance : 0.7,
      voie: ['auto', 'agent', 'medecin'].includes(parsed.voie) ? parsed.voie : 'agent',
      genere_par: 'ia',
    })
  } catch (err) {
    return res.status(502).json({ error: 'Échec diagnostic', detail: String(err) })
  }
}
