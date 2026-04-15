import { createClient } from "@/lib/supabase/server";
import SearchClient from "@/components/search/SearchClient";
import { searchRecipeIds } from "@/lib/utils/search-recipes";
import type { Recipe } from "@/lib/types/database";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string; status?: string }>;
}) {
  const { q, tags: tagsParam, status: statusParam } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedTagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const statusFilter = statusParam ?? "";

  const supabase = await createClient();

  // Fetch all tags for the filter panel
  const { data: allTags } = await supabase
    .from("tags")
    .select("*")
    .order("category")
    .order("name");

  // Collect matching recipe IDs from all sources, then intersect with tag filters
  let recipeIds = await searchRecipeIds(supabase, query);

  // If tag filters are active, intersect with recipes that have ALL selected tags
  if (selectedTagIds.length > 0) {
    const tagMatches = await Promise.all(
      selectedTagIds.map((tagId) =>
        supabase.from("recipe_tags").select("recipe_id").eq("tag_id", tagId)
      )
    );
    const idSets = tagMatches.map(
      (r) => new Set(r.data?.map((row) => row.recipe_id) ?? [])
    );
    const intersected = [...idSets[0]].filter((id) =>
      idSets.every((set) => set.has(id))
    );

    recipeIds =
      recipeIds !== null
        ? intersected.filter((id) => new Set(recipeIds).has(id))
        : intersected;
  }

  // If status filter is set but no other filters, query all recipes with that status
  if (statusFilter && recipeIds === null) {
    let q = supabase.from("recipes").select("id");
    if (statusFilter === "tried") q = q.in("status", ["tried", "favorite"]);
    else if (statusFilter === "favorite") q = q.eq("status", "favorite");
    const { data } = await q;
    recipeIds = data?.map((r) => r.id) ?? [];
  }

  // Fetch final recipes
  let recipes: Recipe[] = [];
  if (recipeIds !== null && recipeIds.length > 0) {
    let q = supabase
      .from("recipes")
      .select("*")
      .in("id", recipeIds)
      .order("title");
    if (statusFilter === "tried") q = q.in("status", ["tried", "favorite"]);
    else if (statusFilter === "favorite") q = q.eq("status", "favorite");
    const { data } = await q;
    recipes = data ?? [];
  }

  // Sort: title matches first, then the rest alphabetically
  if (query && recipes.length > 0) {
    const q = query.toLowerCase();
    recipes = recipes.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1;
      const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1;
      return aTitle - bTitle || a.title.localeCompare(b.title);
    });
  }

  return (
    <SearchClient
      initialRecipes={recipes}
      allTags={allTags ?? []}
      initialQuery={query}
      initialTagIds={selectedTagIds}
      initialStatus={statusFilter}
      pageTitle="Search"
    />
  );
}
