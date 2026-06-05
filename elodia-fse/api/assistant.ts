/**
 * ElodiaTech FSE — Assistant IA (Google Gemini)
 *
 * Endpoint : POST /api/assistant
 *
 * Sécurité :
 *   - La clé Gemini (GEMINI_API_KEY) reste côté serveur, jamais exposée au navigateur.
 *   - L'appelant doit fournir un jeton de session Supabase valide (utilisateur connecté).
 *
 * Variables d'environnement Vercel (sans préfixe VITE_) :
 *   GEMINI_API_KEY  = AIza...        (secret, à ajouter plus tard via Google AI Studio)
 *   GEMINI_MODEL    = gemini-2.0-flash   (optionnel)
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  (déjà présentes)
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

interface ChatMessage { role: 'user' | 'model'; content: string }

const SYSTEM_PROMPT = `Tu es l'assistant IA d'ElodiaTech FSE, un logiciel qui aide une équipe martiniquaise à traiter les rejets de Feuilles de Soins Électroniques (FSE) des médecins.

Ton rôle : aider les AGENTS et le GÉRANT à bien utiliser l'application et à comprendre le métier des rejets FSE. Réponds toujours en FRANÇAIS, de façon claire, concise et bienveillante. Si tu n'es pas sûr, dis-le honnêtement.

# CONNAISSANCE DE L'APPLICATION

## Les 3 rôles
- Gérant : voit tout (dashboard global, médecins, équipe, facturation, commissions, ingestion, connecteurs).
- Manageuse : supervise les agents, voit ses commissions (50% de sa propre production + 5% de l'équipe).
- Agent : traite les rejets via un Kanban (files A/B/C).

## Le workflow des rejets (files A/B/C)
- File A (Auto, vert) : rejets résolubles automatiquement (droits/ADRi, AMC simple). L'agent valide.
- File B (Agent, orange) : nécessite l'intervention manuelle d'un agent.
- File C (Médecin, rouge) : nécessite une action du médecin. Un email lui est envoyé, avec relances automatiques à J+3, J+7 et J+14.
- RÈGLE IMPORTANTE : un rejet de COTATION ne va JAMAIS en File A (validation médicale obligatoire).

## Les 5 familles de rejets NOEMIE
1. Droits / ADRi : droits AMO fermés, bénéficiaire inconnu, NIR incorrect. Souvent automatisable.
2. Cotation : code CCAM invalide, acte incompatible spécialité, association non conforme. Toujours validation médecin.
3. Paramétrage : RPPS/FINESS absent, format B2 non conforme, signature CPE invalide.
4. Caisse : dossier en cours d'instruction ou en litige à la CPAM (surveillance).
5. AMC / DRE : organisme complémentaire inconnu, taux non conforme, PJ manquante.

## Les modules
- Ingestion RSP : importer un fichier NOEMIE (.rsp) ou CSV ; l'app classe automatiquement les rejets en files A/B/C avec un score de confiance.
- Connecteurs : récupèrent automatiquement les rejets depuis Doctolib, Medistory, Maiia, Axisanté, HelloDoc, Docteur Santé.
- Médecins : fiches, offres, statut CPE ; chaque médecin a un espace en ligne (lien unique) pour suivre ses rejets et télécharger relevés/factures.
- Facturation : 3 offres — ZEN FSE (abonnement 99€/40 rejets + tranches), LIBERTY FSE (commission 12% du récupéré), PASS RÉCUP' (10-12% selon tranche).
- Équipe : gestion des agents, statistiques de performance.
- Relances : emails automatiques aux médecins pour les rejets en attente.

## Conseils d'utilisation fréquents
- Pour traiter un rejet : cliquer dessus, lire le diagnostic IA, suivre la procédure, mettre à jour le statut et le montant récupéré.
- Pour envoyer un relevé à un médecin : page Facturation, bouton « Envoyer ».
- Pour obtenir le lien de l'espace d'un médecin : fiche médecin, bouton « Lien espace médecin ».
- Pour importer des rejets : page Ingestion RSP, glisser le fichier.

# CADRE
- Tu ne donnes JAMAIS de conseil médical ni de cotation précise à la place du médecin : pour la cotation, tu rappelles que la validation du médecin est obligatoire.
- Tu ne traites pas de données patients identifiantes ; si on t'en donne, rappelle la confidentialité.
- Reste factuel sur le périmètre ElodiaTech. Si une question sort totalement du cadre (ex: météo), recentre poliment.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  // 1. Authentification Supabase
  const authHeader = (req.headers.authorization || req.headers.Authorization || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  const supabase = createClient(supabaseUrl, supabaseAnon)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Session invalide' })

  // 2. Corps de la requête
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
    messages?: ChatMessage[]
  }
  const messages = body?.messages || []
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Aucun message fourni' })
  }

  // 3. Appel Gemini
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'assistant_non_configure',
      message: "L'assistant IA n'est pas encore activé. La clé Gemini doit être ajoutée par l'administrateur.",
    })
  }

  const contents = messages.slice(-12).map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }))

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    })

    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ error: 'Échec Gemini', detail })
    }

    const data = await r.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    return res.status(200).json({ reply: reply || "Je n'ai pas pu générer de réponse." })
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(err) })
  }
}
