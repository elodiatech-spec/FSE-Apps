import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: Agent
        Insert: Omit<Agent, 'id' | 'created_at'>
        Update: Partial<Omit<Agent, 'id' | 'created_at'>>
      }
      medecins: {
        Row: Medecin
        Insert: Omit<Medecin, 'id' | 'created_at'>
        Update: Partial<Omit<Medecin, 'id' | 'created_at'>>
      }
      rejets_fse: {
        Row: RejetFSE
        Insert: Omit<RejetFSE, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RejetFSE, 'id' | 'created_at'>>
      }
      facturation: {
        Row: Facturation
        Insert: Omit<Facturation, 'id' | 'created_at'>
        Update: Partial<Omit<Facturation, 'id' | 'created_at'>>
      }
      commissions_manageuse: {
        Row: CommissionManageuse
        Insert: Omit<CommissionManageuse, 'id' | 'created_at'>
        Update: Partial<Omit<CommissionManageuse, 'id' | 'created_at'>>
      }
    }
  }
}

export interface Agent {
  id: string
  nom: string
  prenom: string
  email: string
  role: 'gerant' | 'manageuse' | 'agent'
  actif: boolean
  created_at: string
}

export interface Medecin {
  id: string
  code_elodiatech: string
  nom_cabinet: string
  nom_medecin: string
  logiciel: 'doctolib' | 'medistory' | 'maiia' | 'axisante' | 'hellodoc' | 'docteursante'
  offre: 'zen_fse' | 'liberty_fse' | 'pass_recup'
  date_souscription: string
  quota_zen: number | null
  tranche_pass_recup: number | null
  statut_cpe: 'actif' | 'expirant' | 'expiré' | 'en_attente'
  date_expiration_cpe: string | null
  adresse_mssante: string | null
  email: string | null
  actif: boolean
  created_at: string
}

export interface RejetFSE {
  id: string
  id_fse: string
  date_rejet: string
  medecin_id: string
  logiciel_source: string
  code_erreur: string
  libelle_erreur: string
  famille_rejet: 'droits_adri' | 'cotation' | 'parametrage' | 'caisse' | 'amc_dre'
  niveau_rejet: 'lot' | 'fse' | 'acte' | 'signalement'
  part_concernee: 'amo' | 'amc' | 'les_deux'
  montant_fse: number
  agent_id: string | null
  date_traitement: string | null
  statut: 'en_attente' | 'en_cours' | 'résolu' | 'non_résolu' | 'escalade_medecin' | 'retransmis'
  montant_recupere: number | null
  date_paiement_amo: string | null
  fichier_valide: boolean
  voie_traitement: 'auto' | 'agent' | 'medecin' | null
  ticket_correction: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
  medecins?: Medecin
  agents?: Agent
}

export interface Facturation {
  id: string
  periode: string
  medecin_id: string
  offre: string
  nb_rejets_traites: number
  montant_base: number
  nb_tranches_depassement: number
  montant_depassement: number
  montant_recupere: number
  taux_commission: number
  montant_commission: number
  frais_dossier: number
  total_facture: number
  statut_paiement: 'en_attente' | 'payé' | 'en_retard'
  date_paiement: string | null
  created_at: string
  medecins?: Medecin
}

export interface CommissionManageuse {
  id: string
  periode: string
  manageuse_id: string
  nb_rejets_manageuse: number
  montant_facture_manageuse: number
  montant_facture_agents: number
  statut_paiement: 'en_attente' | 'payé'
  date_paiement: string | null
  created_at: string
  agents?: Agent
}

export interface CodeErreur {
  code: string
  libelle: string
  famille: 'droits_adri' | 'cotation' | 'parametrage' | 'caisse' | 'amc_dre'
  voie: 'auto' | 'agent' | 'medecin'
  confiance: number
  diagnostic: string | null
  procedure: string[]
  source: 'defaut' | 'manuel' | 'ia'
  actif: boolean
  created_at?: string
  updated_at?: string
}
