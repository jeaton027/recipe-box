"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Collection } from "@/lib/types/database";

export default function AddToCollectionButton({
  recipeId,
  recipeThumbnail,
}: {
  recipeId: string;
  recipeThumbnail?: string | null;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // New collection inline form state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);

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

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch("");
      setCreating(false);
      setNewName("");
    }
  }

  function handleClose() {
    setOpen(false);
    setSearch("");
    setCreating(false);
    setNewName("");
  }

  async function toggleCollection(collectionId: string) {
    const wasMember = memberOf.has(collectionId);
    setMemberOf((prev) => {
      const next = new Set(prev);
      if (wasMember) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
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

  async function handleCreateCollection() {
    if (!newName.trim()) return;
    setSavingNew(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingNew(false); return; }

    // Create the collection with the recipe's thumbnail as cover image
    const { data: newCol, error } = await supabase
      .from("collections")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        cover_image_url: recipeThumbnail || null,
      })
      .select("*")
      .single();

    if (error || !newCol) { setSavingNew(false); return; }

    // Add this recipe to the new collection
    await supabase
      .from("collection_recipes")
      .insert({ collection_id: newCol.id, recipe_id: recipeId });

    // Update local state
    setCollections((prev) => [...prev, newCol]);
    setMemberOf((prev) => new Set(prev).add(newCol.id));
    setCreating(false);
    setNewName("");
    setSavingNew(false);
  }

  const filtered = collections.filter((col) =>
    col.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Save to collection
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-center bg-black/30"
          onClick={handleOverlayClick}
        >
          <div
            ref={panelRef}
            className="mx-4 mt-28 mb-8 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl"
          >
            {/* Top bar: search + new collection + done */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search collections..."
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { setCreating(true); setSearch(""); }}
                className="shrink-0 rounded-md bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-accent-dark hover:bg-accent-light transition-colors"
              >
                New Collection
              </button>
              <button
                onClick={handleClose}
                className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
              >
                Done
              </button>
            </div>

            {/* Inline new collection form */}
            {creating && (
              <div className="flex items-center gap-3 border-b border-border bg-accent-light/30 px-4 py-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); }}
                  placeholder="Collection name..."
                  autoFocus
                  className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={handleCreateCollection}
                  disabled={!newName.trim() || savingNew}
                  className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {savingNew ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Grid content — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="py-12 text-center text-sm text-muted">Loading collections...</p>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted">
                  {collections.length === 0 ? (
                    <>No collections yet. Click <strong>New Collection</strong> above to create one.</>
                  ) : (
                    <>No collections matching &ldquo;{search}&rdquo;</>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filtered.map((col) => {
                    const selected = memberOf.has(col.id);
                    return (
                      <button
                        key={col.id}
                        onClick={() => toggleCollection(col.id)}
                        className="group relative overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {/* Square image */}
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

                          {/* Selected overlay */}
                          {selected && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <svg
                                className="h-8 w-8 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.5}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Name below image */}
                        <p className="px-1.5 py-1.5 text-xs font-medium leading-tight truncate">
                          {col.name}
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
