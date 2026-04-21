import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RecipeGrid from "@/components/recipes/RecipeGrid";
import RecipeListItem from "@/components/browse/RecipeListItem";
import type { Recipe } from "@/lib/types/database";

export default async function TagBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ tagId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { tagId } = await params;
  const { view } = await searchParams;
  const isListView = view === "list";

  const supabase = await createClient();

  const { data: tag } = await supabase
    .from("tags")
    .select("*")
    .eq("id", tagId)
    .single();

  if (!tag) notFound();

  const { data: recipeTagRows } = await supabase
    .from("recipe_tags")
    .select("recipe_id")
    .eq("tag_id", tagId);

  const recipeIds = recipeTagRows?.map((r) => r.recipe_id) ?? [];

  let recipes: Recipe[] = [];
  if (recipeIds.length > 0) {
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .in("id", recipeIds)
      .order("title");
    recipes = data ?? [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/browse"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Browse
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {tag.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Link
            href={`/browse/${tagId}`}
            className={`rounded-md p-1.5 transition-colors ${
              !isListView
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
            title="Grid view"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
          </Link>
          <Link
            href={`/browse/${tagId}?view=list`}
            className={`rounded-md p-1.5 transition-colors ${
              isListView
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
            title="List view"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Results */}
      {recipes.length === 0 ? (
        <p className="py-12 text-center text-muted">
          No recipes tagged with &ldquo;{tag.name}&rdquo; yet.
        </p>
      ) : isListView ? (
        <div className="mx-auto max-w-2xl space-y-2 sm:grid sm:grid-cols-2 sm:gap-x-12 sm:gap-y-1 sm:space-y-0">
          {recipes.map((recipe) => (
            <RecipeListItem key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <RecipeGrid recipes={recipes} />
      )}
    </div>
  );
}
