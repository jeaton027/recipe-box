import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import DeleteRecipeButton from "./DeleteRecipeButton";
import ServingsMultiplier from "@/components/recipes/ServingsMultiplier";
import AddToCollectionButton from "@/components/collections/AddToCollectionButton";
import RecipeGallery from "@/components/recipes/RecipeGallery";

export default async function RecipeDetailPage({
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

  const [{ data: ingredients }, { data: steps }, { data: tags }] =
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
    ]);

  const recipeTags = (tags?.map((t) => t.tags).filter(Boolean) ?? []) as unknown as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header — desktop: side-by-side, mobile: stacked */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-2 text-muted">{recipe.description}</p>
            )}
          </div>
          {/* Desktop buttons */}
          <div className="ml-4 hidden items-center gap-2 sm:flex">
            <AddToCollectionButton recipeId={recipe.id} recipeThumbnail={recipe.thumbnail_url} />
            <Link
              href={`/recipes/${recipe.slug}/edit`}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Edit
            </Link>
            <DeleteRecipeButton recipeId={recipe.id} />
          </div>
        </div>
        {/* Mobile buttons — Delete left, Edit middle, Save right (thumb-friendly) */}
        <div className="mt-4 flex items-center gap-2 sm:hidden">
          <DeleteRecipeButton recipeId={recipe.id} />
          <Link
            href={`/recipes/${recipe.slug}/edit`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Edit
          </Link>
          <div className="ml-auto">
            <AddToCollectionButton recipeId={recipe.id} recipeThumbnail={recipe.thumbnail_url} />
          </div>
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

      {/* Gallery */}
      {recipe.gallery_images && recipe.gallery_images.length > 0 && (
        <RecipeGallery images={recipe.gallery_images} />
      )}

      {/* Meta: servings + times + bake */}
      {(recipe.servings || recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.bake_temp) && (
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
          {recipe.servings && (
            <span className="flex gap-1">
              <strong className="text-foreground">{recipe.servings}</strong>{" "}
              {recipe.servings_type || "servings"}
            </span>
          )}
          {recipe.prep_time_minutes && (
            <span className="flex gap-1">
              <strong className="text-foreground">{recipe.prep_time_minutes}</strong> min prep
            </span>
          )}
          {recipe.cook_time_minutes && (
            <span className="flex gap-1">
              <strong className="text-foreground">{recipe.cook_time_minutes}</strong> min cook
            </span>
          )}
          {(recipe.bake_time || recipe.bake_temp) && (
            <span className="ml-auto flex gap-1 text-foreground font-medium">
              {recipe.bake_time && (
                <>
                  {recipe.bake_time}
                  {recipe.bake_time_max && <>–{recipe.bake_time_max}</>}
                  {recipe.bake_time_unit || "min"}
                </>
              )}
              {recipe.bake_time && recipe.bake_temp && " @ "}
              {recipe.bake_temp && (
                <>
                  {recipe.bake_temp}
                  {recipe.bake_temp_max && <>–{recipe.bake_temp_max}</>}
                  °{recipe.bake_temp_unit || "F"}
                </>
              )}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {recipeTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {recipeTags.map((tag: { id: string; name: string }) => (
            <Link
              key={tag.id}
              href={`/browse/${tag.id}`}
              className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark hover:bg-accent hover:text-white transition-colors"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Ingredients with multiplier */}
      {ingredients && ingredients.length > 0 && (
        <section>
          <ServingsMultiplier
            servings={recipe.servings}
            servingsType={recipe.servings_type}
            ingredients={ingredients}
          />
        </section>
      )}

      {/* Steps */}
      {steps && steps.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 text-xl font-semibold">Steps</h2>
          <ol className="space-y-4">
            {(() => {
              let stepCount = 0;
              return steps.map((step) => {
                if (step.instruction.startsWith("§")) {
                  const label = step.instruction.slice(1);
                  return (
                    <li key={step.id} className="mt-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-base font-semibold">{label}</span>
                      <div className="h-px flex-1 bg-border" />
                    </li>
                  );
                }
                stepCount++;
                return (
                  <li key={step.id} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-medium text-accent-dark">
                      {stepCount}
                    </span>
                    <p className="text-sm leading-relaxed">{step.instruction}</p>
                  </li>
                );
              });
            })()}
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
