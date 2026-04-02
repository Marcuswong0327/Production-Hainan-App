-- Admin-managed guarantor relationship labels for study loan flows (dropdown + edit UI).

CREATE TABLE IF NOT EXISTS guarantor_relationship_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guarantor_relationship_options_label_unique UNIQUE (label)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_relationship_options_sort ON guarantor_relationship_options (sort_order, label);

ALTER TABLE guarantor_relationship_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guarantor_relationship_options_select"
  ON guarantor_relationship_options FOR SELECT
  USING (true);

CREATE POLICY "guarantor_relationship_options_insert"
  ON guarantor_relationship_options FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "guarantor_relationship_options_update"
  ON guarantor_relationship_options FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "guarantor_relationship_options_delete"
  ON guarantor_relationship_options FOR DELETE TO authenticated
  USING (true);

INSERT INTO guarantor_relationship_options (label, sort_order) VALUES
  ('Dad (父亲)', 10),
  ('Mom (母亲)', 20),
  ('Uncle (叔叔/舅舅)', 30),
  ('Aunty (阿姨/姑姑)', 40),
  ('Brother (兄弟)', 50),
  ('Sister (姐妹)', 60),
  ('Other (其他)', 70)
ON CONFLICT (label) DO NOTHING;
