-- ═══════════════════════════════════════════════════════════════
--  SIMPACT ERP — Seed : Clients & Comptes portail (mars 2026)
--  À exécuter dans : Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Clients ────────────────────────────────────────────────
INSERT INTO clients (id, name, sector, remise)
VALUES
  ('c-ubci',      'UBCI',              'Banque',    0),
  ('c-attijari',  'Attijari',          'Banque',    0),
  ('c-atb',       'ATB bank',          'Banque',    0),
  ('c-amen',      'Amen Bank',         'Banque',    0),
  ('c-biat',      'BIAT',              'Banque',    0),
  ('c-zitouna',   'Zitouna Bank',      'Banque',    0),
  ('c-btk',       'BTK Bank',          'Banque',    0),
  ('c-qnb',       'QNB Bank',          'Banque',    0),
  ('c-tsb',       'TSB Bank',          'Banque',    0),
  ('c-bte',       'BTE Bank',          'Banque',    0),
  ('c-bt',        'BT Bank',           'Banque',    0),
  ('c-star',      'STAR',              'Assurance', 0),
  ('c-astree',    'Astree',            'Assurance', 0),
  ('c-comar',     'Comar',             'Assurance', 0),
  ('c-carte',     'La Carte',          'Assurance', 0),
  ('c-gat',       'GAT Assurance',     'Assurance', 0),
  ('c-maghrebia', 'Maghrebia',         'Assurance', 0),
  ('c-biatassur', 'Biat Assurance',    'Assurance', 0),
  ('c-lloyd',     'Lloyd Assurances',  'Assurance', 0),
  ('c-mae',       'MAE Assurance',     'Assurance', 0),
  ('c-takaful',   'Zitouna Takaful',   'Assurance', 0),
  ('c-takafulia', 'At-Takafulia',      'Assurance', 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Comptes portail (utilisateurs) ─────────────────────────
INSERT INTO utilisateurs (id, username, password, name, role, avatar, email, permissions, client_id)
VALUES
  ('u-ubci',      'ubci',      'ubci2026',      'UBCI',             'client', 'UB', '', '["client-portal"]', 'c-ubci'),
  ('u-attijari',  'attijari',  'attijari2026',  'Attijari',         'client', 'AT', '', '["client-portal"]', 'c-attijari'),
  ('u-atb',       'atb',       'atb2026',       'ATB bank',         'client', 'AT', '', '["client-portal"]', 'c-atb'),
  ('u-amen',      'amen',      'amen2026',      'Amen Bank',        'client', 'AM', '', '["client-portal"]', 'c-amen'),
  ('u-biat',      'biat',      'biat2026',      'BIAT',             'client', 'BI', '', '["client-portal"]', 'c-biat'),
  ('u-zitouna',   'zitouna',   'zitouna2026',   'Zitouna Bank',     'client', 'ZI', '', '["client-portal"]', 'c-zitouna'),
  ('u-btk',       'btk',       'btk2026',       'BTK Bank',         'client', 'BT', '', '["client-portal"]', 'c-btk'),
  ('u-qnb',       'qnb',       'qnb2026',       'QNB Bank',         'client', 'QN', '', '["client-portal"]', 'c-qnb'),
  ('u-tsb',       'tsb',       'tsb2026',       'TSB Bank',         'client', 'TS', '', '["client-portal"]', 'c-tsb'),
  ('u-bte',       'bte',       'bte2026',       'BTE Bank',         'client', 'BT', '', '["client-portal"]', 'c-bte'),
  ('u-bt',        'bt',        'bt2026',        'BT Bank',          'client', 'BT', '', '["client-portal"]', 'c-bt'),
  ('u-star',      'star',      'star2026',      'STAR',             'client', 'ST', '', '["client-portal"]', 'c-star'),
  ('u-astree',    'astree',    'astree2026',    'Astree',           'client', 'AS', '', '["client-portal"]', 'c-astree'),
  ('u-comar',     'comar2026', 'comar2026',     'Comar',            'client', 'CO', '', '["client-portal"]', 'c-comar'),
  ('u-carte',     'carte',     'carte2026',     'La Carte',         'client', 'LC', '', '["client-portal"]', 'c-carte'),
  ('u-gat',       'gat',       'gat2026',       'GAT Assurance',    'client', 'GA', '', '["client-portal"]', 'c-gat'),
  ('u-maghrebia', 'maghrebia', 'maghrebia2026', 'Maghrebia',        'client', 'MA', '', '["client-portal"]', 'c-maghrebia'),
  ('u-biatassur', 'biatassur', 'biatassur2026', 'Biat Assurance',   'client', 'BA', '', '["client-portal"]', 'c-biatassur'),
  ('u-lloyd',     'lloyd',     'lloyd2026',     'Lloyd Assurances', 'client', 'LL', '', '["client-portal"]', 'c-lloyd'),
  ('u-mae',       'mae',       'mae2026',       'MAE Assurance',    'client', 'MA', '', '["client-portal"]', 'c-mae'),
  ('u-takaful',   'takaful',   'takaful2026',   'Zitouna Takaful',  'client', 'ZT', '', '["client-portal"]', 'c-takaful'),
  ('u-takafulia', 'takafulia', 'takafulia2026', 'At-Takafulia',     'client', 'AT', '', '["client-portal"]', 'c-takafulia')
ON CONFLICT (id) DO NOTHING;
