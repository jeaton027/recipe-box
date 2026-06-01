"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { categoryLabels, categoryOrder } from "@/lib/utils/tag-helpers";
import type { Tag } from "@/lib/types/database";

export type RelatedRecipe = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  recipes: RelatedRecipe[];
};

export default function RelatedRecipesOverlay({ open, onClose, recipes }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [recipeTagMap, setRecipeTagMap] = useState<Record<string, string[]>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // Fetch tag data once the overlay opens, scoped to just the recipes we have
  useEffect(() => {
    if (!open || recipes.length === 0) return;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const ids = recipes.map((r) => r.id);
      const [{ data: allTags }, { data: rt }] = await Promise.all([
        supabase.from("tags").select("*").order("name"),
        supabase.from("recipe_tags").select("recipe_id, tag_id").in("recipe_id", ids),
      ]);
      if (cancelled) return;
      setTags(allTags ?? []);
      const map: Record<string, string[]> = {};
      for (const r of rt ?? []) {
        if (!map[r.recipe_id]) map[r.recipe_id] = [];
        map[r.recipe_id].push(r.tag_id);
      }
      setRecipeTagMap(map);
    }
    load();
    return () => { cancelled = true; };
  }, [open, recipes]);

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setSearch("");
    setFilterOpen(false);
    setFilterTagIds([]);
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (filterPanelRef.current?.contains(e.target as Node)) return;
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  function toggleFilterTag(tagId: string) {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const visible = useMemo(() => {
    let pool = recipes;
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (filterTagIds.length > 0) {
      pool = pool.filter((r) => {
        const rTags = recipeTagMap[r.id] ?? [];
        return filterTagIds.every((tid) => rTags.includes(tid));
      });
    }
    return pool;
  }, [recipes, search, filterTagIds, recipeTagMap]);

  const tagsByCategory = useMemo(
    () =>
      tags.reduce((acc: Record<string, Tag[]>, t) => {
        if (!acc[t.category]) acc[t.category] = [];
        acc[t.category].push(t);
        return acc;
      }, {}),
    [tags]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bottom-[60px] z-50 flex justify-center bg-black/30 sm:bottom-0"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="mx-4 mb-8 mt-28 flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl"
      >
        {/* Top bar */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-semibold">Related Recipes</h2>
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search related..."
                className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-light hover:text-foreground"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                filterTagIds.length > 0
                  ? "border-accent bg-accent-light text-accent-dark"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              Filter
              {filterTagIds.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                  {filterTagIds.length}
                </span>
              )}
            </button>
            <span className="text-xs text-muted">{visible.length} of {recipes.length}</span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">No matches.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {visible.map((r) => (
                <Link
                  key={r.id}
                  href={`/recipes/${r.slug}`}
                  onClick={handleClose}
                  className="group overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {r.thumbnail_url ? (
                      <Image
                        src={r.thumbnail_url}
                        alt={r.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 200px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="truncate px-1.5 py-1.5 text-xs font-medium leading-tight">{r.title}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/20"
            onClick={(e) => {
              e.stopPropagation();
              const rect = panelRef.current?.getBoundingClientRect();
              const onPicker =
                rect &&
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;
              if (onPicker) setFilterOpen(false);
              else handleClose();
            }}
          />
          <div
            ref={filterPanelRef}
            className="fixed bottom-[60px] left-0 right-0 z-[70] flex max-h-[70vh] flex-col rounded-t-2xl bg-white shadow-xl md:left-6 md:right-auto md:top-20 md:bottom-6 md:w-[25rem] md:max-h-none md:rounded-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <h2 className="font-heading text-lg font-semibold">Filters</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterTagIds([])}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
                >
                  Done
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pb-14">
              <div className="space-y-5">
                {categoryOrder
                  .filter((cat) => tagsByCategory[cat]?.length > 0)
                  .map((category) => (
                    <div key={category}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        {categoryLabels[category]}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tagsByCategory[category].map((tag) => {
                          const selected = filterTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => toggleFilterTag(tag.id)}
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
