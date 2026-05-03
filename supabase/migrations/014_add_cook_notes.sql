-- Per-user running journal kept while cooking. Distinct from `notes`
-- (recipe author/source notes) — `cook_notes` is the user's own
-- adjustments, lessons, "next time" thoughts. Edited from Cook Mode
-- (bottom-sheet pencil button) and from the detail page (Cook's Notes
-- section between Notes and Related). Auto-saved with debounce.

ALTER TABLE public.recipes
  ADD COLUMN cook_notes text;
