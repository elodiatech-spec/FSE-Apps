-- ============================================================
-- ElodiaTech FSE — Migration 005 : Base de codes erreurs gérable
-- ============================================================
-- Sort la base de connaissance des codes NOEMIE du code "en dur"
-- vers une table éditable par le gérant (sans redéploiement).
-- ============================================================

CREATE TABLE IF NOT EXISTS codes_erreur (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL,
  famille TEXT NOT NULL CHECK (famille IN ('droits_adri','cotation','parametrage','caisse','amc_dre')),
  voie TEXT NOT NULL CHECK (voie IN ('auto','agent','medecin')),
  confiance NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  diagnostic TEXT,
  procedure JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('defaut','manuel','ia')),
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_codes_erreur()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS codes_erreur_touch ON codes_erreur;
CREATE TRIGGER codes_erreur_touch BEFORE UPDATE ON codes_erreur
  FOR EACH ROW EXECUTE FUNCTION touch_codes_erreur();

-- RLS : lecture par tout utilisateur connecté, écriture réservée au gérant
ALTER TABLE codes_erreur ENABLE ROW LEVEL SECURITY;

CREATE POLICY codes_select ON codes_erreur FOR SELECT TO authenticated USING (true);
CREATE POLICY codes_insert ON codes_erreur FOR INSERT TO authenticated
  WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY codes_update ON codes_erreur FOR UPDATE TO authenticated
  USING (elodia_current_role() = 'gerant') WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY codes_delete ON codes_erreur FOR DELETE TO authenticated
  USING (elodia_current_role() = 'gerant');
