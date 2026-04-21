import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ServingsMultiplier from "@/components/recipes/ServingsMultiplier";
import CookHeader from "@/components/cook/CookHeader";
import StampLastCooked from "@/components/cook/StampLastCooked";

// TODO (v2): Two-column sticky-ingredient layout for tablet landscape and
// wide desktop. Ingredients pinned to the left column (always visible while
// scrolling), steps flow down the right — classic cookbook spread. Single
// column stays for phone portrait. See ROADMAP.md.

export default async function CookModePage({
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

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
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
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CookHeader title={recipe.title} backHref={`/recipes/${recipe.slug}`} />

      {/* Stamp last_cooked_at on mount — powers "Recently Made" */}
      <StampLastCooked recipeId={recipe.id} />

      {/* Cook-mode content: deliberately minimal. Upsized type, roomier
          spacing, no decorative elements. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-6 sm:py-8">
        {/* Bake info, if present — one of the few things you're actually
            checking while mid-cook */}
        {(recipe.bake_time || recipe.bake_temp) && (
          <div className="mb-6 rounded-lg bg-accent-light/60 px-4 py-3 text-center text-base font-medium text-accent-dark">
            {recipe.bake_time && (
              <>
                {recipe.bake_time}
                {recipe.bake_time_max && <>–{recipe.bake_time_max}</>}
                {" "}
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
          </div>
        )}

        {/* Ingredients with multiplier — upsized via the wrapper below */}
        {ingredients && ingredients.length > 0 && (
          <section className="[&_li]:text-base [&_li]:leading-relaxed sm:[&_li]:text-lg">
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
          <section className="mt-10">
            <h2 className="font-heading mb-5 text-2xl font-semibold">Steps</h2>
            <ol className="space-y-6">
              {(() => {
                let n = 0;
                return steps.map((step) => {
                  if (step.instruction.startsWith("§")) {
                    const label = step.instruction.slice(1);
                    return (
                      <li
                        key={step.id}
                        className="mt-6 flex items-center gap-3"
                      >
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-lg font-semibold">{label}</span>
                        <div className="h-px flex-1 bg-border" />
                      </li>
                    );
                  }
                  n++;
                  return (
                    <li key={step.id} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent-dark">
                        {n}
                      </span>
                      <p className="text-base leading-relaxed sm:text-lg sm:leading-relaxed">
                        {step.instruction}
                      </p>
                    </li>
                  );
                });
              })()}
            </ol>
          </section>
        )}

        {/* Notes */}
        {recipe.notes && (
          <section className="mt-10">
            <h2 className="font-heading mb-4 text-2xl font-semibold">Notes</h2>
            <div className="whitespace-pre-line rounded-lg bg-accent-light/50 p-5 text-base leading-relaxed sm:text-lg">
              {recipe.notes}
            </div>
          </section>
        )}
      </div>

      {/* Bottom buffer: lets the last piece of information scroll up to
          roughly mid-viewport so the user isn't reading from the bottom
          edge of the screen */}
      <div
        aria-hidden="true"
        className="min-h-[40vh] w-full bg-accent-light"
      />
    </div>
  );
}
