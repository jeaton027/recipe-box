"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Collection, Tag, TagCategory } from "@/lib/types/database";

const MAX_COMPARE = 2; // MVP: 2-recipe max

type BrowseMode = "all" | "collections" | "tags";

const categoryLabels: Record<TagCategory, string> = {
  meal_type: "Meal Type",
  season: "Season",
  cuisine: "Cuisine",
  dietary: "Dietary",
  method: "Method",
  occasion: "Occasion",
  custom: "Custom",
};

const categoryOrder: TagCategory[] = [
  "meal_type",
  "cuisine",
  "occasion",
  "dietary",
  "method",
  "season",
  "custom",
];

type Props = {
  currentRecipeId: string;
  currentRecipeSlug: string;
  currentRecipeTitle: string;
  currentRecipeThumbnail: string | null;
  familyId: string | null;
};

export default function CompareButton({
  currentRecipeId,
  currentRecipeSlug,
  currentRecipeTitle,
  currentRecipeThumbnail,
  familyId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [siblingIds, setSiblingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // Slug-ordered list of recipes chosen for the comparison.
  // The current recipe is always locked at position 0.
  const [traySlugs, setTraySlugs] = useState<string[]>([currentRecipeSlug]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Browse mode + drilldown state (mirrors AddRecipeToCollectionButton)
  const [browseMode, setBrowseMode] = useState<BrowseMode>("all");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filteredRecipeIds, setFilteredRecipeIds] = useState<string[] | null>(null);

  // Load all recipes + sibling ids + collections + tags when opened
  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: allRecipes }, siblingsRes, { data: cols }, { data: allTags }] =
        await Promise.all([
          supabase.from("recipes").select("*").order("title"),
          familyId
            ? supabase
                .from("recipes")
                .select("id")
                .eq("family_id", familyId)
                .neq("id", currentRecipeId)
            : Promise.resolve({ data: [] as { id: string }[] }),
          supabase.from("collections").select("*").order("name"),
          supabase.from("tags").select("*").order("name"),
        ]);
      setRecipes(allRecipes ?? []);
      setSiblingIds(new Set((siblingsRes.data ?? []).map((r) => r.id)));
      setCollections(cols ?? []);
      setTags(allTags ?? []);
      setLoading(false);
    }
    load();
  }, [open, currentRecipeId, familyId, supabase]);

  // Drill into a collection → show only that collection's recipes.
  // We fetch FIRST, then flip the drilldown state so the picker stays
  // visible during the query (instead of briefly flashing the full "all
  // recipes" grid while filteredRecipeIds is still null).
  async function selectCollection(colId: string) {
    const { data } = await supabase
      .from("collection_recipes")
      .select("recipe_id")
      .eq("collection_id", colId);
    setFilteredRecipeIds(data?.map((r) => r.recipe_id) ?? []);
    setSelectedCollectionId(colId);
    setSelectedTagId(null);
  }

  // Drill into a tag → show only recipes with that tag. Same fetch-first
  // pattern as selectCollection above to avoid the "all recipes" flash.
  async function selectTag(tagId: string) {
    const { data } = await supabase
      .from("recipe_tags")
      .select("recipe_id")
      .eq("tag_id", tagId);
    setFilteredRecipeIds(data?.map((r) => r.recipe_id) ?? []);
    setSelectedTagId(tagId);
    setSelectedCollectionId(null);
  }

  function handleBack() {
    setSelectedCollectionId(null);
    setSelectedTagId(null);
    setFilteredRecipeIds(null);
    setSearch("");
  }

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  function handleClose() {
    setOpen(false);
    setSearch("");
    setTraySlugs([currentRecipeSlug]);
    setBrowseMode("all");
    setSelectedCollectionId(null);
    setSelectedTagId(null);
    setFilteredRecipeIds(null);
  }

  function toggleRecipe(recipe: Recipe) {
    // The current recipe is locked in — you can't remove it.
    if (recipe.slug === currentRecipeSlug) return;
    setTraySlugs((prev) => {
      if (prev.includes(recipe.slug)) {
        return prev.filter((s) => s !== recipe.slug);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, recipe.slug];
    });
  }

  function removeFromTray(slug: string) {
    if (slug === currentRecipeSlug) return;
    setTraySlugs((prev) => prev.filter((s) => s !== slug));
  }

  function handleCompare() {
    if (traySlugs.length < 2) return;
    router.push(`/compare?slugs=${traySlugs.join(",")}`);
  }

  // Build the visible recipe list. In "all" mode we put siblings first.
  // When drilled into a collection/tag we filter to that subset and keep
  // the title ordering without the siblings-first shuffle.
  function getVisibleRecipes(): Recipe[] {
    const q = search.trim().toLowerCase();
    const matchesSearch = (r: Recipe) =>
      !q || r.title.toLowerCase().includes(q);

    // Drilled into a collection or tag → show only filtered recipes
    if (filteredRecipeIds !== null) {
      const idSet = new Set(filteredRecipeIds);
      return recipes.filter(
        (r) => idSet.has(r.id) && r.id !== currentRecipeId && matchesSearch(r)
      );
    }

    // Default "all" mode — siblings first, then everything else
    const siblings = recipes.filter(
      (r) => siblingIds.has(r.id) && matchesSearch(r)
    );
    const others = recipes.filter(
      (r) =>
        !siblingIds.has(r.id) &&
        r.id !== currentRecipeId &&
        matchesSearch(r)
    );
    return [...siblings, ...others];
  }

  // Filter collections/tags by the search box while in picker mode
  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const showingCollectionPicker =
    browseMode === "collections" && !selectedCollectionId;
  const showingTagPicker = browseMode === "tags" && !selectedTagId;

  const trayRecipes = traySlugs
    .map((slug) => {
      if (slug === currentRecipeSlug) {
        return {
          id: currentRecipeId,
          slug: currentRecipeSlug,
          title: currentRecipeTitle,
          thumbnail_url: currentRecipeThumbnail,
        };
      }
      const r = recipes.find((x) => x.slug === slug);
      return r
        ? {
            id: r.id,
            slug: r.slug,
            title: r.title,
            thumbnail_url: r.thumbnail_url,
          }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const visible = getVisibleRecipes();
  const canCompare = traySlugs.length >= 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent-dark transition-colors"
        title="Compare this recipe with another"
      >
        Compare
      </button>

      {open && (
        <div
          className="fixed inset-0 bottom-[60px] sm:bottom-0 z-50 flex justify-center bg-black/30"
          onClick={handleOverlayClick}
        >
          <div
            ref={panelRef}
            className="mx-4 mt-28 mb-8 flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl"
          >
            {/* Top bar: search + close + Compare action */}
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Back arrow when drilled into a collection/tag */}
                {(selectedCollectionId || selectedTagId) && (
                  <button
                    onClick={handleBack}
                    className="shrink-0 text-muted hover:text-foreground"
                    aria-label="Back"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                )}

                <div className="relative flex-1">
                  <svg
                    className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      showingCollectionPicker
                        ? "Search collections..."
                        : showingTagPicker
                        ? "Search tags..."
                        : "Search recipes..."
                    }
                    className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-accent-light hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
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

                <button
                  onClick={handleCompare}
                  disabled={!canCompare}
                  className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Compare
                </button>
              </div>

              {/* Comparison tray + browse mode tabs */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">Comparing:</span>
                {trayRecipes.map((r) => {
                  const isCurrent = r.slug === currentRecipeSlug;
                  return (
                    <span
                      key={r.slug}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-medium ${
                        isCurrent
                          ? "border-accent bg-accent-light text-accent-dark"
                          : "border-border bg-white text-foreground"
                      }`}
                    >
                      <span className="relative h-5 w-5 overflow-hidden rounded-full bg-gray-100">
                        {r.thumbnail_url ? (
                          <Image
                            src={r.thumbnail_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="20px"
                          />
                        ) : null}
                      </span>
                      <span className="max-w-[160px] truncate">{r.title}</span>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => removeFromTray(r.slug)}
                          className="ml-0.5 text-muted hover:text-foreground"
                          aria-label={`Remove ${r.title}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                {traySlugs.length < MAX_COMPARE && (
                  <span className="text-xs text-muted">
                    Pick {MAX_COMPARE - traySlugs.length} more below
                  </span>
                )}

                {/* Browse mode tabs — right-aligned on the same row */}
                <div className="ml-auto flex gap-1">
                  {(["all", "collections", "tags"] as BrowseMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setBrowseMode(m);
                        setSelectedCollectionId(null);
                        setSelectedTagId(null);
                        setFilteredRecipeIds(null);
                        setSearch("");
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        browseMode === m
                          ? "bg-accent text-white"
                          : "bg-accent-light text-accent-dark hover:bg-accent hover:text-white"
                      }`}
                    >
                      {m === "all"
                        ? "All Recipes"
                        : m === "collections"
                        ? "Collections"
                        : "Tags"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid content — scrollable. Shows recipes, a collection picker,
                or a tag picker depending on the current browse mode. */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="py-12 text-center text-sm text-muted">Loading...</p>
              ) : showingCollectionPicker ? (
                filteredCollections.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">
                    {search ? (
                      <>No collections matching &ldquo;{search}&rdquo;</>
                    ) : (
                      "No collections yet."
                    )}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {filteredCollections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => {
                          selectCollection(col.id);
                          setSearch("");
                        }}
                        className="group overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <div className="relative aspect-square bg-accent-light">
                          {col.cover_image_url ? (
                            <Image
                              src={col.cover_image_url}
                              alt={col.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 33vw, 200px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <svg
                                className="h-8 w-8 text-accent/30"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="truncate px-1.5 py-1.5 text-xs font-medium leading-tight">
                          {col.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              ) : showingTagPicker ? (
                (() => {
                  const tagsByCategory = filteredTags.reduce(
                    (acc: Record<string, Tag[]>, tag: Tag) => {
                      if (!acc[tag.category]) acc[tag.category] = [];
                      acc[tag.category].push(tag);
                      return acc;
                    },
                    {} as Record<string, Tag[]>
                  );
                  const orderedCategories = categoryOrder.filter(
                    (cat) => tagsByCategory[cat]?.length > 0
                  );

                  if (orderedCategories.length === 0) {
                    return (
                      <p className="py-12 text-center text-sm text-muted">
                        {search ? (
                          <>No tags matching &ldquo;{search}&rdquo;</>
                        ) : (
                          "No tags yet."
                        )}
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-8">
                      {orderedCategories.map((category) => (
                        <section key={category} className="text-center">
                          <h3 className="font-heading mb-3 text-sm font-semibold tracking-wide text-muted">
                            {categoryLabels[category]}
                          </h3>
                          <div className="mx-auto inline-flex max-w-xl flex-wrap justify-center gap-1.5">
                            {tagsByCategory[category].map((tag: Tag) => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  selectTag(tag.id);
                                  setSearch("");
                                }}
                                className="rounded-sm bg-accent/5 px-1 py-1 text-sm font-medium text-accent-dark transition-colors hover:bg-accent/70 hover:text-white"
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  );
                })()
              ) : visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">
                  {search ? (
                    <>No recipes matching &ldquo;{search}&rdquo;</>
                  ) : (
                    "No other recipes to compare with."
                  )}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {visible.map((recipe) => {
                    const inTray = traySlugs.includes(recipe.slug);
                    const disabled = !inTray && traySlugs.length >= MAX_COMPARE;
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => toggleRecipe(recipe)}
                        disabled={disabled}
                        className="group relative overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <div className="relative aspect-square bg-gray-100">
                          {recipe.thumbnail_url ? (
                            <Image
                              src={recipe.thumbnail_url}
                              alt={recipe.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 33vw, 200px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <svg
                                className="h-8 w-8 text-gray-300"
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
                          {inTray && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <svg
                                className="h-8 w-8 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 12.75 6 6 9-13.5"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="truncate px-1.5 py-1.5 text-xs font-medium leading-tight">
                          {recipe.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
