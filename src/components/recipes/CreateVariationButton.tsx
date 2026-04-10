"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateVariationButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleCreateVariation() {
    if (loading) return;
    setLoading(true);

    try {
      // Fetch source recipe + all its relations (READ ONLY — no DB writes).
      // The new variation is only materialized when the user clicks Save
      // on the edit form.
      const [srcRes, ingsRes, stepsRes, tagsRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase.from("ingredients").select("*").eq("recipe_id", recipeId).order("sort_order"),
        supabase.from("steps").select("*").eq("recipe_id", recipeId).order("sort_order"),
        supabase.from("recipe_tags").select("tag_id").eq("recipe_id", recipeId),
      ]);

      if (srcRes.error || !srcRes.data) throw new Error(srcRes.error?.message ?? "Source recipe not found");
      if (ingsRes.error) throw new Error(ingsRes.error.message);
      if (stepsRes.error) throw new Error(stepsRes.error.message);
      if (tagsRes.error) throw new Error(tagsRes.error.message);

      const source = srcRes.data;

	  // copy data fields to create new variant.
      // Shape the data to match what RecipeForm's variation-loader expects.
      // Ingredients/steps are kept in DB shape so the form can convert them.
      const variationData = {
        // Recipe fields
        title: source.title,
        description: source.description,
        servings: source.servings,
        servings_type: source.servings_type,
        prep_time_minutes: source.prep_time_minutes,
        cook_time_minutes: source.cook_time_minutes,
        bake_time: source.bake_time,
        bake_time_max: source.bake_time_max,
        bake_time_unit: source.bake_time_unit,
        bake_temp: source.bake_temp,
        bake_temp_max: source.bake_temp_max,
        bake_temp_unit: source.bake_temp_unit,
        notes: source.notes,
        source_url: source.source_url,
        thumbnail_url: source.thumbnail_url,
        gallery_images: source.gallery_images,
        is_image_only: source.is_image_only,
        // Relations (DB shape)
        ingredients: ingsRes.data ?? [],
        steps: stepsRes.data ?? [],
        tag_ids: (tagsRes.data ?? []).map((t) => t.tag_id),
        // Source tracking for lazy family_id generation on save
        _variationSourceId: source.id,
      };

      sessionStorage.setItem("variationRecipe", JSON.stringify(variationData));
      router.push("/recipes/new?source=variation");
    } catch (e) {
      console.error("Create variation failed:", e);
      alert(e instanceof Error ? e.message : "Failed to create variation");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCreateVariation}
      disabled={loading}
      className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent-dark transition-colors disabled:opacity-50"
      title="Create a copy of this recipe as a variation"
    >
      {loading ? "Loading..." : "+ Variation"}
    </button>
  );
}
