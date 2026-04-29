import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import ServingsMultiplier from "@/components/recipes/ServingsMultiplier";
import SaveMenu from "@/components/recipes/SaveMenu";
import RecipeGallery from "@/components/recipes/RecipeGallery";
import VariationPills from "@/components/recipes/VariationPills";
import CompareButton from "@/components/recipes/CompareButton";
import CookModeButton from "@/components/recipes/CookModeButton";
import MoreFromSource from "@/components/recipes/MoreFromSource";
import RecipeStatusToggle from "@/components/recipes/RecipeStatusToggle";
import TagPills from "@/components/recipes/TagPills";
import SeenInMenus from "@/components/menus/SeenInMenus";
import RecipeActionsMenu from "@/components/recipes/RecipeActionsMenu";

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

  const [{ data: ingredients }, { data: steps }, { data: tags }, { data: siblings }] =
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
      recipe.family_id
        ? supabase
            .from("recipes")
            .select("id, slug, title, variant_label")
            .eq("family_id", recipe.family_id)
            .neq("id", recipe.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as { id: string; slug: string; title: string; variant_label: string | null }[] }),
    ]);

  const recipeTags = (tags?.map((t) => t.tags).filter(Boolean) ?? []) as unknown as { id: string; name: string; category: string }[];
  const siblingVariations = (siblings ?? []) as { id: string; slug: string; title: string; variant_label: string | null }[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header — desktop: side-by-side, mobile: stacked */}
      <div className="mb-4">
		<div className="flex flex-col">
			
			{/* Top row: buttons aligned right */}
			<div className="flex justify-end gap-2">
				{/* Action buttons */}
				<div className="flex items-center justify-end gap-2">
					<SaveMenu
						recipeId={recipe.id}
						recipeThumbnail={recipe.thumbnail_url}
					/>
					<RecipeActionsMenu
						recipeId={recipe.id}
						recipeSlug={recipe.slug}
						familyId={recipe.family_id}
						siblingIds={siblingVariations.map((s) => s.id)}
					/>
				</div>
			</div>

			{/* Title + description */}
			<div className="mt-4">
				<div className="flex items-start gap-2">
					<h1 className="font-heading text-3xl font-bold tracking-tight">
					{recipe.title}
					</h1>
					<RecipeStatusToggle
					recipeId={recipe.id}
					initialStatus={recipe.status ?? "saved"}
					/>
				</div>

				{recipe.description && (
					<p className="mt-2 text-muted">{recipe.description}</p>
				)}
			</div>

		</div>
		</div>

      {/* Variation pills (left) and Compare + Cook Mode (right) — above thumbnail */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <VariationPills siblings={siblingVariations} />
        <div className="ml-auto flex items-center gap-2">
          <CompareButton
            currentRecipeId={recipe.id}
            currentRecipeSlug={recipe.slug}
            currentRecipeTitle={recipe.title}
            currentRecipeThumbnail={recipe.thumbnail_url}
            familyId={recipe.family_id}
          />
          
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
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        </div>
      )}

      {/* Gallery */}
      {recipe.gallery_images && recipe.gallery_images.length > 0 && (
        <RecipeGallery images={recipe.gallery_images} />
      )}

      {/* Meta: times + bake (servings live with the ingredients multiplier) */}
      {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.bake_temp) && (
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
          {recipe.prep_time_minutes != null && (
            <span className="flex gap-1">
              <strong className="text-foreground">
                {recipe.prep_time_minutes}
                {recipe.prep_time_minutes_max != null && `–${recipe.prep_time_minutes_max}`}
              </strong>{" "}
              min prep
            </span>
          )}
          {recipe.cook_time_minutes != null && (
            <span className="flex gap-1">
              <strong className="text-foreground">
                {recipe.cook_time_minutes}
                {recipe.cook_time_minutes_max != null && `–${recipe.cook_time_minutes_max}`}
              </strong>{" "}
              min cook
            </span>
          )}
          {(recipe.bake_time || recipe.bake_temp) && (
            <span className="ml-auto flex gap-1 text-foreground font-medium">
              {recipe.bake_time && (
                <>
                  {recipe.bake_time}
                  {recipe.bake_time_max && <>–{recipe.bake_time_max}</>}
                  {" "}{recipe.bake_time_unit || "min"}
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

		{/* Tags — top 4 by specificity, rest collapsed */}
		<div className="flex items-start justify-between gap-2">
			<TagPills tags={recipeTags} />
			<a
				href="#related"
				className="shrink-0 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent"
				title="Other Related Recipes"
			>
				Related
			</a>
		</div>

		<div >
			<CookModeButton slug={recipe.slug} />
		</div>

      {/* Ingredients with multiplier */}
      {ingredients && ingredients.length > 0 && (
        <section>
          <ServingsMultiplier
            servings={recipe.servings}
            servingsMax={recipe.servings_max}
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
          <div className="rounded-lg bg-accent-light/50 p-4 text-sm leading-relaxed whitespace-pre-line">
            {recipe.notes}
          </div>
        </section>
      )}

      {/* Related: Seen in menus + source */}
      <section id="related" className="mt-8 scroll-mt-20 space-y-3">
        <h2 className="font-heading mb-3 text-xl font-semibold">Related</h2>
        <SeenInMenus recipeId={recipe.id} />
        {recipe.source_url && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
            <MoreFromSource
              sourceHostname={new URL(recipe.source_url).hostname}
              currentRecipeId={recipe.id}
            />
          </div>
        )}
      </section>
    </div>
  );
}
