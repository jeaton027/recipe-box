import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CompareLayout from "@/components/compare/CompareLayout";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ slugs?: string }>;
}) {
  const { slugs } = await searchParams;
  const slugList = (slugs ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2); // MVP: 2-recipe max

  if (slugList.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">Compare recipes</h1>
        <p className="mt-3 text-muted">
          Select at least two recipes to compare from a recipe&rsquo;s page.
        </p>
        <Link
          href="/recipes"
          className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Browse recipes
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  // Fetch the recipes in parallel, preserving the order given in the URL
  const recipeResults = await Promise.all(
    slugList.map((slug) =>
      supabase.from("recipes").select("*").eq("slug", slug).single()
    )
  );

  const recipes = recipeResults
    .map((r) => r.data)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (recipes.length < 2) notFound();

  // Fetch ingredients + steps for each recipe in parallel
  const details = await Promise.all(
    recipes.map((r) =>
      Promise.all([
        supabase
          .from("ingredients")
          .select("*")
          .eq("recipe_id", r.id)
          .order("sort_order"),
        supabase
          .from("steps")
          .select("*")
          .eq("recipe_id", r.id)
          .order("sort_order"),
      ])
    )
  );

  const compareData = recipes.map((recipe, i) => ({
    recipe,
    ingredients: details[i][0].data ?? [],
    steps: details[i][1].data ?? [],
  }));

  return <CompareLayout recipes={compareData} />;
}
