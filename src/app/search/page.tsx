import { createClient } from "@/lib/supabase/server";
import SearchClient from "@/components/search/SearchClient";
import type { Recipe, Tag } from "@/lib/types/database";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string }>;
}) {
  const { q, tags: tagsParam } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedTagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  const supabase = await createClient();

  // Fetch all tags for the filter panel
  const { data: allTags } = await supabase
    .from("tags")
    .select("*")
    .order("category")
    .order("name");

  // Collect matching recipe IDs from all sources, then intersect with tag filters
  let recipeIds: string[] | null = null;

  if (query) {
    // Run all three lookups in parallel
    const [titleMatches, ingredientMatches, matchingTags] = await Promise.all([
      supabase.from("recipes").select("id").ilike("title", `%${query}%`),
      supabase.from("ingredients").select("recipe_id").ilike("name", `%${query}%`),
      supabase.from("tags").select("id").ilike("name", `%${query}%`),
    ]);

    // Find recipe IDs that have a matching tag
    const matchingTagIds = matchingTags.data?.map((t) => t.id) ?? [];
    let tagRecipeIds: string[] = [];
    if (matchingTagIds.length > 0) {
      const { data } = await supabase
        .from("recipe_tags")
        .select("recipe_id")
        .in("tag_id", matchingTagIds);
      tagRecipeIds = data?.map((r) => r.recipe_id) ?? [];
    }

    // Union all three sources
    recipeIds = [
      ...new Set([
        ...(titleMatches.data?.map((r) => r.id) ?? []),
        ...(ingredientMatches.data?.map((r) => r.recipe_id) ?? []),
        ...tagRecipeIds,
      ]),
    ];
  }

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

  // Fetch final recipes
  let recipes: Recipe[] = [];
  if (recipeIds !== null && recipeIds.length > 0) {
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .in("id", recipeIds)
      .order("title");
    recipes = data ?? [];
  }

  // Sort: title matches first, then the rest alphabetically //TODO change priority after title matches
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
    />
  );
}
