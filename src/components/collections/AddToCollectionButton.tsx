"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Collection } from "@/lib/types/database";

export default function AddToCollectionButton({ recipeId }: { recipeId: string }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: cols }, { data: memberships }] = await Promise.all([
        supabase.from("collections").select("*").order("name"),
        supabase.from("collection_recipes").select("collection_id").eq("recipe_id", recipeId),
      ]);
      setCollections(cols ?? []);
      setMemberOf(new Set(memberships?.map((m) => m.collection_id) ?? []));
      setLoading(false);
    }
    load();
  }, [open, recipeId, supabase]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function toggleCollection(collectionId: string) {
    if (memberOf.has(collectionId)) {
      await supabase
        .from("collection_recipes")
        .delete()
        .eq("collection_id", collectionId)
        .eq("recipe_id", recipeId);
      setMemberOf((prev) => { const next = new Set(prev); next.delete(collectionId); return next; });
    } else {
      await supabase
        .from("collection_recipes")
        .insert({ collection_id: collectionId, recipe_id: recipeId });
      setMemberOf((prev) => new Set(prev).add(collectionId));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Save to collection
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-white py-1 shadow-lg">
          {loading ? (
            <p className="px-4 py-3 text-xs text-muted">Loading...</p>
          ) : collections.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted">
              No collections yet.{" "}
              <a href="/collections/new" className="text-accent hover:underline">
                Create one
              </a>
            </div>
          ) : (
            collections.map((col) => {
              const isMember = memberOf.has(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => toggleCollection(col.id)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isMember
                        ? "border-accent bg-accent text-white"
                        : "border-border"
                    }`}
                  >
                    {isMember && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{col.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
