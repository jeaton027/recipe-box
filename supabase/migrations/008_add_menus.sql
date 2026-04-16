-- Menus feature: menus + menu_recipes tables

-- Course type enum
CREATE TYPE course_type AS ENUM ('main', 'side', 'starter', 'drink', 'dessert', 'other');

-- Menus table
CREATE TABLE menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  cover_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own menus" ON menus
  FOR ALL USING (auth.uid() = user_id);

-- Junction table (PK enforces no duplicate recipe per menu)
CREATE TABLE menu_recipes (
  menu_id uuid REFERENCES menus ON DELETE CASCADE,
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  course course_type NOT NULL DEFAULT 'main',
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_id, recipe_id)
);

ALTER TABLE menu_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own menu recipes" ON menu_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM menus WHERE menus.id = menu_id AND menus.user_id = auth.uid())
  );
