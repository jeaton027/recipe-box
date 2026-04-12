"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types/database";
import RecipePickerOverlay from "@/components/shared/RecipePickerOverlay";

export default function AddRecipeToCollectionButton({
  collectionId,
}: {
  collectionId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  // Fetch current collection membership when the overlay opens
  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data: memberships } = await supabase
        .from("collection_recipes")
        .select("recipe_id")
        .eq("collection_id", collectionId);
      setMemberIds(new Set(memberships?.map((m) => m.recipe_id) ?? []));
    }
    load();
  }, [open, collectionId, supabase]);

  // Optimistic toggle — writes to DB immediately on each click
  async function handleToggle(recipe: Recipe) {
    const wasMember = memberIds.has(recipe.id);

    // Optimistic update
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (wasMember) {
        next.delete(recipe.id);
      } else {
        next.add(recipe.id);
      }
      return next;
    });

    if (wasMember) {
      await supabase
        .from("collection_recipes")
        .delete()
        .eq("collection_id", collectionId)
        .eq("recipe_id", recipe.id);
    } else {
      await supabase
        .from("collection_recipes")
        .insert({ collection_id: collectionId, recipe_id: recipe.id });
    }
  }

  function handleClose() {
    setOpen(false);
    router.refresh();
  }

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

      <RecipePickerOverlay
        open={open}
        onClose={handleClose}
        actionLabel="Done"
        onAction={handleClose}
        selectedIds={memberIds}
        onToggle={handleToggle}
        showCloseButton={false}
      />
    </>
  );
}
