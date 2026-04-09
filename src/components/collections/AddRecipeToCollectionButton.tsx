"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Collection, Tag, TagCategory } from "@/lib/types/database";

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

export default function AddRecipeToCollectionButton({
  collectionId,
}: {
  collectionId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Browse mode: all recipes, by collection, or by tag
  const [browseMode, setBrowseMode] = useState<BrowseMode>("all");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filteredRecipeIds, setFilteredRecipeIds] = useState<string[] | null>(null);

  // Load all recipes + current members when opened
  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: allRecipes }, { data: memberships }, { data: cols }, { data: allTags }] =
        await Promise.all([
          supabase.from("recipes").select("*").order("title"),
          supabase
            .from("collection_recipes")
            .select("recipe_id")
            .eq("collection_id", collectionId),
          supabase.from("collections").select("*").order("name"),
          supabase.from("tags").select("*").order("name"),
        ]);
      setRecipes(allRecipes ?? []);
      setMemberIds(new Set(memberships?.map((m) => m.recipe_id) ?? []));
      setCollections(cols ?? []);
      setTags(allTags ?? []);
      setLoading(false);
    }
    load();
  }, [open, collectionId, supabase]);

  // Lock body scroll
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

  // Load recipes for a selected collection
  async function selectCollection(colId: string) {
    setSelectedCollectionId(colId);
    setSelectedTagId(null);
    const { data } = await supabase
      .from("collection_recipes")
      .select("recipe_id")
      .eq("collection_id", colId);
    setFilteredRecipeIds(data?.map((r) => r.recipe_id) ?? []);
  }

  // Load recipes for a selected tag
  async function selectTag(tagId: string) {
    setSelectedTagId(tagId);
    setSelectedCollectionId(null);
    const { data } = await supabase
      .from("recipe_tags")
      .select("recipe_id")
      .eq("tag_id", tagId);
    setFilteredRecipeIds(data?.map((r) => r.recipe_id) ?? []);
  }

  function handleBack() {
    setSelectedCollectionId(null);
    setSelectedTagId(null);
    setFilteredRecipeIds(null);
    setSearch("");
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  function handleClose() {
    setOpen(false);
    setSearch("");
    setBrowseMode("all");
    setSelectedCollectionId(null);
    setSelectedTagId(null);
    setFilteredRecipeIds(null);
    router.refresh();
  }

  async function toggleRecipe(recipeId: string) {
    const wasMember = memberIds.has(recipeId);
    // Optimistic update
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (wasMember) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });

    if (wasMember) {
      await supabase
        .from("collection_recipes")
        .delete()
        .eq("collection_id", collectionId)
        .eq("recipe_id", recipeId);
    } else {
      await supabase
        .from("collection_recipes")
        .insert({ collection_id: collectionId, recipe_id: recipeId });
    }
  }

  // Determine what recipes to show
  function getVisibleRecipes(): Recipe[] {
    let pool = recipes;

    // Filter by collection or tag selection
    if (filteredRecipeIds !== null) {
      const idSet = new Set(filteredRecipeIds);
      pool = pool.filter((r) => idSet.has(r.id));
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter((r) => r.title.toLowerCase().includes(q));
    }

    return pool;
  }

  // Filter collections/tags by search
  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Are we showing the collection/tag picker (not yet drilled into one)?
  const showingCollectionPicker =
    browseMode === "collections" && !selectedCollectionId;
  const showingTagPicker = browseMode === "tags" && !selectedTagId;
  const showingPicker = showingCollectionPicker || showingTagPicker;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
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
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Add Recipe
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
            {/* Top bar */}
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Back button when drilled into a collection/tag */}
                {(selectedCollectionId || selectedTagId) && (
                  <button
                    onClick={handleBack}
                    className="shrink-0 text-muted hover:text-foreground"
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

                {/* Search */}
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

                {/* Done */}
                <button
                  onClick={handleClose}
                  className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
                >
                  Done
                </button>
              </div>

              {/* Browse mode tabs */}
              <div className="mt-3 flex gap-1">
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

            {/* Grid content — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="py-12 text-center text-sm text-muted">
                  Loading...
                </p>
              ) : showingCollectionPicker ? (
                /* Collection grid */
                filteredCollections.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">
                    {search
                      ? <>No collections matching &ldquo;{search}&rdquo;</>
                      : "No collections yet."}
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
                        <p className="px-1.5 py-1.5 text-xs font-medium leading-tight truncate">
                          {col.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              ) : showingTagPicker ? (
                /* Tag grid — grouped by category */
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
                        {search
                          ? <>No tags matching &ldquo;{search}&rdquo;</>
                          : "No tags yet."}
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
              ) : (
                /* Recipe grid */
                (() => {
                  const visible = getVisibleRecipes();
                  if (visible.length === 0) {
                    return (
                      <p className="py-12 text-center text-sm text-muted">
                        {search
                          ? <>No recipes matching &ldquo;{search}&rdquo;</>
                          : "No recipes found."}
                      </p>
                    );
                  }
                  return (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                      {visible.map((recipe) => {
                        const selected = memberIds.has(recipe.id);
                        return (
                          <button
                            key={recipe.id}
                            onClick={() => toggleRecipe(recipe.id)}
                            className="group relative overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
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

                              {/* Selected overlay */}
                              {selected && (
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
                            <p className="px-1.5 py-1.5 text-xs font-medium leading-tight truncate">
                              {recipe.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
