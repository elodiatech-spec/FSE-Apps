-- ============================================================
-- ElodiaTech FSE — Migration 004 : ACTIVER RLS (correctif sécurité)
-- ============================================================
-- La RLS n'était pas réellement active : les policies de la migration 003
-- étaient ignorées et la clé publique (anon) pouvait tout lire.
-- On l'active explicitement. anon n'aura alors aucune policy => 0 ligne.
-- (On NE révoque PAS les droits de table : sinon les requêtes renverraient
--  une erreur au lieu d'un résultat vide, ce qui casserait l'écran d'accueil.)
-- ============================================================

ALTER TABLE agents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE medecins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejets_fse            ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturation           ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions_manageuse ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Après : anon ne voit plus aucune donnée (0 ligne, sans erreur).
-- Les utilisateurs connectés conservent l'accès défini en migration 003.
-- L'espace médecin passe par /api/medecin-portal (clé service, hors RLS).
-- ============================================================
