"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import { compressImage } from "@/lib/utils/compress-image";
import MenuRecipePicker, { type CourseType } from "@/components/menus/MenuRecipePicker";
import type { Recipe } from "@/lib/types/database";

const courseOrder: CourseType[] = ["main", "side", "starter", "drink", "dessert", "other"];
const courseLabels: Record<CourseType, string> = {
  main: "Mains",
  side: "Sides",
  starter: "Starters",
  drink: "Drinks",
  dessert: "Desserts",
  other: "Other",
};

type MenuRecipeEntry = {
  recipe: Recipe;
  course: CourseType;
  sort_order: number;
};

type ExistingMenu = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
};

type Props = {
  menu?: ExistingMenu;
  initialEntries?: MenuRecipeEntry[];
};

export default function MenuForm({ menu, initialEntries = [] }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!menu;

  const [name, setName] = useState(menu?.name ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(menu?.cover_image_url ?? "");
  const [manualCover, setManualCover] = useState(!!menu?.cover_image_url);
  const [entries, setEntries] = useState<MenuRecipeEntry[]>(initialEntries);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCourse, setPickerCourse] = useState<CourseType>("main");

  // All recipe IDs currently in the menu (for excludeIds)
  const excludeIds = new Set(entries.map((e) => e.recipe.id));

  // Auto-derive cover image from entries (unless user manually set one)
  function getAutoCover(): string | null {
    for (const course of courseOrder) {
      const entry = entries.find((e) => e.course === course && e.recipe.thumbnail_url);
      if (entry) return entry.recipe.thumbnail_url;
    }
    return null;
  }

  function handleAddRecipes(recipes: Recipe[], course: CourseType) {
    const maxSort = entries
      .filter((e) => e.course === course)
      .reduce((max, e) => Math.max(max, e.sort_order), -1);

    const newEntries = recipes.map((recipe, i) => ({
      recipe,
      course,
      sort_order: maxSort + 1 + i,
    }));

    setEntries((prev) => [...prev, ...newEntries]);
    setPickerOpen(false);
  }

  function handleRemoveRecipe(recipeId: string) {
    setEntries((prev) => prev.filter((e) => e.recipe.id !== recipeId));
  }

  function openPicker(course: CourseType) {
    setPickerCourse(course);
    setPickerOpen(true);
  }

  async function handleCoverUpload(file: File): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const compressed = await compressImage(file);
    const fileExt = compressed.name.split(".").pop();
    const filePath = `${user.id}/menus/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(filePath, compressed);

    if (error) return null;

    const { data: { publicUrl } } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(filePath);

    setCoverImageUrl(publicUrl);
    setManualCover(true);
    return publicUrl;
  }

  function handleRemoveCover() {
    setCoverImageUrl("");
    setManualCover(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in"); setSaving(false); return; }

    const finalCover = manualCover && coverImageUrl ? coverImageUrl : getAutoCover();

    const payload = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      cover_image_url: finalCover,
    };

    let menuId: string;

    if (isEditing && menu) {
      const { error } = await supabase
        .from("menus")
        .update(payload)
        .eq("id", menu.id);
      if (error) { setError(error.message); setSaving(false); return; }
      menuId = menu.id;

      // Delete existing recipes then re-insert
      await supabase.from("menu_recipes").delete().eq("menu_id", menuId);
    } else {
      const { data, error } = await supabase
        .from("menus")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) { setError(error?.message ?? "Failed to create"); setSaving(false); return; }
      menuId = data.id;
    }

    // Insert all menu_recipes
    if (entries.length > 0) {
      const rows = entries.map((e) => ({
        menu_id: menuId,
        recipe_id: e.recipe.id,
        course: e.course,
        sort_order: e.sort_order,
      }));
      const { error } = await supabase.from("menu_recipes").insert(rows);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    router.push(`/menus/${menuId}`);
    router.refresh();
  }

  // Group entries by course for display
  const entriesByCourse = courseOrder.reduce((acc, course) => {
    acc[course] = entries.filter((e) => e.course === course);
    return acc;
  }, {} as Record<CourseType, MenuRecipeEntry[]>);

  // Show a course section if it has entries, or always show main/side for new menus
  const visibleCourses = courseOrder.filter(
    (course) =>
      entriesByCourse[course].length > 0 ||
      (!isEditing && (course === "main" || course === "side"))
  );

  // Also show an "add another course" option for empty courses
  const emptyCourses = courseOrder.filter(
    (course) => entriesByCourse[course].length === 0 && !visibleCourses.includes(course)
  );

  const effectiveCover = manualCover && coverImageUrl ? coverImageUrl : getAutoCover();

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="menu-name" className="block text-sm font-medium">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="menu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="e.g. Taco Night, Sunday Brunch"
          />
        </div>

        <div>
          <label htmlFor="menu-desc" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="menu-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="description, for how many, or the occasion"
          />
        </div>

        <ImageUpload
          currentUrl={effectiveCover}
          onUpload={handleCoverUpload}
          onRemove={handleRemoveCover}
          label="Cover image"
        />

        {/* Course sections */}
        <div className="space-y-5">
          <h3 className="font-heading text-lg font-semibold">Recipes</h3>

          {visibleCourses.map((course) => (
            <div key={course}>
              <p className="mb-2 text-sm font-medium text-muted">{courseLabels[course]}</p>
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {entriesByCourse[course].map((entry) => (
                    <div
                      key={entry.recipe.id}
                      className="relative w-28 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white"
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {entry.recipe.thumbnail_url ? (
                          <Image
                            src={entry.recipe.thumbnail_url}
                            alt={entry.recipe.title}
                            fill
                            className="object-cover"
                            sizes="112px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <svg
                              className="h-6 w-6 text-gray-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                              />
                            </svg>
                          </div>
                        )}
                        {/* Remove button — always visible in form */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipe(entry.recipe.id)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="truncate px-1.5 py-1 text-[11px] font-medium leading-tight">
                        {entry.recipe.title}
                      </p>
                    </div>
                  ))}

                  {/* Static + Add button at the end */}
                  <button
                    type="button"
                    onClick={() => openPicker(course)}
                    className="flex w-28 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-accent-light/30 text-muted transition-colors hover:border-accent hover:text-accent"
                    style={{ minHeight: entriesByCourse[course].length > 0 ? undefined : "7rem" }}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-xs font-medium">Add</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add another course type */}
          {emptyCourses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emptyCourses.map((course) => (
                <button
                  key={course}
                  type="button"
                  onClick={() => openPicker(course)}
                  className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  + {courseLabels[course]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : isEditing ? "Update menu" : "Create menu"}
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

      <MenuRecipePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={excludeIds}
        onAdd={handleAddRecipes}
        initialCourse={pickerCourse}
      />
    </>
  );
}
