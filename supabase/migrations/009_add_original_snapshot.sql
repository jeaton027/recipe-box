-- Original snapshot: immutable JSON copy of the recipe at a chosen moment.
-- Captured either manually via "Lock as Original" on the Add Recipe page,
-- or automatically on first save if the user never clicked it. Never updated
-- after the initial write — read-only reference material.
--
-- Shape (see src/lib/types/database.ts OriginalSnapshot for the TS contract):
-- {
--   captured_at: ISO timestamp,
--   source: 'url_import' | 'variation_copy' | 'manual',
--   source_url: string | null,
--   title, description, servings, servings_type,
--   prep_time_minutes, cook_time_minutes, notes,
--   ingredients: [{ name, quantity, unit, sort_order, ... }],
--   steps: [{ instruction, sort_order }]
-- }

ALTER TABLE recipes ADD COLUMN original_snapshot jsonb;
