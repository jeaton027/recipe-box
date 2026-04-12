"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Collection, Tag, TagCategory } from "@/lib/types/database";

// ── Constants ────────────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────

export type RecipePickerOverlayProps = {
  open: boolean;
  onClose: () => void;

  /** Label for the primary action button (e.g. "Compare", "Done"). */
  actionLabel: string;
  /** Whether the action button is disabled. */
  actionDisabled?: boolean;
  /** Called when the user clicks the action button. */
  onAction: () => void;

  /** Controlled set of currently-selected recipe IDs. */
  selectedIds: Set<string>;
  /** Called when a recipe card is clicked (toggle in/out of selection). */
  onToggle: (recipe: Recipe) => void;
  /** When set, unselected cards are disabled once this many are selected. */
  maxSelection?: number;

  /** Recipe IDs to hide entirely (e.g. current recipe, existing siblings). */
  excludeIds?: Set<string>;
  /** Per-recipe disable check — shown greyed out at the bottom of results. */
  isDisabled?: (recipe: Recipe) => boolean;
  /** Tooltip shown when hovering a disabled recipe card. */
  disabledTooltip?: string;
  /** Recipe IDs to float to the top of results (e.g. sibling variations). */
  prioritizeIds?: Set<string>;

  /** Optional tray content rendered below the search bar. */
  tray?: React.ReactNode;
  /** Show a close (×) button next to the action button? Default true. */
  showCloseButton?: boolean;
};

// ── Component ────────────────────────────────────────────────────

export default function RecipePickerOverlay({
  open,
  onClose,
  actionLabel,
  actionDisabled,
  onAction,
  selectedIds,
  onToggle,
  maxSelection,
  excludeIds,
  isDisabled,
  disabledTooltip,
  prioritizeIds,
  tray,
  showCloseButton = true,
}: RecipePickerOverlayProps) {
  const supabase = createClient();
  const panelRef = useRef<HTMLDivElement>(null);

  // Shared data (fetched once on open)
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  // Browse / drill-down state
  const [browseMode, setBrowseMode] = useState<BrowseMode>("all");
  const [search, setSearch] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filteredRecipeIds, setFilteredRecipeIds] = useState<string[] | null>(null);

  // ── Fetch recipes + collections + tags on open ─────────────────

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: allRecipes }, { data: cols }, { data: allTags }] =
        await Promise.all([
          supabase.from("recipes").select("*").order("title"),
          supabase.from("collections").select("*").order("name"),
          supabase.from("tags").select("*").order("name"),
        ]);
      setRecipes(allRecipes ?? []);
      setCollections(cols ?? []);
      setTags(allTags ?? []);
      setLoading(false);
    }
    load();
  }, [open, supabase]);

  // ── Body scroll lock ───────────────────────────────────────────

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

  // ── Outside click dismiss ──────────────────────────────────────

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  // ── State reset on close ───────────────────────────────────────

  function handleClose() {
    setBrowseMode("all");
    setSearch("");
    setSelectedCollectionId(null);
    setSelectedTagId(null);
    setFilteredRecipeIds(null);
    onClose();
  }

  // ── Drill-down: collection → recipes ───────────────────────────

  async function selectCollection(colId: string) {
    const { data } = await supabase
      .from("collection_recipes")
      .select("recipe_id")
      .eq("collection_id", colId);
    setFilteredRecipeIds(data?.map((r) => r.recipe_id) ?? []);
    setSelectedCollectionId(colId);
    setSelectedTagId(null);
  }

  // ── Drill-down: tag → recipes ──────────────────────────────────

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

  // ── Build the visible recipe list ──────────────────────────────

  function getVisibleRecipes(): Recipe[] {
    let pool = recipes.filter((r) => !excludeIds?.has(r.id));

    // Drill-down filter
    if (filteredRecipeIds !== null) {
      const idSet = new Set(filteredRecipeIds);
      pool = pool.filter((r) => idSet.has(r.id));
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter((r) => r.title.toLowerCase().includes(q));
    }

    // Sort: prioritized first → normal → disabled last
    return pool.sort((a, b) => {
      const aPri = prioritizeIds?.has(a.id) ? -1 : 0;
      const bPri = prioritizeIds?.has(b.id) ? -1 : 0;
      const aDis = isDisabled?.(a) ? 1 : 0;
      const bDis = isDisabled?.(b) ? 1 : 0;
      return aPri - bPri || aDis - bDis;
    });
  }

  // ── Filtered collections / tags for picker modes ───────────────

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const showingCollectionPicker =
    browseMode === "collections" && !selectedCollectionId;
  const showingTagPicker = browseMode === "tags" && !selectedTagId;

  // ── Render ─────────────────────────────────────────────────────

  if (!open) return null;

  const visible = getVisibleRecipes();

  return (
    <div
      className="fixed inset-0 bottom-[60px] z-50 flex justify-center bg-black/30 sm:bottom-0"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="mx-4 mb-8 mt-28 flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl"
      >
        {/* ── Top bar: search + close + action ──────────────── */}
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

            {/* Close button */}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-light hover:text-foreground"
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
            )}

            {/* Action button */}
            <button
              onClick={onAction}
              disabled={actionDisabled}
              className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionLabel}
            </button>
          </div>

          {/* Tray + browse tabs row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tray}

            {/* Browse mode tabs — right-aligned */}
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

        {/* ── Grid content — scrollable ─────────────────────── */}
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
                "No other recipes found."
              )}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {visible.map((recipe) => {
                const selected = selectedIds.has(recipe.id);
                const disabledByProp = isDisabled?.(recipe) ?? false;
                const disabledByMax =
                  !selected &&
                  maxSelection != null &&
                  selectedIds.size >= maxSelection;
                const disabled = disabledByProp || disabledByMax;
                return (
                  <button
                    key={recipe.id}
                    onClick={() => !disabled && onToggle(recipe)}
                    disabled={disabled}
                    title={disabledByProp ? disabledTooltip : undefined}
                    className={`group relative overflow-hidden rounded-lg text-left transition-shadow ${
                      disabled
                        ? "cursor-not-allowed opacity-40"
                        : "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
                    }`}
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
  );
}
