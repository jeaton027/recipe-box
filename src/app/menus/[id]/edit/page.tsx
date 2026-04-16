import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuForm from "@/components/menus/MenuForm";
import type { Recipe } from "@/lib/types/database";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: menu } = await supabase
    .from("menus")
    .select("*")
    .eq("id", id)
    .single();

  if (!menu) notFound();

  // Fetch menu recipes
  const { data: menuRecipes } = await supabase
    .from("menu_recipes")
    .select("recipe_id, course, sort_order")
    .eq("menu_id", id)
    .order("sort_order");

  const recipeIds = (menuRecipes ?? []).map((mr) => mr.recipe_id);
  let recipes: Recipe[] = [];
  if (recipeIds.length > 0) {
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .in("id", recipeIds);
    recipes = data ?? [];
  }

  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const initialEntries = (menuRecipes ?? [])
    .map((mr) => {
      const recipe = recipeMap.get(mr.recipe_id);
      if (!recipe) return null;
      return {
        recipe,
        course: mr.course as "main" | "side" | "starter" | "drink" | "dessert" | "other",
        sort_order: mr.sort_order,
      };
    })
    .filter(Boolean) as { recipe: Recipe; course: "main" | "side" | "starter" | "drink" | "dessert" | "other"; sort_order: number }[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl font-bold tracking-tight">
        Edit Menu
      </h1>
      <MenuForm
        menu={{
          id: menu.id,
          name: menu.name,
          description: menu.description,
          cover_image_url: menu.cover_image_url,
        }}
        initialEntries={initialEntries}
      />
    </div>
  );
}
