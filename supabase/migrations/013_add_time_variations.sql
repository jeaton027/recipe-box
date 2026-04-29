-- Allow for prep and cook time variation
-- Add x_time_minutes_max to support serving ranges like "8-12 servings"
ALTER TABLE recipes
  ADD COLUMN prep_time_minutes_max INTEGER,
  ADD COLUMN cook_time_minutes_max INTEGER;