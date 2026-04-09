"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import RecipeGrid from "@/components/recipes/RecipeGrid";
import RecipeListItem from "@/components/browse/RecipeListItem";
import type { Recipe, Tag, TagCategory } from "@/lib/types/database";

const categoryLabels: Record<TagCategory, string> = {
  meal_type: "Meal Type",
  season: "Season",
  cuisine: "Cuisine",
  dietary: "Dietary",
  method: "Method",
  occasion: "Occasion",
  custom: "Custom",
};

type Props = {
  initialRecipes: Recipe[];
  allTags: Tag[];
  initialQuery: string;
  initialTagIds: string[];
};

export default function SearchClient({
  initialRecipes,
  allTags,
  initialQuery,
  initialTagIds,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingTagIds, setPendingTagIds] = useState<string[]>(initialTagIds);
  const [isListView, setIsListView] = useState(false);

  const tagsByCategory = allTags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = [];
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  const activeTagNames = initialTagIds
    .map((id) => allTags.find((t) => t.id === id)?.name)
    .filter(Boolean) as string[];

  function buildUrl(q: string, tagIds: string[]) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tagIds.length > 0) params.set("tags", tagIds.join(","));
    return `/search?${params.toString()}`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl(query, initialTagIds));
  }

  function handleApplyFilters() {
    setFilterOpen(false);
    router.push(buildUrl(query, pendingTagIds));
  }

  function handleRemoveTag(tagId: string) {
    const newTagIds = initialTagIds.filter((id) => id !== tagId);
    setPendingTagIds(newTagIds);
    router.push(buildUrl(query, newTagIds));
  }

  function togglePendingTag(tagId: string) {
    setPendingTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const hasResults = initialRecipes.length > 0;
  const hasSearch = initialQuery || initialTagIds.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl font-bold tracking-tight">
        Search
      </h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes..."
          className="flex-1 rounded-md border border-border bg-white px-4 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingTagIds(initialTagIds);
            setFilterOpen(true);
          }}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
            initialTagIds.length > 0
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-muted hover:border-accent hover:text-foreground"
          }`}
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
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
            />
          </svg>
          Filter
          {initialTagIds.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
              {initialTagIds.length}
            </span>
          )}
        </button>
      </form>

      {/* Active filter chips */}
      {activeTagNames.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {initialTagIds.map((tagId, i) => (
            <button
              key={tagId}
              onClick={() => handleRemoveTag(tagId)}
              className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white"
            >
              {activeTagNames[i]}
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Results header */}
      {hasSearch && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">
            {hasResults
              ? `${initialRecipes.length} ${initialRecipes.length === 1 ? "recipe" : "recipes"}`
              : "No recipes found"}
          </p>
          {hasResults && (
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setIsListView(false)}
                className={`rounded-md p-1.5 transition-colors ${
                  !isListView ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
                title="Grid view"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              </button>
              <button
                onClick={() => setIsListView(true)}
                className={`rounded-md p-1.5 transition-colors ${
                  isListView ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
                title="List view"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasSearch && hasResults && (
        <div className="mt-4">
          {isListView ? (
            <div className="space-y-2">
              {initialRecipes.map((recipe) => (
                <RecipeListItem key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <RecipeGrid recipes={initialRecipes} />
          )}
        </div>
      )}

      {/* Empty prompt */}
      {!hasSearch && (
        <p className="mt-12 text-center text-sm text-muted">
          Type a recipe name above, or use filters to browse by tag.
        </p>
      )}

      {/* Filter panel overlay */}
      {filterOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleApplyFilters}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-80 md:max-h-[70vh] md:rounded-xl">
            {/* Sticky top bar */}
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <h2 className="font-heading text-lg font-semibold">Filter by tag</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingTagIds([]);
                    setFilterOpen(false);
                    router.push(buildUrl(query, []));
                  }}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Scrollable tag content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                  <div key={category}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {categoryLabels[category as TagCategory] ?? category}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {categoryTags.map((tag) => {
                        const selected = pendingTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => togglePendingTag(tag.id)}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
