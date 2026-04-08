import { createClient } from "@/lib/supabase/client";

/** Convert a title to a URL-friendly slug */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate a unique slug, appending -2, -3, etc. if needed */
export async function generateUniqueSlug(
  title: string,
  excludeRecipeId?: string
): Promise<string> {
  const supabase = createClient();
  const base = generateSlug(title);
  let candidate = base;
  let counter = 1;

  while (true) {
    const query = supabase
      .from("recipes")
      .select("id")
      .eq("slug", candidate)
      .limit(1);

    // Don't count the current recipe when editing
    if (excludeRecipeId) {
      query.neq("id", excludeRecipeId);
    }

    const { data } = await query;
    if (!data || data.length === 0) return candidate;

    counter++;
    candidate = `${base}-${counter}`;
  }
}
