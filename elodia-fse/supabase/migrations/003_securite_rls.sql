-- ============================================================
-- ElodiaTech FSE — Migration 003 : Sécurisation RLS
-- ============================================================
-- Objectif :
--   1. SUPPRIMER tout accès du rôle "anon" (clé publique) — fuite de données.
--      L'espace médecin passe désormais par la fonction serveur /api/medecin-portal
--      (clé service, ne renvoie que les données du médecin concerné).
--   2. Restreindre les écritures sensibles (facturation, commissions) au gérant.
-- ============================================================

-- ── 1. Supprimer toutes les anciennes policies (trop permissives) ─────────────
DROP POLICY IF EXISTS agents_all ON agents;
DROP POLICY IF EXISTS medecins_all ON medecins;
DROP POLICY IF EXISTS rejets_all ON rejets_fse;
DROP POLICY IF EXISTS facturation_all ON facturation;
DROP POLICY IF EXISTS commissions_all ON commissions_manageuse;

DROP POLICY IF EXISTS agents_anon_read ON agents;
DROP POLICY IF EXISTS medecins_anon_read ON medecins;
DROP POLICY IF EXISTS rejets_anon_read ON rejets_fse;
DROP POLICY IF EXISTS facturation_anon_read ON facturation;
DROP POLICY IF EXISTS commissions_anon_read ON commissions_manageuse;

DROP POLICY IF EXISTS agents_anon_write ON agents;
DROP POLICY IF EXISTS medecins_anon_write ON medecins;
DROP POLICY IF EXISTS rejets_anon_write ON rejets_fse;
DROP POLICY IF EXISTS rejets_anon_update ON rejets_fse;

-- ── 2. Fonction helper : rôle de l'utilisateur connecté (par email) ───────────
-- SECURITY DEFINER pour éviter la récursion RLS sur la table agents.
CREATE OR REPLACE FUNCTION public.elodia_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.agents
  WHERE email = (auth.jwt() ->> 'email') AND actif = true
  LIMIT 1
$$;

-- ── 3. Nouvelles policies : UNIQUEMENT pour les utilisateurs authentifiés ─────
-- (aucune policy "anon" => le rôle anon n'a plus AUCUN accès)

-- AGENTS : lecture + écriture par tout utilisateur connecté
-- (l'écriture reste ouverte pour ne pas casser la création de compte agent)
CREATE POLICY agents_rw ON agents FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- MEDECINS : lecture + écriture par tout utilisateur connecté (géré dans l'app)
CREATE POLICY medecins_rw ON medecins FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- REJETS_FSE : lecture + écriture (ingestion + traitement par les agents)
CREATE POLICY rejets_rw ON rejets_fse FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- FACTURATION : lecture pour tous les connectés, écriture réservée au gérant
CREATE POLICY facturation_select ON facturation FOR SELECT TO authenticated
  USING (true);
CREATE POLICY facturation_insert ON facturation FOR INSERT TO authenticated
  WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY facturation_update ON facturation FOR UPDATE TO authenticated
  USING (elodia_current_role() = 'gerant') WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY facturation_delete ON facturation FOR DELETE TO authenticated
  USING (elodia_current_role() = 'gerant');

-- COMMISSIONS : lecture pour tous les connectés, écriture réservée au gérant
CREATE POLICY commissions_select ON commissions_manageuse FOR SELECT TO authenticated
  USING (true);
CREATE POLICY commissions_insert ON commissions_manageuse FOR INSERT TO authenticated
  WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY commissions_update ON commissions_manageuse FOR UPDATE TO authenticated
  USING (elodia_current_role() = 'gerant') WITH CHECK (elodia_current_role() = 'gerant');
CREATE POLICY commissions_delete ON commissions_manageuse FOR DELETE TO authenticated
  USING (elodia_current_role() = 'gerant');

-- ============================================================
-- Après cette migration :
--   - La clé publique (anon) ne peut PLUS lire ni écrire aucune donnée.
--   - L'app (utilisateurs connectés) fonctionne normalement.
--   - L'espace médecin public lit ses données via /api/medecin-portal (clé service).
-- ============================================================
