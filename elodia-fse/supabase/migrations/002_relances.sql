-- ============================================================
-- ElodiaTech FSE — Migration 002 : Suivi relances File C
-- ============================================================

-- Ajouter les colonnes de suivi relances à rejets_fse
ALTER TABLE rejets_fse
  ADD COLUMN IF NOT EXISTS nb_relances INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS derniere_relance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut_change_at TIMESTAMPTZ;

-- Trigger pour tracer automatiquement la date de changement de statut
CREATE OR REPLACE FUNCTION trace_statut_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    NEW.statut_change_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rejets_fse_statut_change ON rejets_fse;
CREATE TRIGGER rejets_fse_statut_change
  BEFORE UPDATE ON rejets_fse
  FOR EACH ROW EXECUTE FUNCTION trace_statut_change();

-- Initialiser statut_change_at pour les rejets existants
UPDATE rejets_fse
SET statut_change_at = updated_at
WHERE statut_change_at IS NULL;
