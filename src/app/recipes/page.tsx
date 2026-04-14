import { createClient } from "@/lib/supabase/server";
import SearchClient from "@/components/search/SearchClient";
import type { Recipe } from "@/lib/types/database";

export default async function RecipesPage({
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

  // Collect matching recipe IDs from all active filters
  let recipeIds: string[] | null = null;

  // Text search: title, ingredients, and tag name matches
  if (query) {
    const [titleMatches, ingredientMatches, matchingTags] = await Promise.all([
      supabase.from("recipes").select("id").ilike("title", `%${query}%`),
      supabase.from("ingredients").select("recipe_id").ilike("name", `%${query}%`),
      supabase.from("tags").select("id").ilike("name", `%${query}%`),
    ]);
    let tagRecipeIds: string[] = [];
    const matchingTagIds = matchingTags.data?.map((t) => t.id) ?? [];
    if (matchingTagIds.length > 0) {
      const { data } = await supabase
        .from("recipe_tags")
        .select("recipe_id")
        .in("tag_id", matchingTagIds);
      tagRecipeIds = data?.map((r) => r.recipe_id) ?? [];
    }
    recipeIds = [
      ...new Set([
        ...(titleMatches.data?.map((r) => r.id) ?? []),
        ...(ingredientMatches.data?.map((r) => r.recipe_id) ?? []),
        ...tagRecipeIds,
      ]),
    ];
  }

  // Tag filters: intersect with recipe IDs that have ALL selected tags
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

  // Fetch filtered recipes
  let recipes: Recipe[] = [];
  const hasFilters = query || selectedTagIds.length > 0 || statusFilter;
  if (hasFilters && (recipeIds === null || recipeIds.length > 0)) {
    let dbq = supabase.from("recipes").select("*").order("title");
    if (recipeIds !== null) dbq = dbq.in("id", recipeIds);
    if (statusFilter === "tried") dbq = dbq.in("status", ["tried", "favorite"]);
    else if (statusFilter === "favorite") dbq = dbq.eq("status", "favorite");
    const { data } = await dbq;
    recipes = data ?? [];
  }

  // Sort: title matches first when searching
  if (query && recipes.length > 0) {
    const ql = query.toLowerCase();
    recipes.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(ql) ? 0 : 1;
      const bTitle = b.title.toLowerCase().includes(ql) ? 0 : 1;
      return aTitle - bTitle || a.title.localeCompare(b.title);
    });
  }

  // All recipes for the default view
  const { data: allRecipes } = await supabase
    .from("recipes")
    .select("*")
    .order("title");

  return (
    <SearchClient
      initialRecipes={recipes}
      allRecipes={allRecipes ?? []}
      allTags={allTags ?? []}
      initialQuery={query}
      initialTagIds={selectedTagIds}
      initialStatus={statusFilter}
      pageTitle="Recipes"
      basePath="/recipes"
    />
  );
}
