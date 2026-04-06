import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RecipeGrid from "@/components/recipes/RecipeGrid";
import DeleteCollectionButton from "./DeleteCollectionButton";
import AddRecipeToCollectionButton from "@/components/collections/AddRecipeToCollectionButton";
import type { Recipe } from "@/lib/types/database";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (!collection) notFound();

  const { data: collectionRecipes } = await supabase
    .from("collection_recipes")
    .select("recipe_id")
    .eq("collection_id", id)
    .order("sort_order");

  const recipeIds = collectionRecipes?.map((r) => r.recipe_id) ?? [];
  let recipes: Recipe[] = [];

  if (recipeIds.length > 0) {
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .in("id", recipeIds);
    // Preserve sort order from collection_recipes
    const recipeMap = new Map((data ?? []).map((r) => [r.id, r]));
    recipes = recipeIds.map((id) => recipeMap.get(id)).filter(Boolean) as Recipe[];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/collections"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Collections
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="mt-1 text-sm text-muted">{collection.description}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddRecipeToCollectionButton collectionId={id} />
          <Link
            href={`/collections/${id}/edit`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Edit
          </Link>
          <DeleteCollectionButton collectionId={id} />
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="py-12 text-center text-muted">
          No recipes in this collection yet. Add recipes from their detail pages.
        </p>
      ) : (
        <RecipeGrid recipes={recipes} />
      )}
    </div>
  );
}
