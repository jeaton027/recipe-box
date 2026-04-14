-- Add status column for tried/favorite tracking
-- 'saved' = default (in collection but untested)
-- 'tried' = user has made this recipe
-- 'favorite' = user's go-to recipes (implies tried)
alter table recipes
  add column status text not null default 'saved'
  check (status in ('saved', 'tried', 'favorite'));

-- Index for filtering/sorting by status
create index idx_recipes_status on recipes (user_id, status);
