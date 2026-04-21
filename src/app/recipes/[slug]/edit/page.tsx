import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecipeForm from "@/components/recipes/RecipeForm";
import RecipeStatusToggle from "@/components/recipes/RecipeStatusToggle";
import ViewOriginalTrigger from "@/components/recipes/ViewOriginalTrigger";
import type { OriginalSnapshot, RecipeWithDetails } from "@/lib/types/database";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!recipe) notFound();

  const [{ data: ingredients }, { data: steps }, { data: recipeTags }, { data: tags }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("*")
        .eq("recipe_id", recipe.id)
        .order("sort_order"),
      supabase
        .from("steps")
        .select("*")
        .eq("recipe_id", recipe.id)
        .order("sort_order"),
      supabase
        .from("recipe_tags")
        .select("tag_id, tags(*)")
        .eq("recipe_id", recipe.id),
      supabase
        .from("tags")
        .select("*")
        .order("category")
        .order("name"),
    ]);

  const recipeWithDetails: RecipeWithDetails = {
    ...recipe,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
    images: [],
    tags: (recipeTags?.map((rt) => rt.tags).filter(Boolean) ?? []) as unknown as RecipeWithDetails["tags"],
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Edit Recipe
        </h1>
        <RecipeStatusToggle
          recipeId={recipe.id}
          initialStatus={recipe.status ?? "saved"}
          mode="reset"
        />
        <div className="ml-auto">
          <ViewOriginalTrigger
            snapshot={(recipe.original_snapshot ?? null) as OriginalSnapshot | null}
          />
        </div>
      </div>
      <RecipeForm recipe={recipeWithDetails} tags={tags ?? []} />
    </div>
  );
}
