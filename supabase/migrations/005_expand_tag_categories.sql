-- Expand tag categories: add ingredient, dish_type, baked_goods
-- and new tags within existing + new categories.

-- 1. Drop the existing check constraint and add expanded one
alter table public.tags drop constraint if exists tags_category_check;
alter table public.tags add constraint tags_category_check
  check (category in (
    'meal_type', 'season', 'cuisine', 'dietary', 'method', 'occasion',
    'ingredient', 'dish_type', 'baked_goods', 'custom'
  ));

-- 2. Update the seed function with the full tag set
create or replace function public.seed_default_tags(p_user_id uuid)
returns void as $$
begin
  insert into public.tags (user_id, name, category) values
    -- Meal Type
    (p_user_id, 'Appetizers', 'meal_type'),
    (p_user_id, 'Breakfast', 'meal_type'),
    (p_user_id, 'Desserts', 'meal_type'),
    (p_user_id, 'Dinner', 'meal_type'),
    (p_user_id, 'Drinks', 'meal_type'),
    (p_user_id, 'Lunch', 'meal_type'),
    -- Season
    (p_user_id, 'Fall', 'season'),
    (p_user_id, 'Spring', 'season'),
    (p_user_id, 'Summer', 'season'),
    (p_user_id, 'Winter', 'season'),
    -- Cuisine
    (p_user_id, 'American', 'cuisine'),
    (p_user_id, 'Anglo', 'cuisine'),
    (p_user_id, 'Chinese', 'cuisine'),
    (p_user_id, 'French', 'cuisine'),
    (p_user_id, 'Indian', 'cuisine'),
    (p_user_id, 'Italian', 'cuisine'),
    (p_user_id, 'Japanese', 'cuisine'),
    (p_user_id, 'Korean', 'cuisine'),
    (p_user_id, 'Mediterranean', 'cuisine'),
    (p_user_id, 'Mexican', 'cuisine'),
    (p_user_id, 'Thai', 'cuisine'),
    -- Dietary
    (p_user_id, 'Dairy-Free', 'dietary'),
    (p_user_id, 'Gluten-Free', 'dietary'),
    (p_user_id, 'Vegan', 'dietary'),
    (p_user_id, 'Vegetarian', 'dietary'),
    -- Method
    (p_user_id, 'Grill', 'method'),
    (p_user_id, 'Instant Pot', 'method'),
    (p_user_id, 'No Cook', 'method'),
    (p_user_id, 'One Pot', 'method'),
    (p_user_id, 'Oven', 'method'),
    (p_user_id, 'Sheet Pan', 'method'),
    (p_user_id, 'Smoker', 'method'),
    (p_user_id, 'Stovetop', 'method'),
    -- Occasion
    (p_user_id, 'Dinner Party', 'occasion'),
    (p_user_id, 'Easy Crew Meals', 'occasion'),
    (p_user_id, 'Fun Family Meal', 'occasion'),
    (p_user_id, 'Holiday', 'occasion'),
    (p_user_id, 'Large Gatherings', 'occasion'),
    (p_user_id, 'Meal Prep', 'occasion'),
    (p_user_id, 'Weeknight', 'occasion'),
    -- Ingredient (NEW)
    (p_user_id, 'Beans', 'ingredient'),
    (p_user_id, 'Cabbage', 'ingredient'),
    (p_user_id, 'Chicken', 'ingredient'),
    (p_user_id, 'Pasta', 'ingredient'),
    (p_user_id, 'Pork', 'ingredient'),
    (p_user_id, 'Potatoes', 'ingredient'),
    (p_user_id, 'Rotisserie Chicken', 'ingredient'),
    (p_user_id, 'Tofu', 'ingredient'),
    -- Dish Type (NEW)
    (p_user_id, 'Casseroles', 'dish_type'),
    (p_user_id, 'Condiments', 'dish_type'),
    (p_user_id, 'Dips', 'dish_type'),
    (p_user_id, 'Ferments', 'dish_type'),
    (p_user_id, 'Frozen Desserts', 'dish_type'),
    (p_user_id, 'Main', 'dish_type'),
    (p_user_id, 'Marinades & Rubs', 'dish_type'),
    (p_user_id, 'Meatballs', 'dish_type'),
    (p_user_id, 'Noodles', 'dish_type'),
    (p_user_id, 'Pasta', 'dish_type'),
    (p_user_id, 'Pizza', 'dish_type'),
    (p_user_id, 'Salads', 'dish_type'),
    (p_user_id, 'Sauces', 'dish_type'),
    (p_user_id, 'Sides', 'dish_type'),
    (p_user_id, 'Snacks', 'dish_type'),
    (p_user_id, 'Soups', 'dish_type'),
    (p_user_id, 'Stews', 'dish_type'),
    -- Baked Goods (NEW)
    (p_user_id, 'Bagels', 'baked_goods'),
    (p_user_id, 'Bread', 'baked_goods'),
    (p_user_id, 'Cake', 'baked_goods'),
    (p_user_id, 'Cookies', 'baked_goods'),
    (p_user_id, 'Flat Breads', 'baked_goods'),
    (p_user_id, 'Pies', 'baked_goods'),
    (p_user_id, 'Puddings & Custards', 'baked_goods'),
    (p_user_id, 'Quick Bread', 'baked_goods'),
    (p_user_id, 'Sandwich Loaf', 'baked_goods'),
    (p_user_id, 'Sourdough', 'baked_goods'),
    (p_user_id, 'Tea Cakes', 'baked_goods');
end;
$$ language plpgsql security definer;

-- 3. Insert new tags for existing users (skip duplicates via name+category+user)
-- For each existing user, insert only the tags they don't already have.
do $$
declare
  u record;
begin
  for u in select distinct user_id from public.tags loop
    -- New occasion tag
    insert into public.tags (user_id, name, category)
    select u.user_id, t.name, t.category
    from (values
      ('Fun Family Meal', 'occasion'),
      ('Beans', 'ingredient'),
      ('Cabbage', 'ingredient'),
      ('Chicken', 'ingredient'),
      ('Pasta', 'ingredient'),
      ('Pork', 'ingredient'),
      ('Potatoes', 'ingredient'),
      ('Rotisserie Chicken', 'ingredient'),
      ('Tofu', 'ingredient'),
      ('Casseroles', 'dish_type'),
      ('Condiments', 'dish_type'),
      ('Dips', 'dish_type'),
      ('Ferments', 'dish_type'),
      ('Frozen Desserts', 'dish_type'),
      ('Main', 'dish_type'),
      ('Marinades & Rubs', 'dish_type'),
      ('Meatballs', 'dish_type'),
      ('Noodles', 'dish_type'),
      ('Pasta', 'dish_type'),
      ('Pizza', 'dish_type'),
      ('Salads', 'dish_type'),
      ('Sauces', 'dish_type'),
      ('Sides', 'dish_type'),
      ('Snacks', 'dish_type'),
      ('Soups', 'dish_type'),
      ('Stews', 'dish_type'),
      ('Bagels', 'baked_goods'),
      ('Bread', 'baked_goods'),
      ('Cake', 'baked_goods'),
      ('Cookies', 'baked_goods'),
      ('Flat Breads', 'baked_goods'),
      ('Pies', 'baked_goods'),
      ('Puddings & Custards', 'baked_goods'),
      ('Quick Bread', 'baked_goods'),
      ('Sandwich Loaf', 'baked_goods'),
      ('Sourdough', 'baked_goods'),
      ('Tea Cakes', 'baked_goods')
    ) as t(name, category)
    where not exists (
      select 1 from public.tags
      where tags.user_id = u.user_id
        and tags.name = t.name
        and tags.category = t.category
    );

    -- Move Sides and Snacks from meal_type to dish_type for existing users
    -- (they now belong in dish_type; keep the meal_type versions if they have recipe_tags)
  end loop;
end;
$$;
