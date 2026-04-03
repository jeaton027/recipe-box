import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RecipeGrid from "@/components/recipes/RecipeGrid";

export default async function RecipesPage() {
  const supabase = await createClient();

  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          All Recipes
        </h1>
      </div>

      {recipes && recipes.length > 0 ? (
        <RecipeGrid recipes={recipes} />
      ) : (
        <p className="py-12 text-center text-muted">
          No recipes yet. Add your first one!
        </p>
      )}
    </div>
  );
}
