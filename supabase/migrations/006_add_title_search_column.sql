-- Add a generated column that stores a normalized, search-friendly version of the title.
-- Strips all punctuation and lowercases, so "Martin's Bagels" becomes "martins bagels".
-- Postgres auto-computes this on every insert/update — no app code changes needed.

ALTER TABLE recipes ADD COLUMN title_search text
  GENERATED ALWAYS AS (
    lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'))
  ) STORED;
