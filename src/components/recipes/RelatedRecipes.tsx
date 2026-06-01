"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useOnMembershipsChanged } from "@/lib/hooks/use-recipe-memberships";
import RelatedRecipesOverlay, { type RelatedRecipe } from "./RelatedRecipesOverlay";

const VISIBLE_BEFORE_SEE_ALL = 7;

type Props = {
  recipeId: string;
};

export default function RelatedRecipes({ recipeId }: Props) {
  const [related, setRelated] = useState<RelatedRecipe[] | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const { data: myMenus } = await supabase
      .from("menu_recipes")
      .select("menu_id")
      .eq("recipe_id", recipeId);

    const menuIds = (myMenus ?? []).map((r) => r.menu_id);
    if (menuIds.length === 0) {
      setRelated([]);
      return;
    }

    const { data: peers } = await supabase
      .from("menu_recipes")
      .select("recipe_id, recipes(id, slug, title, thumbnail_url)")
      .in("menu_id", menuIds)
      .neq("recipe_id", recipeId);

    const counts = new Map<string, { recipe: RelatedRecipe; count: number }>();
    for (const p of peers ?? []) {
      const r = p.recipes as unknown as RelatedRecipe | null;
      if (!r) continue;
      const existing = counts.get(r.id);
      if (existing) existing.count += 1;
      else counts.set(r.id, { recipe: r, count: 1 });
    }

    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.recipe.title.localeCompare(b.recipe.title))
      .map((c) => c.recipe);

    setRelated(sorted);
  }, [recipeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when SaveMenu pickers add/remove this recipe from a menu.
  useOnMembershipsChanged(recipeId, load);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [related, updateScrollState]);

  function scrollBy(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 144 + 12; // w-36 + gap-3
    const delta = cardWidth * 4 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  const visibleInBar = useMemo(
    () => (related ?? []).slice(0, VISIBLE_BEFORE_SEE_ALL),
    [related]
  );
  const hasMore = (related?.length ?? 0) > VISIBLE_BEFORE_SEE_ALL;

  if (!related || related.length === 0) return null;

  return (
    <div className="print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="font-heading text-xl font-semibold text-foreground transition-colors hover:text-accent"
        >
          Related
          <span className="ml-2 text-sm font-normal text-muted">({related.length})</span>
        </button>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-muted shadow-md transition-colors hover:border-accent hover:text-accent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-muted shadow-md transition-colors hover:border-accent hover:text-accent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
        >
          {visibleInBar.map((r) => (
            <Link
              key={r.id}
              href={`/recipes/${r.slug}`}
              className="group w-36 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {r.thumbnail_url ? (
                  <Image
                    src={r.thumbnail_url}
                    alt={r.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="144px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-2">
                <h4 className="text-xs font-medium leading-tight line-clamp-2">{r.title}</h4>
              </div>
            </Link>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setOverlayOpen(true)}
              className="group flex w-36 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-accent-light/30 text-accent-dark transition-colors hover:border-accent hover:bg-accent-light"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <span className="text-xs font-medium">See all ({related.length})</span>
            </button>
          )}
        </div>
      </div>

      <RelatedRecipesOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        recipes={related}
      />
    </div>
  );
}
