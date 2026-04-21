-- last_cooked_at: implicit signal of "I'm actually making this right now."
-- Stamped whenever the user enters Cook Mode for a recipe. Powers the
-- "Recently Made" section on the homepage.
--
-- Semantics:
--   - NULL → user has never entered cook mode for this recipe
--   - timestamp → most recent cook mode entry
--
-- Distinct from the status column's 'tried' value, which is user-curated
-- ("I want to remember I've made this"). Recently made is automatic.

ALTER TABLE recipes ADD COLUMN last_cooked_at timestamptz;

CREATE INDEX recipes_last_cooked_at_idx
  ON recipes (last_cooked_at DESC NULLS LAST)
  WHERE last_cooked_at IS NOT NULL;
