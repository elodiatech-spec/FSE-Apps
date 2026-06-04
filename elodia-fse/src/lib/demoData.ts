import { supabase } from './supabase'

export async function loadDemoData(): Promise<void> {
  // Check if already loaded
  const { data: existing } = await supabase.from('medecins').select('id').limit(1)
  if (existing && existing.length > 0) return

  // Insert demo agents
  const { data: agents } = await supabase.auth.admin?.listUsers?.() ?? { data: null }

  // Create agents entries (linked to auth users if they exist)
  const agentsData = [
    { nom: 'MARTIN', prenom: 'Frédéric', email: 'gerant@elodiatech.com', role: 'gerant' as const, actif: true },
    { nom: 'JOSEPH', prenom: 'Marie', email: 'manageuse@elodiatech.com', role: 'manageuse' as const, actif: true },
    { nom: 'DURAND', prenom: 'Jean', email: 'agent@elodiatech.com', role: 'agent' as const, actif: true },
  ]

  const { data: insertedAgents } = await supabase.from('agents').insert(agentsData).select()
  if (!insertedAgents) return

  const agentId = insertedAgents.find(a => a.role === 'agent')?.id

  // Create demo medecins
  const medecinsFr = [
    {
      code_elodiatech: 'ET-001',
      nom_cabinet: 'Cabinet du Dr BELLECOUR',
      nom_medecin: 'Dr Sophie BELLECOUR',
      logiciel: 'doctolib' as const,
      offre: 'zen_fse' as const,
      date_souscription: '2025-01-15',
      quota_zen: 40,
      tranche_pass_recup: null,
      statut_cpe: 'actif' as const,
      date_expiration_cpe: '2027-01-15',
      adresse_mssante: 'sophie.bellecour@medecin.mssante.fr',
      email: 'contact@cabinet-bellecour.re',
      actif: true,
    },
    {
      code_elodiatech: 'ET-002',
      nom_cabinet: 'Médecine Générale Fort-de-France',
      nom_medecin: 'Dr Marc DUVALIER',
      logiciel: 'medistory' as const,
      offre: 'liberty_fse' as const,
      date_souscription: '2025-03-01',
      quota_zen: null,
      tranche_pass_recup: null,
      statut_cpe: 'expirant' as const,
      date_expiration_cpe: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      adresse_mssante: 'marc.duvalier@medecin.mssante.fr',
      email: 'duvalier.medecin@gmail.com',
      actif: true,
    },
    {
      code_elodiatech: 'ET-003',
      nom_cabinet: 'Polyclinique du Lamentin',
      nom_medecin: 'Dr Isabelle CELESTE',
      logiciel: 'maiia' as const,
      offre: 'pass_recup' as const,
      date_souscription: '2024-11-01',
      quota_zen: null,
      tranche_pass_recup: 18000,
      statut_cpe: 'en_attente' as const,
      date_expiration_cpe: null,
      adresse_mssante: null,
      email: 'celeste@polyclinique-lamentin.fr',
      actif: true,
    },
  ]

  const { data: medecins } = await supabase.from('medecins').insert(medecinsFr).select()
  if (!medecins) return

  const [med1, med2, med3] = medecins

  // Create demo rejets (one per file)
  const rejets = [
    // File A: auto, droits_adri
    {
      id_fse: 'FSE-2026-001234',
      date_rejet: '2026-06-01',
      medecin_id: med1.id,
      logiciel_source: 'doctolib',
      code_erreur: '1101',
      libelle_erreur: 'Droits AMO expirés — patient non couvert',
      famille_rejet: 'droits_adri' as const,
      niveau_rejet: 'fse' as const,
      part_concernee: 'amo' as const,
      montant_fse: 250.00,
      agent_id: agentId || null,
      statut: 'en_attente' as const,
      voie_traitement: 'auto' as const,
      fichier_valide: false,
      ticket_correction: {
        famille: 'droits_adri',
        diagnostic: 'Les droits AMO du patient sont expirés à la date de la consultation. Une vérification ADRi confirme la mise à jour des droits.',
        procedure: [
          'Vérifier les droits via le téléservice ADRi',
          'Mettre à jour la carte Vitale du patient',
          'Régénérer la FSE avec les droits actualisés',
          'Retransmettre dans le lot suivant',
        ],
        voie: 'auto',
        confiance: 0.95,
      },
      montant_recupere: null,
    },
    // File B: agent, cotation
    {
      id_fse: 'FSE-2026-001235',
      date_rejet: '2026-06-02',
      medecin_id: med2.id,
      logiciel_source: 'medistory',
      code_erreur: '2203',
      libelle_erreur: 'Code CCAM incompatible avec la spécialité',
      famille_rejet: 'cotation' as const,
      niveau_rejet: 'acte' as const,
      part_concernee: 'amo' as const,
      montant_fse: 180.50,
      agent_id: agentId || null,
      statut: 'en_cours' as const,
      voie_traitement: 'agent' as const,
      fichier_valide: false,
      ticket_correction: {
        famille: 'cotation',
        diagnostic: 'L\'acte CCAM coté ne correspond pas à la spécialité déclarée du médecin. Validation humaine obligatoire avant toute correction.',
        procedure: [
          'Vérifier la spécialité du médecin dans le RPPS',
          'Consulter le référentiel CCAM pour identifier l\'acte correct',
          'Corriger la cotation après validation médicale',
          'Ne pas retransmettre sans aval du médecin',
        ],
        voie: 'agent',
        confiance: 0.78,
      },
      montant_recupere: null,
    },
    // File C: medecin escalation, parametrage
    {
      id_fse: 'FSE-2026-001236',
      date_rejet: '2026-06-03',
      medecin_id: med3.id,
      logiciel_source: 'maiia',
      code_erreur: '3301',
      libelle_erreur: 'Numéro RPPS du prescripteur absent',
      famille_rejet: 'parametrage' as const,
      niveau_rejet: 'lot' as const,
      part_concernee: 'amo' as const,
      montant_fse: 520.75,
      agent_id: null,
      statut: 'escalade_medecin' as const,
      voie_traitement: 'medecin' as const,
      fichier_valide: false,
      ticket_correction: {
        famille: 'parametrage',
        diagnostic: 'Le numéro RPPS du prescripteur est absent ou invalide dans le paramétrage du logiciel. Le médecin doit vérifier et corriger son paramétrage.',
        procedure: [
          'Contacter le médecin via MSSanté',
          'Demander vérification du RPPS dans Maiia',
          'Corriger le paramétrage avec le support logiciel',
          'Valider et retransmettre',
        ],
        voie: 'medecin',
        confiance: 0.88,
      },
      montant_recupere: null,
    },
  ]

  await supabase.from('rejets_fse').insert(rejets)
}

export async function checkDemoDataExists(): Promise<boolean> {
  const { count } = await supabase.from('medecins').select('*', { count: 'exact', head: true })
  return (count || 0) > 0
}
