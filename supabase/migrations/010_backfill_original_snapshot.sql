-- Backfill original_snapshot for every recipe created before the feature
-- shipped. The snapshot is built from the recipe's current state, so for old
-- recipes it represents "the recipe as it existed at backfill time" rather than
-- a true capture of the source. That's the best we can do retroactively.
--
-- captured_at uses created_at (not now()) so the UI shows a date that matches
-- when the user actually saved the recipe — reads better than "Locked today".
--
-- source is inferred: recipes with a source_url are marked 'url_import';
-- the rest are 'manual'. We don't have enough info to distinguish variation
-- copies retroactively, and it doesn't matter much for display.

UPDATE recipes r
SET original_snapshot = jsonb_build_object(
  'captured_at', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'source', CASE WHEN r.source_url IS NOT NULL AND r.source_url <> '' THEN 'url_import' ELSE 'manual' END,
  'source_url', r.source_url,
  'title', r.title,
  'description', r.description,
  'servings', r.servings,
  'servings_max', r.servings_max,
  'servings_type', r.servings_type,
  'prep_time_minutes', r.prep_time_minutes,
  'cook_time_minutes', r.cook_time_minutes,
  'notes', r.notes,
  'ingredients', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', i.name,
          'quantity', i.quantity,
          'quantity_max', i.quantity_max,
          'unit', i.unit,
          'sort_order', i.sort_order
        )
        ORDER BY i.sort_order
      )
      FROM ingredients i
      WHERE i.recipe_id = r.id
    ),
    '[]'::jsonb
  ),
  'steps', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'instruction', s.instruction,
          'sort_order', s.sort_order
        )
        ORDER BY s.sort_order
      )
      FROM steps s
      WHERE s.recipe_id = r.id
    ),
    '[]'::jsonb
  )
)
WHERE r.original_snapshot IS NULL;
