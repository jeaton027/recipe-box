-- The original recipes_slug_unique index enforced a global UNIQUE(slug),
-- which prevents two users from ever having a recipe with the same slug —
-- a problem for multi-user accounts (e.g. the demo account cloning real
-- data). Replace it with a composite UNIQUE(user_id, slug): slugs only
-- need to be unique within a single user's recipes. RLS already scopes
-- lookups to the current user, so /recipes/[slug] still resolves to
-- exactly one row per user.

DROP INDEX IF EXISTS public.recipes_slug_unique;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_user_slug_unique UNIQUE (user_id, slug);
