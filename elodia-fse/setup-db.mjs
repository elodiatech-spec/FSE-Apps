/**
 * ElodiaTech FSE — Script d'initialisation de la base Supabase
 *
 * Usage: node setup-db.mjs [SERVICE_ROLE_KEY]
 *
 * Si vous n'avez pas la clé service_role, exécutez le SQL manuellement
 * dans l'éditeur SQL de votre dashboard Supabase :
 * https://app.supabase.com/project/awyrojlanodjnuoepweq/sql/new
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://awyrojlanodjnuoepweq.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(`
❌ Clé service_role manquante.

Usage: node setup-db.mjs <SERVICE_ROLE_KEY>

Ou définissez la variable d'environnement:
  export SUPABASE_SERVICE_ROLE_KEY=your_key
  node setup-db.mjs

Vous pouvez trouver votre clé service_role dans:
  Supabase Dashboard → Settings → API → service_role (secret)
`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SQL = `
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

ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE medecins DISABLE ROW LEVEL SECURITY;
ALTER TABLE rejets_fse DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturation DISABLE ROW LEVEL SECURITY;
ALTER TABLE commissions_manageuse DISABLE ROW LEVEL SECURITY;
`

async function main() {
  console.log('🚀 ElodiaTech FSE — Initialisation de la base de données\n')

  // Apply SQL via Management API
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: SQL }),
  })

  if (!res.ok) {
    // Try via pg directly if Management API not available
    console.log('⚠️  API SQL non disponible. Tentative via Supabase REST...')

    // Check if tables exist
    const { error } = await supabase.from('agents').select('id').limit(1)
    if (!error) {
      console.log('✅ Tables déjà créées !')
    } else {
      console.error(`
❌ Impossible de créer les tables automatiquement.

Veuillez exécuter le SQL manuellement dans :
https://app.supabase.com/project/awyrojlanodjnuoepweq/sql/new

Le SQL se trouve dans : supabase/migrations/001_initial_schema.sql
`)
      process.exit(1)
    }
  } else {
    console.log('✅ Tables créées avec succès !')
  }

  // Create demo auth users
  console.log('\n👥 Création des utilisateurs de démo...')
  const demoUsers = [
    { email: 'gerant@elodiatech.com', password: 'demo123456' },
    { email: 'manageuse@elodiatech.com', password: 'demo123456' },
    { email: 'agent1@elodiatech.com', password: 'demo123456' },
    { email: 'agent2@elodiatech.com', password: 'demo123456' },
    { email: 'agent3@elodiatech.com', password: 'demo123456' },
  ]

  for (const u of demoUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })
    if (!error) console.log(`  ✅ ${u.email}`)
    else if (error.message.includes('already')) console.log(`  ℹ️  ${u.email} (déjà existant)`)
    else console.log(`  ⚠️  ${u.email}: ${error.message}`)
  }

  // Insert demo data
  console.log('\n📊 Chargement des données de démo...')

  const agents = [
    { nom: 'MARTIN', prenom: 'Frédéric', email: 'gerant@elodiatech.com', role: 'gerant', actif: true },
    { nom: 'JOSEPH', prenom: 'Marie', email: 'manageuse@elodiatech.com', role: 'manageuse', actif: true },
    { nom: 'DURAND', prenom: 'Jean', email: 'agent1@elodiatech.com', role: 'agent', actif: true },
    { nom: 'PIERRE', prenom: 'Sophie', email: 'agent2@elodiatech.com', role: 'agent', actif: true },
    { nom: 'ROSEAU', prenom: 'Patrick', email: 'agent3@elodiatech.com', role: 'agent', actif: true },
  ]

  const { data: insertedAgents, error: ae } = await supabase.from('agents').upsert(agents, { onConflict: 'email' }).select()
  if (ae) { console.error('Erreur agents:', ae.message); process.exit(1) }
  console.log('  ✅ 5 agents insérés')

  const manageuse = insertedAgents.find(a => a.role === 'manageuse')
  const agent = insertedAgents.find(a => a.prenom === 'Jean')

  const medecins = [
    { code_elodiatech: 'ET-001', nom_cabinet: 'Cabinet du Dr BELLECOUR', nom_medecin: 'Dr Sophie BELLECOUR', logiciel: 'doctolib', offre: 'zen_fse', date_souscription: '2025-01-15', quota_zen: 40, tranche_pass_recup: null, statut_cpe: 'actif', date_expiration_cpe: '2027-01-15', adresse_mssante: 'sophie.bellecour@medecin.mssante.fr', email: 'contact@cabinet-bellecour.re', actif: true },
    { code_elodiatech: 'ET-002', nom_cabinet: 'Médecine Générale Fort-de-France', nom_medecin: 'Dr Marc DUVALIER', logiciel: 'medistory', offre: 'liberty_fse', date_souscription: '2025-03-01', quota_zen: null, tranche_pass_recup: null, statut_cpe: 'expirant', date_expiration_cpe: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0], adresse_mssante: 'marc.duvalier@medecin.mssante.fr', email: 'duvalier.medecin@gmail.com', actif: true },
    { code_elodiatech: 'ET-003', nom_cabinet: 'Polyclinique du Lamentin', nom_medecin: 'Dr Isabelle CELESTE', logiciel: 'maiia', offre: 'pass_recup', date_souscription: '2024-11-01', quota_zen: null, tranche_pass_recup: 18000, statut_cpe: 'en_attente', date_expiration_cpe: null, adresse_mssante: null, email: 'celeste@polyclinique-lamentin.fr', actif: true },
  ]

  const { data: insertedMedecins, error: me } = await supabase.from('medecins').upsert(medecins, { onConflict: 'code_elodiatech' }).select()
  if (me) { console.error('Erreur médecins:', me.message); process.exit(1) }
  console.log('  ✅ 3 médecins insérés')

  const [med1, med2, med3] = insertedMedecins

  const rejets = [
    { id_fse: 'FSE-2026-001234', date_rejet: '2026-06-01', medecin_id: med1.id, logiciel_source: 'doctolib', code_erreur: '1101', libelle_erreur: 'Droits AMO expirés', famille_rejet: 'droits_adri', niveau_rejet: 'fse', part_concernee: 'amo', montant_fse: 250, agent_id: agent?.id, statut: 'en_attente', voie_traitement: 'auto', fichier_valide: false, ticket_correction: { famille: 'droits_adri', diagnostic: 'Droits AMO expirés.', procedure: ['Vérifier ADRi', 'Mettre à jour Vitale', 'Retransmettre'], voie: 'auto', confiance: 0.95 } },
    { id_fse: 'FSE-2026-001235', date_rejet: '2026-06-02', medecin_id: med2.id, logiciel_source: 'medistory', code_erreur: '2203', libelle_erreur: 'Code CCAM incompatible', famille_rejet: 'cotation', niveau_rejet: 'acte', part_concernee: 'amo', montant_fse: 180.50, agent_id: agent?.id, statut: 'en_cours', voie_traitement: 'agent', fichier_valide: false, ticket_correction: { famille: 'cotation', diagnostic: 'Acte CCAM incompatible.', procedure: ['Valider CCAM', 'Corriger avec accord'], voie: 'agent', confiance: 0.78 } },
    { id_fse: 'FSE-2026-001236', date_rejet: '2026-06-03', medecin_id: med3.id, logiciel_source: 'maiia', code_erreur: '3301', libelle_erreur: 'RPPS prescripteur absent', famille_rejet: 'parametrage', niveau_rejet: 'lot', part_concernee: 'amo', montant_fse: 520.75, agent_id: null, statut: 'escalade_medecin', voie_traitement: 'medecin', fichier_valide: false, ticket_correction: { famille: 'parametrage', diagnostic: 'RPPS absent.', procedure: ['Contacter médecin', 'Corriger RPPS'], voie: 'medecin', confiance: 0.88 } },
  ]
  await supabase.from('rejets_fse').insert(rejets)
  console.log('  ✅ 3 rejets insérés (File A, B, C)')

  if (manageuse) {
    await supabase.from('commissions_manageuse').insert([
      { periode: '2026-04', manageuse_id: manageuse.id, nb_rejets_manageuse: 22, montant_facture_manageuse: 980, montant_facture_agents: 3200, statut_paiement: 'payé' },
      { periode: '2026-05', manageuse_id: manageuse.id, nb_rejets_manageuse: 28, montant_facture_manageuse: 1250, montant_facture_agents: 4100, statut_paiement: 'en_attente' },
      { periode: '2026-06', manageuse_id: manageuse.id, nb_rejets_manageuse: 15, montant_facture_manageuse: 680, montant_facture_agents: 2300, statut_paiement: 'en_attente' },
    ])
    console.log('  ✅ Commissions manageuse insérées')
  }

  await supabase.from('facturation').insert([
    { periode: '2026-05', medecin_id: med1.id, offre: 'zen_fse', nb_rejets_traites: 42, montant_base: 99, nb_tranches_depassement: 1, montant_depassement: 40, montant_recupere: 1850, taux_commission: 0, montant_commission: 0, frais_dossier: 0, total_facture: 139, statut_paiement: 'payé' },
    { periode: '2026-05', medecin_id: med2.id, offre: 'liberty_fse', nb_rejets_traites: 18, montant_base: 0, nb_tranches_depassement: 0, montant_depassement: 0, montant_recupere: 2400, taux_commission: 0.12, montant_commission: 288, frais_dossier: 50, total_facture: 338, statut_paiement: 'en_attente' },
    { periode: '2026-05', medecin_id: med3.id, offre: 'pass_recup', nb_rejets_traites: 25, montant_base: 0, nb_tranches_depassement: 0, montant_depassement: 0, montant_recupere: 3200, taux_commission: 0.10, montant_commission: 320, frais_dossier: 99, total_facture: 419, statut_paiement: 'en_attente' },
  ])
  console.log('  ✅ Facturation insérée')

  console.log(`
✅ Initialisation terminée !

Comptes de démo :
  📧 gerant@elodiatech.com  (mot de passe: demo123456)
  📧 manageuse@elodiatech.com (mot de passe: demo123456)
  📧 agent1@elodiatech.com  (mot de passe: demo123456)

🌐 Application : http://localhost:3000
`)
}

main().catch(console.error)
