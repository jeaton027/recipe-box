-- Recipe variations: group related recipes under a shared family_id
-- Each variation is a full standalone recipe with its own slug, tags, etc.
-- They're linked via family_id.
-- variant_label is an optional short display label shown only in sibling
-- pills/dropdowns on the recipe detail page (falls back to title if unset).

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS variant_label text;

-- Index for fast sibling lookup
CREATE INDEX IF NOT EXISTS recipes_family_id_idx ON recipes(family_id) WHERE family_id IS NOT NULL;
