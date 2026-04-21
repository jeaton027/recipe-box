"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Collection } from "@/lib/types/database";
import ItemPickerOverlay, {
  type PickerItem,
} from "@/components/shared/ItemPickerOverlay";

type Props = {
  recipeId: string;
  recipeThumbnail?: string | null;
  /** Render-prop trigger. If omitted, a default button is rendered. */
  trigger?: (open: () => void) => React.ReactNode;
  /** Externally controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function AddToCollectionButton({
  recipeId,
  recipeThumbnail,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const supabase = createClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const [{ data: cols }, { data: memberships }] = await Promise.all([
        supabase.from("collections").select("*").order("name"),
        supabase
          .from("collection_recipes")
          .select("collection_id")
          .eq("recipe_id", recipeId),
      ]);
      setCollections(cols ?? []);
      setMemberOf(new Set(memberships?.map((m) => m.collection_id) ?? []));
      setLoading(false);
    }
    load();
  }, [open, recipeId, supabase]);

  async function toggleCollection(collectionId: string) {
    const wasMember = memberOf.has(collectionId);
    setMemberOf((prev) => {
      const next = new Set(prev);
      if (wasMember) next.delete(collectionId);
      else next.add(collectionId);
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

  async function createCollection(name: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newCol, error } = await supabase
      .from("collections")
      .insert({
        user_id: user.id,
        name,
        cover_image_url: recipeThumbnail || null,
      })
      .select("*")
      .single();

    if (error || !newCol) return;

    await supabase
      .from("collection_recipes")
      .insert({ collection_id: newCol.id, recipe_id: recipeId });

    setCollections((prev) => [...prev, newCol]);
    setMemberOf((prev) => new Set(prev).add(newCol.id));
  }

  const items: PickerItem[] = collections.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.cover_image_url,
  }));

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <button
          onClick={() => setOpen(true)}
		  title="Save to Collection"
          className="flex h-8 w-8 items-center rounded-md border border-border text-muted hover:border-accent hover:text-accent"
        >
          {/* <svg
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
          Save to collection */}
		  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-7.5 size-5" fill="none" viewBox="0 0 24 24" stroke-width={1.6} stroke="currentColor">
  			<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
		  </svg>

        </button>
      )}

      <ItemPickerOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Save to Collection"
        items={items}
        loading={loading}
        memberIds={memberOf}
        onToggle={toggleCollection}
        newItemLabel="New Collection"
        newItemPlaceholder="Collection name..."
        onCreateItem={createCollection}
        emptyText="No collections yet."
      />
    </>
  );
}
