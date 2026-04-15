import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Multi-word search: splits query into individual words, finds recipes
 * where ALL words appear (in title, ingredient names, or tag names).
 * Each word can match in a different field — e.g. "philly rolls" matches
 * a recipe titled "Philly Style Rolls" because "philly" is in the title
 * AND "rolls" is in the title.
 *
 * Returns a deduplicated array of matching recipe IDs, or null if no query.
 */
export async function searchRecipeIds(
  supabase: SupabaseClient,
  query: string
): Promise<string[] | null> {
  if (!query) return null;

  // Strip punctuation and lowercase to match the generated title_search column
  const normalized = query.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // For each word, find all recipe IDs that match it anywhere
  const perWordSets = await Promise.all(
    words.map(async (word) => {
      const pattern = `%${word}%`;

      const [titleMatches, ingredientMatches, matchingTags] = await Promise.all([
        // Search the normalized title_search column (punctuation-free, lowercase)
        supabase.from("recipes").select("id").ilike("title_search", pattern),
        supabase.from("ingredients").select("recipe_id").ilike("name", pattern),
        supabase.from("tags").select("id").ilike("name", pattern),
      ]);

      // Resolve tag matches → recipe IDs
      let tagRecipeIds: string[] = [];
      const matchingTagIds = matchingTags.data?.map((t) => t.id) ?? [];
      if (matchingTagIds.length > 0) {
        const { data } = await supabase
          .from("recipe_tags")
          .select("recipe_id")
          .in("tag_id", matchingTagIds);
        tagRecipeIds = data?.map((r) => r.recipe_id) ?? [];
      }

      // Union: recipe matches this word if it appears in title OR ingredients OR tags
      return new Set([
        ...(titleMatches.data?.map((r) => r.id) ?? []),
        ...(ingredientMatches.data?.map((r) => r.recipe_id) ?? []),
        ...tagRecipeIds,
      ]);
    })
  );

  // Intersect: recipe must match ALL words
  const [first, ...rest] = perWordSets;
  const intersected = [...first].filter((id) =>
    rest.every((set) => set.has(id))
  );

  return intersected;
}
