"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type SourceRecipe = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
};

type Props = {
  sourceHostname: string;
  currentRecipeId: string;
};

export default function MoreFromSource({ sourceHostname, currentRecipeId }: Props) {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<SourceRecipe[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch count on mount to decide whether to show the pill at all
  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      const supabase = createClient();
      const { count: total } = await supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .ilike("source_url", `%${sourceHostname}%`)
        .neq("id", currentRecipeId);
      if (!cancelled && total !== null) setCount(total);
    }
    fetchCount();
    return () => { cancelled = true; };
  }, [sourceHostname, currentRecipeId]);

  // Fetch full list only when expanded
  useEffect(() => {
    if (!open || recipes) return;
    let cancelled = false;
    async function fetchRecipes() {
      const supabase = createClient();
      const { data } = await supabase
        .from("recipes")
        .select("id, slug, title, thumbnail_url")
        .ilike("source_url", `%${sourceHostname}%`)
        .neq("id", currentRecipeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled && data) setRecipes(data);
    }
    fetchRecipes();
    return () => { cancelled = true; };
  }, [open, recipes, sourceHostname, currentRecipeId]);

  // Scroll the bar into view once recipes load
  useEffect(() => {
    if (open && recipes && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [open, recipes]);

  const handleToggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  // Don't render anything if there are no other recipes from this source
  if (count === null || count === 0) return null;

  return (
    <>
      {/* Pill toggle — rendered inline next to the source URL */}
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      >
        {count} more from {sourceHostname}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Horizontal scroll row — full width below the source line */}
      {open && (
        <div ref={scrollRef} className="mt-3 w-full">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recipes === null ? (
              <p className="text-xs text-muted py-4">Loading…</p>
            ) : (
              recipes.map((r) => (
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
                      {r.title}
                    </h4>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
