"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import type { RecipeWithDetails, Tag } from "@/lib/types/database";

type IngredientRow = {
  name: string;
  quantity: string;
  unit: string;
};

type StepRow = {
  instruction: string;
};

type RecipeFormProps = {
  recipe?: RecipeWithDetails;
  tags: Tag[];
};

export default function RecipeForm({ recipe, tags }: RecipeFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!recipe;

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [servings, setServings] = useState(recipe?.servings?.toString() ?? "");
  const [prepTime, setPrepTime] = useState(
    recipe?.prep_time_minutes?.toString() ?? ""
  );
  const [cookTime, setCookTime] = useState(
    recipe?.cook_time_minutes?.toString() ?? ""
  );
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [isImageOnly, setIsImageOnly] = useState(
    recipe?.is_image_only ?? false
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(
    recipe?.thumbnail_url ?? ""
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    recipe?.tags?.map((t) => t.id) ?? []
  );

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe?.ingredients?.map((i) => ({
      name: i.name,
      quantity: i.quantity?.toString() ?? "",
      unit: i.unit ?? "",
    })) ?? [{ name: "", quantity: "", unit: "" }]
  );

  const [steps, setSteps] = useState<StepRow[]>(
    recipe?.steps?.map((s) => ({ instruction: s.instruction })) ?? [
      { instruction: "" },
    ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group tags by category for display
  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = [];
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  const categoryLabels: Record<string, string> = {
    meal_type: "Meal Type",
    season: "Season",
    cuisine: "Cuisine",
    dietary: "Dietary",
    method: "Method",
    occasion: "Occasion",
    custom: "Custom",
  };

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  function addIngredient() {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientRow,
    value: string
  ) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  }

  function addStep() {
    setSteps([...steps, { instruction: "" }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, value: string) {
    const updated = [...steps];
    updated[index] = { instruction: value };
    setSteps(updated);
  }

  async function handleThumbnailUpload(file: File): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(filePath, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("recipe-images").getPublicUrl(filePath);

    setThumbnailUrl(publicUrl);
    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in");
      setSaving(false);
      return;
    }

    const recipeData = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      servings: servings ? parseInt(servings) : null,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      notes: notes.trim() || null,
      source_url: sourceUrl.trim() || null,
      thumbnail_url: thumbnailUrl || null,
      is_image_only: isImageOnly,
    };

    let recipeId = recipe?.id;

    if (isEditing && recipeId) {
      const { error: updateError } = await supabase
        .from("recipes")
        .update(recipeData)
        .eq("id", recipeId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      // Clear existing ingredients, steps, and tags for re-insert
      await Promise.all([
        supabase.from("ingredients").delete().eq("recipe_id", recipeId),
        supabase.from("steps").delete().eq("recipe_id", recipeId),
        supabase.from("recipe_tags").delete().eq("recipe_id", recipeId),
      ]);
    } else {
      const { data, error: insertError } = await supabase
        .from("recipes")
        .insert(recipeData)
        .select("id")
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to create recipe");
        setSaving(false);
        return;
      }
      recipeId = data.id;
    }

    // Insert ingredients
    const validIngredients = ingredients.filter((i) => i.name.trim());
    if (validIngredients.length > 0) {
      await supabase.from("ingredients").insert(
        validIngredients.map((i, idx) => ({
          recipe_id: recipeId!,
          name: i.name.trim(),
          quantity: i.quantity ? parseFloat(i.quantity) : null,
          unit: i.unit.trim() || null,
          sort_order: idx,
        }))
      );
    }

    // Insert steps
    const validSteps = steps.filter((s) => s.instruction.trim());
    if (validSteps.length > 0) {
      await supabase.from("steps").insert(
        validSteps.map((s, idx) => ({
          recipe_id: recipeId!,
          instruction: s.instruction.trim(),
          sort_order: idx,
        }))
      );
    }

    // Insert tags
    if (selectedTagIds.length > 0) {
      await supabase.from("recipe_tags").insert(
        selectedTagIds.map((tagId) => ({
          recipe_id: recipeId!,
          tag_id: tagId,
        }))
      );
    }

    router.push(`/recipes/${recipeId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Recipe name"
        />
      </div>

      {/* Image-only toggle */}
      <div className="flex items-center gap-3">
        <input
          id="imageOnly"
          type="checkbox"
          checked={isImageOnly}
          onChange={(e) => setIsImageOnly(e.target.checked)}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
        />
        <label htmlFor="imageOnly" className="text-sm">
          Image-only recipe (e.g., photo of a handwritten card)
        </label>
      </div>

      {/* Thumbnail */}
      <ImageUpload
        currentUrl={thumbnailUrl || null}
        onUpload={handleThumbnailUpload}
        onRemove={() => setThumbnailUrl("")}
        label="Thumbnail"
      />

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="A brief description"
        />
      </div>

      {/* Times & Servings */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="servings" className="block text-sm font-medium">
            Servings
          </label>
          <input
            id="servings"
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="prepTime" className="block text-sm font-medium">
            Prep (min)
          </label>
          <input
            id="prepTime"
            type="number"
            min="0"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="cookTime" className="block text-sm font-medium">
            Cook (min)
          </label>
          <input
            id="cookTime"
            type="number"
            min="0"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Ingredients (hidden in image-only mode) */}
      {!isImageOnly && (
        <fieldset>
          <legend className="text-sm font-medium">Ingredients</legend>
          <div className="mt-2 space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                  placeholder="Qty"
                  className="w-20 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                  placeholder="Unit"
                  className="w-20 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, "name", e.target.value)}
                  placeholder="Ingredient name"
                  className="flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="text-muted hover:text-red-500"
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
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
          >
            + Add ingredient
          </button>
        </fieldset>
      )}

      {/* Steps (hidden in image-only mode) */}
      {!isImageOnly && (
        <fieldset>
          <legend className="text-sm font-medium">Steps</legend>
          <div className="mt-2 space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-medium text-accent-dark">
                  {i + 1}
                </span>
                <textarea
                  value={step.instruction}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  rows={2}
                  className="flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="mt-2 text-muted hover:text-red-500"
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
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStep}
            className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
          >
            + Add step
          </button>
        </fieldset>
      )}

      {/* Source URL */}
      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium">
          Source URL
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="https://example.com/recipe"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Personal notes, tips, variations..."
        />
      </div>

      {/* Tags */}
      <fieldset>
        <legend className="text-sm font-medium">Tags</legend>
        <div className="mt-3 space-y-4">
          {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
            <div key={category}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                {categoryLabels[category] ?? category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categoryTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-accent text-white"
                          : "bg-accent-light text-accent-dark hover:bg-accent/20"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : isEditing
              ? "Update recipe"
              : "Save recipe"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
