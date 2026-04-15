-- Add servings_max to support serving ranges like "8-12 servings"
ALTER TABLE recipes ADD COLUMN servings_max integer;
