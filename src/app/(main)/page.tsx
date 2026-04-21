import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeSection from "@/components/home/HomeSection";
import { dailyPick, currentSeason } from "@/lib/utils/daily-pick";
import type { Recipe, Tag } from "@/lib/types/database";

export const revalidate = 0; // always fresh on navigation

export default async function HomePage() {
  const supabase = await createClient();

  // ── Fetch tags for the seasonal pick ──
  const { data: allTags } = await supabase
    .from("tags")
    .select("*")
    .in("category", ["meal_type", "cuisine", "season"])
    .order("name");

  const tags = (allTags ?? []) as Tag[];

  // Prefer a season tag matching the current season, otherwise daily-pick
  // from the eligible categories (meal_type, cuisine, season).
  const season = currentSeason();
  const seasonTag = tags.find(
    (t) => t.category === "season" && t.name === season
  );
  const pickedTag = seasonTag ?? dailyPick(tags);

  // ── Build all queries in parallel ──
  const [
    seasonalResult,
    triedResult,
    recentResult,
    savedResult,
  ] = await Promise.all([
    // 1. Seasonal / daily pick
    pickedTag
      ? supabase
          .from("recipe_tags")
          .select("recipe_id")
          .eq("tag_id", pickedTag.id)
      : Promise.resolve({ data: [] as { recipe_id: string }[] }),

    // 2. Recently made — recipes the user actually entered Cook Mode for.
    // Implicit signal (stamped on cook-mode entry) rather than a curated
    // status bookmark. See src/components/cook/StampLastCooked.tsx.
    supabase
      .from("recipes")
      .select("*")
      .not("last_cooked_at", "is", null)
      .order("last_cooked_at", { ascending: false })
      .limit(12),

    // 3. Recently added
    supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12),

    // 4. Try something new (saved, random-ish via daily seed)
    supabase
      .from("recipes")
      .select("*")
      .eq("status", "saved")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  // Resolve seasonal recipe IDs → full recipes
  let seasonalRecipes: Recipe[] = [];
  if (pickedTag && seasonalResult.data && seasonalResult.data.length > 0) {
    const ids = seasonalResult.data.map((r) => r.recipe_id);
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .in("id", ids)
      .limit(12);
    seasonalRecipes = data ?? [];
  }

  const triedRecipes = (triedResult.data ?? []) as Recipe[];
  const recentRecipes = (recentResult.data ?? []) as Recipe[];

  // Shuffle the saved recipes deterministically for "try something new"
  const savedPool = (savedResult.data ?? []) as Recipe[];
  const today = new Date().toISOString().slice(0, 10);
  const shuffled = savedPool
    .map((r) => ({
      recipe: r,
      sort: hashForShuffle(r.id + today),
    }))
    .sort((a, b) => a.sort - b.sort)
    .map((r) => r.recipe)
    .slice(0, 12);

  // Build seasonal section title
  const seasonalTitle = pickedTag
    ? pickedTag.category === "season"
      ? `${pickedTag.name} Recipes`
      : pickedTag.name
    : "Seasonal Picks";

  const hasAnyRecipes =
    seasonalRecipes.length > 0 ||
    triedRecipes.length > 0 ||
    recentRecipes.length > 0 ||
    shuffled.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Recipe Box
          </h1>
          <p className="mt-1 text-muted">Your personal recipe collection</p>
        </div>
        <Link
          href="/recipes/import"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Add recipe
        </Link>
      </div>

      {hasAnyRecipes ? (
        <>
          {/* 1. Seasonal / daily pick */}
          <HomeSection
            title={seasonalTitle}
            subtitle={
              pickedTag?.category === "season"
                ? `Recipes tagged "${pickedTag.name}" for the season`
                : pickedTag
                ? `Today's pick: ${pickedTag.name}`
                : undefined
            }
            recipes={seasonalRecipes}
          />

          {/* 2. Recently made */}
          <HomeSection
            title="Recently Made"
            subtitle="Recipes you've cooked recently"
            recipes={triedRecipes}
          />

          {/* 3. Recently added */}
          <HomeSection
            title="Recently Added"
            recipes={recentRecipes}
            viewAllHref="/recipes"
            viewAllLabel="View all"
          />

          {/* 4. Try something new */}
          <HomeSection
            title="Try Something New"
            subtitle="Recipes you haven't tried yet"
            recipes={shuffled}
          />
        </>
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
          <h2 className="font-heading text-xl font-semibold">No recipes yet</h2>
          <p className="mt-1 text-sm text-muted">
            Start building your collection by adding your first recipe.
          </p>
          <Link
            href="/recipes/import"
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Add your first recipe
          </Link>
        </div>
      )}
    </div>
  );
}

// Simple hash for deterministic daily shuffle
function hashForShuffle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h;
}
