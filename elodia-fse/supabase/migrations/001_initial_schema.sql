-- ============================================================
-- ElodiaTech FSE — Schéma initial
-- ============================================================

-- Table agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('gerant', 'manageuse', 'agent')),
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table medecins
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

-- Table rejets_fse
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rejets_fse_updated_at
  BEFORE UPDATE ON rejets_fse
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table facturation
CREATE TABLE IF NOT EXISTS facturation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode TEXT NOT NULL,  -- format YYYY-MM
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

-- Table commissions_manageuse
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

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medecins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejets_fse ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturation ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions_manageuse ENABLE ROW LEVEL SECURITY;

-- Policies: allow all authenticated users to read/write
CREATE POLICY "agents_all" ON agents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "medecins_all" ON medecins FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rejets_all" ON rejets_fse FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "facturation_all" ON facturation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "commissions_all" ON commissions_manageuse FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read for demo mode
CREATE POLICY "agents_anon_read" ON agents FOR SELECT TO anon USING (true);
CREATE POLICY "medecins_anon_read" ON medecins FOR SELECT TO anon USING (true);
CREATE POLICY "rejets_anon_read" ON rejets_fse FOR SELECT TO anon USING (true);
CREATE POLICY "facturation_anon_read" ON facturation FOR SELECT TO anon USING (true);
CREATE POLICY "commissions_anon_read" ON commissions_manageuse FOR SELECT TO anon USING (true);

-- Allow anon writes for demo
CREATE POLICY "agents_anon_write" ON agents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "medecins_anon_write" ON medecins FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rejets_anon_write" ON rejets_fse FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rejets_anon_update" ON rejets_fse FOR UPDATE TO anon USING (true) WITH CHECK (true);
