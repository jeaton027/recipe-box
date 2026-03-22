import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import DeleteRecipeButton from "./DeleteRecipeButton";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!recipe) notFound();

  const [{ data: ingredients }, { data: steps }, { data: tags }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("*")
        .eq("recipe_id", id)
        .order("sort_order"),
      supabase
        .from("steps")
        .select("*")
        .eq("recipe_id", id)
        .order("sort_order"),
      supabase
        .from("recipe_tags")
        .select("tag_id, tags(*)")
        .eq("recipe_id", id),
    ]);

  const recipeTags = (tags?.map((t) => t.tags).filter(Boolean) ?? []) as unknown as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="mt-2 text-muted">{recipe.description}</p>
          )}
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Link
            href={`/recipes/${id}/edit`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Edit
          </Link>
          <DeleteRecipeButton recipeId={id} />
        </div>
      </div>

      {/* Thumbnail */}
      {recipe.thumbnail_url && (
        <div className="relative mb-6 aspect-video overflow-hidden rounded-lg">
          <Image
            src={recipe.thumbnail_url}
            alt={recipe.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Meta */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted">
        {recipe.servings && (
          <span>
            <strong className="text-foreground">{recipe.servings}</strong>{" "}
            servings
          </span>
        )}
        {recipe.prep_time_minutes && (
          <span>
            <strong className="text-foreground">
              {recipe.prep_time_minutes}
            </strong>{" "}
            min prep
          </span>
        )}
        {recipe.cook_time_minutes && (
          <span>
            <strong className="text-foreground">
              {recipe.cook_time_minutes}
            </strong>{" "}
            min cook
          </span>
        )}
      </div>

      {/* Tags */}
      {recipeTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {recipeTags.map((tag: { id: string; name: string }) => (
            <span
              key={tag.id}
              className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {ingredients && ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 text-xl font-semibold">
            Ingredients
          </h2>
          <ul className="space-y-1.5">
            {ingredients.map((ing) => (
              <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {ing.quantity && (
                  <span className="font-medium">
                    {ing.quantity} {ing.unit}
                  </span>
                )}
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Steps */}
      {steps && steps.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 text-xl font-semibold">Steps</h2>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-medium text-accent-dark">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Notes */}
      {recipe.notes && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 text-xl font-semibold">Notes</h2>
          <div className="rounded-lg bg-accent-light/50 p-4 text-sm leading-relaxed">
            {recipe.notes}
          </div>
        </section>
      )}

      {/* Source */}
      {recipe.source_url && (
        <p className="text-sm text-muted">
          Source:{" "}
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-dark"
          >
            {new URL(recipe.source_url).hostname}
          </a>
        </p>
      )}
    </div>
  );
}
