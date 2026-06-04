import { useState, useEffect } from 'react'
import { CheckCircle, Copy, Database, Play, AlertCircle, ChevronRight, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useNavigate } from 'react-router-dom'

const MIGRATION_SQL = `-- ElodiaTech FSE — Création des tables
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('gerant', 'manageuse', 'agent')),
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medecins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_elodiatech TEXT NOT NULL UNIQUE,
  nom_cabinet TEXT NOT NULL,
  nom_medecin TEXT NOT NULL,
  logiciel TEXT NOT NULL CHECK (logiciel IN ('doctolib','medistory','maiia','axisante','hellodoc','docteursante')),
  offre TEXT NOT NULL CHECK (offre IN ('zen_fse','liberty_fse','pass_recup')),
  date_souscription DATE NOT NULL,
  quota_zen INTEGER,
  tranche_pass_recup NUMERIC(12,2),
  statut_cpe TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut_cpe IN ('actif','expirant','expiré','en_attente')),
  date_expiration_cpe DATE,
  adresse_mssante TEXT,
  email TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rejets_fse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_fse TEXT NOT NULL,
  date_rejet DATE NOT NULL,
  medecin_id UUID NOT NULL REFERENCES medecins(id) ON DELETE CASCADE,
  logiciel_source TEXT NOT NULL,
  code_erreur TEXT NOT NULL,
  libelle_erreur TEXT NOT NULL,
  famille_rejet TEXT NOT NULL CHECK (famille_rejet IN ('droits_adri','cotation','parametrage','caisse','amc_dre')),
  niveau_rejet TEXT NOT NULL CHECK (niveau_rejet IN ('lot','fse','acte','signalement')),
  part_concernee TEXT NOT NULL CHECK (part_concernee IN ('amo','amc','les_deux')),
  montant_fse NUMERIC(12,2) NOT NULL DEFAULT 0,
  agent_id UUID REFERENCES agents(id),
  date_traitement TIMESTAMPTZ,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_cours','résolu','non_résolu','escalade_medecin','retransmis')),
  montant_recupere NUMERIC(12,2),
  date_paiement_amo DATE,
  fichier_valide BOOLEAN NOT NULL DEFAULT false,
  voie_traitement TEXT CHECK (voie_traitement IN ('auto','agent','medecin')),
  ticket_correction JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rejets_fse_updated_at ON rejets_fse;
CREATE TRIGGER rejets_fse_updated_at
  BEFORE UPDATE ON rejets_fse
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS facturation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode TEXT NOT NULL,
  medecin_id UUID NOT NULL REFERENCES medecins(id) ON DELETE CASCADE,
  offre TEXT NOT NULL,
  nb_rejets_traites INTEGER NOT NULL DEFAULT 0,
  montant_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  nb_tranches_depassement INTEGER NOT NULL DEFAULT 0,
  montant_depassement NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_recupere NUMERIC(12,2) NOT NULL DEFAULT 0,
  taux_commission NUMERIC(5,4) NOT NULL DEFAULT 0,
  montant_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  frais_dossier NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_facture NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut_paiement TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente','payé','en_retard')),
  date_paiement DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions_manageuse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode TEXT NOT NULL,
  manageuse_id UUID NOT NULL REFERENCES agents(id),
  nb_rejets_manageuse INTEGER NOT NULL DEFAULT 0,
  montant_facture_manageuse NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_facture_agents NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut_paiement TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente','payé')),
  date_paiement DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Désactiver RLS (ou configurer selon vos besoins)
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE medecins DISABLE ROW LEVEL SECURITY;
ALTER TABLE rejets_fse DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturation DISABLE ROW LEVEL SECURITY;
ALTER TABLE commissions_manageuse DISABLE ROW LEVEL SECURITY;`

const DEMO_AGENTS = [
  { nom: 'MARTIN', prenom: 'Frédéric', email: 'gerant@elodiatech.com', role: 'gerant' as const, actif: true },
  { nom: 'JOSEPH', prenom: 'Marie', email: 'manageuse@elodiatech.com', role: 'manageuse' as const, actif: true },
  { nom: 'DURAND', prenom: 'Jean', email: 'agent1@elodiatech.com', role: 'agent' as const, actif: true },
  { nom: 'PIERRE', prenom: 'Sophie', email: 'agent2@elodiatech.com', role: 'agent' as const, actif: true },
  { nom: 'ROSEAU', prenom: 'Patrick', email: 'agent3@elodiatech.com', role: 'agent' as const, actif: true },
]

export function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [checking, setChecking] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [tablesOk, setTablesOk] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    checkTables()
  }, [])

  async function checkTables() {
    setChecking(true)
    const { error } = await supabase.from('agents').select('id').limit(1)
    if (!error) {
      setTablesOk(true)
      setStep(1)
    }
    setChecking(false)
  }

  async function copySQL() {
    await navigator.clipboard.writeText(MIGRATION_SQL)
    toast('SQL copié dans le presse-papiers !', 'success')
  }

  async function loadDemo() {
    setLoadingDemo(true)
    try {
      // Create Supabase Auth users for demo
      const authAccounts = [
        { email: 'gerant@elodiatech.com', password: 'demo123456' },
        { email: 'manageuse@elodiatech.com', password: 'demo123456' },
        { email: 'agent1@elodiatech.com', password: 'demo123456' },
        { email: 'agent2@elodiatech.com', password: 'demo123456' },
        { email: 'agent3@elodiatech.com', password: 'demo123456' },
      ]

      for (const acc of authAccounts) {
        await supabase.auth.signUp({ email: acc.email, password: acc.password })
      }

      // Insert agents
      const { data: agents, error: agentErr } = await supabase.from('agents').insert(DEMO_AGENTS).select()
      if (agentErr) throw agentErr

      const gerant = agents?.find(a => a.role === 'gerant')
      const manageuse = agents?.find(a => a.role === 'manageuse')
      const agent = agents?.find(a => a.role === 'agent' && a.prenom === 'Jean')

      // Insert medecins
      const medecinsFr = [
        {
          code_elodiatech: 'ET-001',
          nom_cabinet: 'Cabinet du Dr BELLECOUR',
          nom_medecin: 'Dr Sophie BELLECOUR',
          logiciel: 'doctolib',
          offre: 'zen_fse',
          date_souscription: '2025-01-15',
          quota_zen: 40,
          tranche_pass_recup: null,
          statut_cpe: 'actif',
          date_expiration_cpe: '2027-01-15',
          adresse_mssante: 'sophie.bellecour@medecin.mssante.fr',
          email: 'contact@cabinet-bellecour.re',
          actif: true,
        },
        {
          code_elodiatech: 'ET-002',
          nom_cabinet: 'Médecine Générale Fort-de-France',
          nom_medecin: 'Dr Marc DUVALIER',
          logiciel: 'medistory',
          offre: 'liberty_fse',
          date_souscription: '2025-03-01',
          quota_zen: null,
          tranche_pass_recup: null,
          statut_cpe: 'expirant',
          date_expiration_cpe: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          adresse_mssante: 'marc.duvalier@medecin.mssante.fr',
          email: 'duvalier.medecin@gmail.com',
          actif: true,
        },
        {
          code_elodiatech: 'ET-003',
          nom_cabinet: 'Polyclinique du Lamentin',
          nom_medecin: 'Dr Isabelle CELESTE',
          logiciel: 'maiia',
          offre: 'pass_recup',
          date_souscription: '2024-11-01',
          quota_zen: null,
          tranche_pass_recup: 18000,
          statut_cpe: 'en_attente',
          date_expiration_cpe: null,
          adresse_mssante: null,
          email: 'celeste@polyclinique-lamentin.fr',
          actif: true,
        },
      ]

      const { data: medecins, error: medErr } = await supabase.from('medecins').insert(medecinsFr).select()
      if (medErr) throw medErr

      const [med1, med2, med3] = medecins!

      // Insert rejets
      const rejets = [
        {
          id_fse: 'FSE-2026-001234', date_rejet: '2026-06-01',
          medecin_id: med1.id, logiciel_source: 'doctolib',
          code_erreur: '1101', libelle_erreur: 'Droits AMO expirés — patient non couvert',
          famille_rejet: 'droits_adri', niveau_rejet: 'fse', part_concernee: 'amo',
          montant_fse: 250.00, agent_id: agent?.id,
          statut: 'en_attente', voie_traitement: 'auto', fichier_valide: false,
          ticket_correction: {
            famille: 'droits_adri',
            diagnostic: 'Les droits AMO du patient sont expirés. Vérification ADRi recommandée.',
            procedure: ['Vérifier les droits via ADRi', 'Mettre à jour la carte Vitale', 'Régénérer la FSE', 'Retransmettre'],
            voie: 'auto', confiance: 0.95,
          },
        },
        {
          id_fse: 'FSE-2026-001235', date_rejet: '2026-06-02',
          medecin_id: med2.id, logiciel_source: 'medistory',
          code_erreur: '2203', libelle_erreur: 'Code CCAM incompatible avec la spécialité',
          famille_rejet: 'cotation', niveau_rejet: 'acte', part_concernee: 'amo',
          montant_fse: 180.50, agent_id: agent?.id,
          statut: 'en_cours', voie_traitement: 'agent', fichier_valide: false,
          ticket_correction: {
            famille: 'cotation',
            diagnostic: 'Acte CCAM incompatible avec la spécialité. Validation humaine obligatoire.',
            procedure: ['Vérifier le RPPS', 'Consulter le référentiel CCAM', 'Corriger avec accord médical'],
            voie: 'agent', confiance: 0.78,
          },
        },
        {
          id_fse: 'FSE-2026-001236', date_rejet: '2026-06-03',
          medecin_id: med3.id, logiciel_source: 'maiia',
          code_erreur: '3301', libelle_erreur: 'Numéro RPPS du prescripteur absent',
          famille_rejet: 'parametrage', niveau_rejet: 'lot', part_concernee: 'amo',
          montant_fse: 520.75, agent_id: null,
          statut: 'escalade_medecin', voie_traitement: 'medecin', fichier_valide: false,
          ticket_correction: {
            famille: 'parametrage',
            diagnostic: 'Numéro RPPS absent dans le logiciel. Le médecin doit corriger le paramétrage.',
            procedure: ['Contacter via MSSanté', 'Corriger RPPS dans Maiia', 'Valider et retransmettre'],
            voie: 'medecin', confiance: 0.88,
          },
        },
      ]
      await supabase.from('rejets_fse').insert(rejets)

      // Insert demo facturation
      const factures = [
        {
          periode: '2026-05', medecin_id: med1.id, offre: 'zen_fse',
          nb_rejets_traites: 42, montant_base: 99, nb_tranches_depassement: 1,
          montant_depassement: 40, montant_recupere: 1850, taux_commission: 0,
          montant_commission: 0, frais_dossier: 0, total_facture: 139,
          statut_paiement: 'payé',
        },
        {
          periode: '2026-05', medecin_id: med2.id, offre: 'liberty_fse',
          nb_rejets_traites: 18, montant_base: 0, nb_tranches_depassement: 0,
          montant_depassement: 0, montant_recupere: 2400, taux_commission: 0.12,
          montant_commission: 288, frais_dossier: 50, total_facture: 338,
          statut_paiement: 'en_attente',
        },
        {
          periode: '2026-05', medecin_id: med3.id, offre: 'pass_recup',
          nb_rejets_traites: 25, montant_base: 0, nb_tranches_depassement: 0,
          montant_depassement: 0, montant_recupere: 3200, taux_commission: 0.10,
          montant_commission: 320, frais_dossier: 99, total_facture: 419,
          statut_paiement: 'en_attente',
        },
      ]
      await supabase.from('facturation').insert(factures)

      // Insert demo commissions
      if (manageuse) {
        const commissions = [
          {
            periode: '2026-04', manageuse_id: manageuse.id,
            nb_rejets_manageuse: 22, montant_facture_manageuse: 980,
            montant_facture_agents: 3200, statut_paiement: 'payé',
          },
          {
            periode: '2026-05', manageuse_id: manageuse.id,
            nb_rejets_manageuse: 28, montant_facture_manageuse: 1250,
            montant_facture_agents: 4100, statut_paiement: 'en_attente',
          },
          {
            periode: '2026-06', manageuse_id: manageuse.id,
            nb_rejets_manageuse: 15, montant_facture_manageuse: 680,
            montant_facture_agents: 2300, statut_paiement: 'en_attente',
          },
        ]
        await supabase.from('commissions_manageuse').insert(commissions)
      }

      toast('Données de démonstration chargées avec succès !', 'success')
      setTimeout(() => {
        onComplete()
        navigate('/login')
      }, 1500)
    } catch (err) {
      console.error(err)
      toast('Erreur lors du chargement des données', 'error')
    }
    setLoadingDemo(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f1f5f9' }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
            alt="ElodiaTech"
            className="h-12 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuration initiale</h1>
            <p className="text-slate-500 text-sm">ElodiaTech FSE — Supabase Setup</p>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Step 1: SQL Migration */}
          <div className={`border-b border-slate-100 ${step === 0 ? '' : 'opacity-60'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tablesOk ? 'bg-emerald-500 text-white' : 'bg-[#0D1B2A] text-white'}`}>
                  {tablesOk ? <CheckCircle className="w-4 h-4" /> : '1'}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Créer les tables Supabase</h2>
                  <p className="text-sm text-slate-500">Exécuter la migration SQL dans votre projet Supabase</p>
                </div>
                {tablesOk && <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />}
              </div>

              {!tablesOk && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Tables non trouvées dans Supabase</p>
                      <p className="mt-0.5">Copiez le SQL ci-dessous et collez-le dans l'éditeur SQL de votre dashboard Supabase.</p>
                      <a
                        href={`https://app.supabase.com/project/awyrojlanodjnuoepweq/sql/new`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-amber-700 underline text-xs"
                      >
                        Ouvrir l'éditeur SQL Supabase
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="text-xs bg-slate-900 text-slate-300 p-4 rounded-xl overflow-auto max-h-48 leading-relaxed">
                      {MIGRATION_SQL.slice(0, 500)}...
                    </pre>
                    <button
                      onClick={copySQL}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copier tout le SQL
                    </button>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button variant="teal" loading={checking} onClick={checkTables}>
                      <Database className="w-4 h-4" />
                      Vérifier la connexion
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Demo data */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-[#0D1B2A] text-white' : 'bg-slate-100 text-slate-400'}`}>
                2
              </div>
              <div>
                <h2 className={`font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>Charger les données de démonstration</h2>
                <p className="text-sm text-slate-500">3 médecins, 5 agents et 3 rejets (un par file)</p>
              </div>
            </div>

            {step >= 1 && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: <Users className="w-4 h-4" />, label: '5 agents', desc: 'Gérant, manageuse, 3 agents', color: 'bg-blue-50 border-blue-200' },
                    { icon: <Database className="w-4 h-4" />, label: '3 médecins', desc: 'Doctolib, Medistory, Maiia', color: 'bg-violet-50 border-violet-200' },
                    { icon: <Play className="w-4 h-4" />, label: '3 rejets', desc: 'File A, B et C', color: 'bg-emerald-50 border-emerald-200' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-xl border ${item.color} text-center`}>
                      <div className="flex justify-center text-slate-600 mb-1">{item.icon}</div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <Button
                  variant="teal"
                  size="lg"
                  loading={loadingDemo}
                  onClick={loadDemo}
                  className="w-full"
                >
                  <Play className="w-4 h-4" />
                  Charger les données de démo
                </Button>

                <button
                  onClick={() => { onComplete(); navigate('/login') }}
                  className="w-full mt-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Passer — commencer sans données de démo
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Supabase : awyrojlanodjnuoepweq.supabase.co
        </p>
      </div>
    </div>
  )
}
