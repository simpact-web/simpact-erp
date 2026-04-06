-- ═══════════════════════════════════════════════════════════════
-- SIMPACT ERP — Migration : boutiques privées par client
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Ajouter les colonnes de configuration boutique à la table clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS produits_autorises jsonb
    DEFAULT '["cdv","fly","bro","aff","ent","dep","liv","off"]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS couleur text DEFAULT '#4a9fd4';

-- Mettre à jour les couleurs de marque pour les clients existants
-- selon le secteur (valeur par défaut si couleur non renseignée)
UPDATE clients SET couleur = CASE
  WHEN name ILIKE '%amen%'      THEN '#1B5E20'
  WHEN name ILIKE '%attijari%'  THEN '#EE3524'
  WHEN name ILIKE '%biat%'      THEN '#004A7F'
  WHEN name ILIKE '%astree%' OR name ILIKE '%astrée%' THEN '#003087'
  WHEN name ILIKE '%atb%'       THEN '#0066CC'
  WHEN name ILIKE '%btk%'       THEN '#009639'
  WHEN name ILIKE '%bte%'       THEN '#003366'
  WHEN name ILIKE '%bt bank%'   THEN '#006699'
  WHEN name ILIKE '%qnb%'       THEN '#AE1C1F'
  WHEN name ILIKE '%tsb%'       THEN '#005B8E'
  WHEN name ILIKE '%uib%'       THEN '#003087'
  WHEN name ILIKE '%carte%'     THEN '#003366'
  WHEN name ILIKE '%comar%'     THEN '#E31837'
  WHEN name ILIKE '%gat%'       THEN '#005B8E'
  WHEN name ILIKE '%lloyd%'     THEN '#003366'
  WHEN name ILIKE '%mae%'       THEN '#009B3A'
  WHEN name ILIKE '%maghrebia%' THEN '#005B8E'
  WHEN name ILIKE '%star%'      THEN '#003087'
  WHEN name ILIKE '%takaful%'   THEN '#2E7D32'
  WHEN name ILIKE '%zitouna%'   THEN '#1B5E20'
  WHEN sector = 'Banque'        THEN '#004A7F'
  WHEN sector = 'Assurance'     THEN '#2E7D32'
  ELSE '#4a9fd4'
END
WHERE couleur IS NULL OR couleur = '#4a9fd4';
