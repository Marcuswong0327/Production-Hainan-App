-- Admin-managed association options used in Add Student dropdown.

CREATE TABLE IF NOT EXISTS association_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT association_options_label_unique UNIQUE (label)
);

CREATE INDEX IF NOT EXISTS idx_association_options_sort ON association_options (sort_order, label);

ALTER TABLE association_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "association_options_select"
  ON association_options FOR SELECT
  USING (true);

CREATE POLICY "association_options_insert"
  ON association_options FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "association_options_update"
  ON association_options FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "association_options_delete"
  ON association_options FOR DELETE TO authenticated
  USING (true);

INSERT INTO association_options (label, sort_order) VALUES
  ('Selangor Hainan Association', 10),
  ('Kuala Lumpur Hainan Association', 20),
  ('Perak Hainan Association', 30)
ON CONFLICT (label) DO NOTHING;
