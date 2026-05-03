"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tag, TagCategory } from "@/lib/types/database";
import TagPills from "@/components/recipes/TagPills";
import TagPickerOverlay from "@/components/recipes/TagPickerOverlay";

type TagWithCategory = { id: string; name: string; category: string };

type Props = {
  recipeId: string;
  initialTags: TagWithCategory[];
};

/**
 * Detail-page tag editor. Wraps TagPills with a "+ Add tag" pill that
 * opens TagPickerOverlay; Done commits, Cancel discards. This makes
 * tagging a 2-tap operation from the detail page instead of the 5-tap
 * round-trip through the edit page.
 *
 * Architecture:
 *   - `persistedTagIds` is the source of truth for what's saved.
 *   - When the picker opens, `draftTagIds` is seeded from persisted —
 *     all toggles in the picker mutate the draft only.
 *   - Done diffs draft vs persisted, applies optimistic update, then
 *     fires inserts + deletes against the recipe_tags join table.
 *   - Cancel just closes; the draft is discarded.
 *
 * All tags are lazy-loaded on first picker-open so the detail page
 * doesn't pay the fetch cost up front.
 */
export default function InlineTagEditor({ recipeId, initialTags }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [persistedTags, setPersistedTags] =
    useState<TagWithCategory[]>(initialTags);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function openPicker() {
    setDraftTagIds(persistedTags.map((t) => t.id));
    setOpen(true);
    // Lazy-load on first open. Cached for subsequent opens.
    if (!allTags) {
      setLoading(true);
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, category")
        .order("name");
      if (error) {
        console.warn("[tags] failed to load all tags:", error.message);
      } else {
        setAllTags((data ?? []) as Tag[]);
      }
      setLoading(false);
    }
  }

  function toggleDraft(tagId: string) {
    setDraftTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function commit() {
    const persistedIds = persistedTags.map((t) => t.id);
    const added = draftTagIds.filter((id) => !persistedIds.includes(id));
    const removed = persistedIds.filter((id) => !draftTagIds.includes(id));

    if (added.length === 0 && removed.length === 0) return;

    // Optimistic: resolve draft IDs to full TagWithCategory objects from
    // the all-tags cache so the displayed pills update immediately.
    if (allTags) {
      const lookup = new Map(allTags.map((t) => [t.id, t]));
      const next = draftTagIds
        .map((id) => lookup.get(id))
        .filter((t): t is Tag => !!t)
        .map((t) => ({ id: t.id, name: t.name, category: t.category }));
      setPersistedTags(next);
    }

    // Run inserts and deletes sequentially. Each write returns its own
    // {error}; on the first failure we abort and revert to server state
    // via router.refresh(). At most two queries — the latency cost of
    // serial vs parallel is trivial.
    let errMsg: string | null = null;
    if (added.length > 0) {
      const { error } = await supabase
        .from("recipe_tags")
        .insert(added.map((tag_id) => ({ recipe_id: recipeId, tag_id })));
      if (error) errMsg = error.message;
    }
    if (!errMsg && removed.length > 0) {
      const { error } = await supabase
        .from("recipe_tags")
        .delete()
        .eq("recipe_id", recipeId)
        .in("tag_id", removed);
      if (error) errMsg = error.message;
    }

    if (errMsg) {
      console.warn("[tags] save failed:", errMsg);
      alert("Couldn't save tag changes. Refreshed to current state.");
    }
    // Refresh either way: on success so server-rendered consumers
    // (page header, search index) pick up the change; on failure to
    // revert the optimistic update by re-pulling truth.
    router.refresh();
  }

  // The "+ Add tag" pill, dashed-outline so it reads as an action and
  // stands apart from the data pills. ml-3 gives extra breathing room
  // beyond the row's gap-1.5 so it doesn't get visually mistaken for
  // either a tag or the "+x" overflow indicator.
  const addButton = (
    <button
      type="button"
      onClick={openPicker}
      className="ml-3 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      + Add tag
    </button>
  );

  return (
    <>
      <TagPills tags={persistedTags} trailing={addButton} />

      {open && (
        <TagPickerOverlay
          tags={allTags ?? []}
          selectedIds={draftTagIds}
          onToggle={toggleDraft}
          onConfirm={commit}
          onClose={() => setOpen(false)}
        />
      )}

      {/* Hidden indicator if the lazy load is mid-flight on first open.
          The picker still renders, just with no tags until allTags
          resolves — usually <100ms so a spinner would feel laggy. */}
      {loading && allTags === null && (
        <span className="sr-only">Loading tags…</span>
      )}
    </>
  );
}
