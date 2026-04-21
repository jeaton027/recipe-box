import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import DeleteMenuButton from "./DeleteMenuButton";
import type { Recipe } from "@/lib/types/database";

const courseOrder = ["main", "side", "starter", "drink", "dessert", "other"] as const;
const courseLabels: Record<string, string> = {
  main: "Mains",
  side: "Sides",
  starter: "Starters",
  drink: "Drinks",
  dessert: "Desserts",
  other: "Other",
};

export default async function MenuDetailPage({
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

  // Fetch menu recipes with their recipe data
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

  // Group by course
  type CourseGroup = { recipe: Recipe; sort_order: number }[];
  const byCourse: Record<string, CourseGroup> = {};
  for (const mr of menuRecipes ?? []) {
    const recipe = recipeMap.get(mr.recipe_id);
    if (!recipe) continue;
    if (!byCourse[mr.course]) byCourse[mr.course] = [];
    byCourse[mr.course].push({ recipe, sort_order: mr.sort_order });
  }

  // Sort within each course
  for (const course of Object.keys(byCourse)) {
    byCourse[course].sort((a, b) => a.sort_order - b.sort_order);
  }

  const visibleCourses = courseOrder.filter((c) => byCourse[c]?.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/menus"
              className="mb-1 flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Menus
            </Link>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {menu.name}
            </h1>
            {menu.description && (
              <p className="mt-1 text-sm text-muted">{menu.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/menus/${id}/edit`}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Edit
            </Link>
            <DeleteMenuButton menuId={id} />
          </div>
        </div>
      </div>

      {visibleCourses.length === 0 ? (
        <p className="py-12 text-center text-muted">
          No recipes in this menu yet.{" "}
          <Link href={`/menus/${id}/edit`} className="text-accent hover:text-accent-dark">
            Add some
          </Link>
        </p>
      ) : (
        <div className="space-y-6">
          {visibleCourses.map((course) => (
            <section key={course}>
              <h2 className="font-heading mb-3 text-lg font-semibold">
                {courseLabels[course]}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {byCourse[course].map(({ recipe }) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.slug}`}
                    className="group w-36 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {recipe.thumbnail_url ? (
                        <Image
                          src={recipe.thumbnail_url}
                          alt={recipe.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="144px"
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
                    </div>
                    <div className="p-2">
                      <h4 className="text-xs font-medium leading-tight line-clamp-2">
                        {recipe.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
