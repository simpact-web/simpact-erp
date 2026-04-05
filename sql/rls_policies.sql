-- ═══════════════════════════════════════════════════════════════
-- SIMPACT ERP — Politiques RLS Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- TABLE clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_client_propre" ON clients
  FOR ALL
  USING (
    auth.uid()::text = user_id
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- TABLE commandes
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_commandes_client" ON commandes
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- TABLE utilisateurs (admin uniquement)
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_seulement_utilisateurs" ON utilisateurs
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- TABLE params_couts (admin uniquement)
ALTER TABLE params_couts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_seulement_params" ON params_couts
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- TABLE stock
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_seulement_stock" ON stock
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');
