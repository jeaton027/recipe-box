-- Recipe Box: Initial Schema
-- Run this in the Supabase SQL Editor or via CLI migrations

-- ============================================================
-- TABLES
-- ============================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  servings integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  notes text,
  source_url text,
  thumbnail_url text,
  is_image_only boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  name text not null,
  quantity decimal,
  unit text,
  sort_order integer default 0
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  instruction text not null,
  image_url text,
  sort_order integer default 0
);

create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  image_url text not null,
  caption text,
  sort_order integer default 0
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null check (category in ('meal_type', 'season', 'cuisine', 'dietary', 'method', 'occasion', 'custom'))
);

create table public.recipe_tags (
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (recipe_id, tag_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  cover_image_url text,
  created_at timestamptz default now()
);

create table public.collection_recipes (
  collection_id uuid references public.collections(id) on delete cascade not null,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  sort_order integer default 0,
  primary key (collection_id, recipe_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_recipes_user_id on public.recipes(user_id);
create index idx_ingredients_recipe_id on public.ingredients(recipe_id);
create index idx_steps_recipe_id on public.steps(recipe_id);
create index idx_recipe_images_recipe_id on public.recipe_images(recipe_id);
create index idx_tags_user_id on public.tags(user_id);
create index idx_collections_user_id on public.collections(user_id);

-- Full-text search on recipe titles
alter table public.recipes add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;

create index idx_recipes_search on public.recipes using gin(search_vector);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.steps enable row level security;
alter table public.recipe_images enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_recipes enable row level security;

-- Recipes: users can only access their own
create policy "Users can view own recipes" on public.recipes
  for select using (auth.uid() = user_id);
create policy "Users can insert own recipes" on public.recipes
  for insert with check (auth.uid() = user_id);
create policy "Users can update own recipes" on public.recipes
  for update using (auth.uid() = user_id);
create policy "Users can delete own recipes" on public.recipes
  for delete using (auth.uid() = user_id);

-- Ingredients: access via recipe ownership
create policy "Users can view own ingredients" on public.ingredients
  for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert own ingredients" on public.ingredients
  for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can update own ingredients" on public.ingredients
  for update using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete own ingredients" on public.ingredients
  for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));

-- Steps: access via recipe ownership
create policy "Users can view own steps" on public.steps
  for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert own steps" on public.steps
  for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can update own steps" on public.steps
  for update using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete own steps" on public.steps
  for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));

-- Recipe images: access via recipe ownership
create policy "Users can view own recipe images" on public.recipe_images
  for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert own recipe images" on public.recipe_images
  for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can update own recipe images" on public.recipe_images
  for update using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete own recipe images" on public.recipe_images
  for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));

-- Tags: users can only access their own
create policy "Users can view own tags" on public.tags
  for select using (auth.uid() = user_id);
create policy "Users can insert own tags" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tags" on public.tags
  for update using (auth.uid() = user_id);
create policy "Users can delete own tags" on public.tags
  for delete using (auth.uid() = user_id);

-- Recipe tags: access via recipe ownership
create policy "Users can view own recipe tags" on public.recipe_tags
  for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert own recipe tags" on public.recipe_tags
  for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete own recipe tags" on public.recipe_tags
  for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));

-- Collections: users can only access their own
create policy "Users can view own collections" on public.collections
  for select using (auth.uid() = user_id);
create policy "Users can insert own collections" on public.collections
  for insert with check (auth.uid() = user_id);
create policy "Users can update own collections" on public.collections
  for update using (auth.uid() = user_id);
create policy "Users can delete own collections" on public.collections
  for delete using (auth.uid() = user_id);

-- Collection recipes: access via collection ownership
create policy "Users can view own collection recipes" on public.collection_recipes
  for select using (collection_id in (select id from public.collections where user_id = auth.uid()));
create policy "Users can insert own collection recipes" on public.collection_recipes
  for insert with check (collection_id in (select id from public.collections where user_id = auth.uid()));
create policy "Users can delete own collection recipes" on public.collection_recipes
  for delete using (collection_id in (select id from public.collections where user_id = auth.uid()));

-- ============================================================
-- SEED: DEFAULT TAGS (inserted per-user via function)
-- ============================================================

create or replace function public.seed_default_tags(p_user_id uuid)
returns void as $$
begin
  insert into public.tags (user_id, name, category) values
    -- Meal types
    (p_user_id, 'Breakfast', 'meal_type'),
    (p_user_id, 'Lunch', 'meal_type'),
    (p_user_id, 'Dinner', 'meal_type'),
    (p_user_id, 'Snacks', 'meal_type'),
    (p_user_id, 'Desserts', 'meal_type'),
    (p_user_id, 'Appetizers', 'meal_type'),
    (p_user_id, 'Sides', 'meal_type'),
    (p_user_id, 'Drinks', 'meal_type'),
    -- Seasons
    (p_user_id, 'Spring', 'season'),
    (p_user_id, 'Summer', 'season'),
    (p_user_id, 'Fall', 'season'),
    (p_user_id, 'Winter', 'season'),
    -- Cuisines
    (p_user_id, 'Italian', 'cuisine'),
    (p_user_id, 'Mexican', 'cuisine'),
    (p_user_id, 'Japanese', 'cuisine'),
    (p_user_id, 'Indian', 'cuisine'),
    (p_user_id, 'French', 'cuisine'),
    (p_user_id, 'American', 'cuisine'),
    (p_user_id, 'Thai', 'cuisine'),
    (p_user_id, 'Mediterranean', 'cuisine'),
    (p_user_id, 'Chinese', 'cuisine'),
    (p_user_id, 'Korean', 'cuisine'),
    (p_user_id, 'Anglo', 'cuisine'),
    -- Dietary
    (p_user_id, 'Vegan', 'dietary'),
    (p_user_id, 'Vegetarian', 'dietary'),
    (p_user_id, 'Gluten-Free', 'dietary'),
    (p_user_id, 'Dairy-Free', 'dietary'),
    -- Methods
    (p_user_id, 'Sheet Pan', 'method'),
    (p_user_id, 'One Pot', 'method'),
    (p_user_id, 'Oven', 'method'),
    (p_user_id, 'Grill', 'method'),
    (p_user_id, 'Smoker', 'method'),
    (p_user_id, 'Instant Pot', 'method'),
    (p_user_id, 'Stovetop', 'method'),
    (p_user_id, 'No Cook', 'method'),
    -- Occasions
    (p_user_id, 'Large Gatherings', 'occasion'),
    (p_user_id, 'Dinner Party', 'occasion'),
    (p_user_id, 'Easy Crew Meals', 'occasion'),
    (p_user_id, 'Weeknight', 'occasion'),
    (p_user_id, 'Meal Prep', 'occasion'),
    (p_user_id, 'Holiday', 'occasion');
end;
$$ language plpgsql security definer;

-- ============================================================
-- AUTO-SEED TAGS ON USER SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  perform public.seed_default_tags(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- STORAGE BUCKET (run manually in Supabase dashboard or CLI)
-- ============================================================
-- create a bucket called 'recipe-images' with public access
-- Storage > New Bucket > Name: recipe-images > Public: true
