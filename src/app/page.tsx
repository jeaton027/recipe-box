import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RecipeGrid from "@/components/recipes/RecipeGrid";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(8);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Recipe Box
          </h1>
          <p className="mt-1 text-muted">
            Your personal recipe collection
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Add recipe
        </Link>
      </div>

      {recipes && recipes.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">
              Recently updated
            </h2>
            <Link
              href="/recipes"
              className="text-sm font-medium text-accent hover:text-accent-dark"
            >
              View all
            </Link>
          </div>
          <RecipeGrid recipes={recipes} />
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 rounded-full bg-accent-light p-4">
            <svg
              className="h-8 w-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-semibold">
            No recipes yet
          </h2>
          <p className="mt-1 text-sm text-muted">
            Start building your collection by adding your first recipe.
          </p>
          <Link
            href="/recipes/new"
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Add your first recipe
          </Link>
        </div>
      )}
    </div>
  );
}
