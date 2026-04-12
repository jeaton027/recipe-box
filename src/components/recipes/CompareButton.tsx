"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types/database";
import RecipePickerOverlay from "@/components/shared/RecipePickerOverlay";

const MAX_COMPARE = 2;

type Props = {
  currentRecipeId: string;
  currentRecipeSlug: string;
  currentRecipeTitle: string;
  currentRecipeThumbnail: string | null;
  familyId: string | null;
};

export default function CompareButton({
  currentRecipeId,
  currentRecipeSlug,
  currentRecipeTitle,
  currentRecipeThumbnail,
  familyId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  // Selection state — current recipe is always locked at position 0
  const [traySlugs, setTraySlugs] = useState<string[]>([currentRecipeSlug]);
  // Map slug→recipe info for tray display
  const [trayInfo, setTrayInfo] = useState<
    Map<string, { id: string; title: string; thumbnail_url: string | null }>
  >(
    new Map([
      [
        currentRecipeSlug,
        {
          id: currentRecipeId,
          title: currentRecipeTitle,
          thumbnail_url: currentRecipeThumbnail,
        },
      ],
    ])
  );

  // Sibling IDs (for prioritization in the picker)
  const [siblingIds, setSiblingIds] = useState<Set<string>>(new Set());

  // Fetch sibling IDs when overlay opens
  useEffect(() => {
    if (!open || !familyId) return;
    async function load() {
      const { data } = await supabase
        .from("recipes")
        .select("id")
        .eq("family_id", familyId!)
        .neq("id", currentRecipeId);
      setSiblingIds(new Set((data ?? []).map((r) => r.id)));
    }
    load();
  }, [open, familyId, currentRecipeId, supabase]);

  // Build selectedIds set from slug-based tray
  const selectedIds = new Set(
    traySlugs
      .map((slug) => trayInfo.get(slug)?.id)
      .filter((id): id is string => !!id)
  );

  function handleToggle(recipe: Recipe) {
    if (recipe.slug === currentRecipeSlug) return; // locked
    setTraySlugs((prev) => {
      if (prev.includes(recipe.slug)) {
        return prev.filter((s) => s !== recipe.slug);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, recipe.slug];
    });
    // Store recipe info for the tray display
    setTrayInfo((prev) => {
      const next = new Map(prev);
      next.set(recipe.slug, {
        id: recipe.id,
        title: recipe.title,
        thumbnail_url: recipe.thumbnail_url,
      });
      return next;
    });
  }

  function handleRemoveFromTray(slug: string) {
    if (slug === currentRecipeSlug) return;
    setTraySlugs((prev) => prev.filter((s) => s !== slug));
  }

  function handleClose() {
    setOpen(false);
    setTraySlugs([currentRecipeSlug]);
  }

  function handleCompare() {
    if (traySlugs.length < 2) return;
    router.push(`/compare?slugs=${traySlugs.join(",")}`);
  }

  // ── Tray content ───────────────────────────────────────────────

  const trayContent = (
    <>
      <span className="text-xs font-medium text-muted">Comparing:</span>
      {traySlugs.map((slug) => {
        const info = trayInfo.get(slug);
        if (!info) return null;
        const isCurrent = slug === currentRecipeSlug;
        return (
          <span
            key={slug}
            className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-medium ${
              isCurrent
                ? "border-accent bg-accent-light text-accent-dark"
                : "border-border bg-white text-foreground"
            }`}
          >
            <span className="relative h-5 w-5 overflow-hidden rounded-full bg-gray-100">
              {info.thumbnail_url ? (
                <Image
                  src={info.thumbnail_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="20px"
                />
              ) : null}
            </span>
            <span className="max-w-[160px] truncate">{info.title}</span>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => handleRemoveFromTray(slug)}
                className="ml-0.5 text-muted hover:text-foreground"
                aria-label={`Remove ${info.title}`}
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      {traySlugs.length < MAX_COMPARE && (
        <span className="text-xs text-muted">
          Pick {MAX_COMPARE - traySlugs.length} more below
        </span>
      )}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent-dark sm:inline-flex"
        title="Compare this recipe with another"
      >
        Compare
      </button>

      <RecipePickerOverlay
        open={open}
        onClose={handleClose}
        actionLabel="Compare"
        actionDisabled={traySlugs.length < 2}
        onAction={handleCompare}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        maxSelection={MAX_COMPARE}
        excludeIds={new Set([currentRecipeId])}
        prioritizeIds={siblingIds}
        tray={trayContent}
        showCloseButton
      />
    </>
  );
}
