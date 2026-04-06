-- ═══════════════════════════════════════════════════════════════
-- SIMPACT ERP — Politiques RLS Supabase (v2)
-- À exécuter dans : Supabase Dashboard → SQL Editor
--
-- IMPORTANT : SIMPACT utilise sa propre table `utilisateurs` pour
-- l'authentification — PAS Supabase Auth. auth.uid() est donc
-- toujours NULL. Les politiques ci-dessous accordent l'accès via
-- la clé anon (outil ERP interne, accès restreint par login SIMPACT).
-- ═══════════════════════════════════════════════════════════════

-- ── TABLE clients ────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "acces_client_propre" ON clients;

-- Accès complet via clé anon (ERP interne)
CREATE POLICY "clients_full_anon" ON clients
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE commandes ───────────────────────────────────────────────
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acces_commandes_client" ON commandes;

CREATE POLICY "commandes_full_anon" ON commandes
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE commande_timeline ───────────────────────────────────────
ALTER TABLE commande_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeline_full_anon" ON commande_timeline;

CREATE POLICY "timeline_full_anon" ON commande_timeline
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE commande_messages ───────────────────────────────────────
ALTER TABLE commande_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_full_anon" ON commande_messages;

CREATE POLICY "messages_full_anon" ON commande_messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE stock ────────────────────────────────────────────────────
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_seulement_stock" ON stock;

CREATE POLICY "stock_full_anon" ON stock
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE stock_movements ─────────────────────────────────────────
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_full_anon" ON stock_movements;

CREATE POLICY "stock_movements_full_anon" ON stock_movements
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE params_couts ─────────────────────────────────────────────
ALTER TABLE params_couts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_seulement_params" ON params_couts;

CREATE POLICY "params_full_anon" ON params_couts
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ── TABLE utilisateurs ─────────────────────────────────────────────
-- Lecture autorisée (pour login), écriture réservée au service_role
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_seulement_utilisateurs" ON utilisateurs;

CREATE POLICY "utilisateurs_read_anon" ON utilisateurs
  FOR SELECT TO anon
  USING (true);

-- INSERT/UPDATE/DELETE uniquement via service_role (dashboard Supabase)
CREATE POLICY "utilisateurs_write_service" ON utilisateurs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── TABLE messages (messagerie interne) ────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_inbox_full_anon" ON messages;

CREATE POLICY "messages_inbox_full_anon" ON messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
