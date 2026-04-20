"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types/database";
import OverlayShell from "@/components/shared/OverlayShell";
import RecipePickerOverlay from "@/components/shared/RecipePickerOverlay";

type Props = {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  familyId: string | null;
  siblingIds: string[];
};

/**
 * Single overlay with three variation flows visible at once:
 *   1. Create a copy (duplicates this recipe as a draft)
 *   2. Import from URL (imports an external recipe as a variation)
 *   3. Link an existing recipe (opens recipe picker)
 */
export default function LinkToVariationOverlay({
  open,
  onClose,
  recipeId,
  familyId,
  siblingIds,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Create-copy state
  const [copyLoading, setCopyLoading] = useState(false);

  // URL import state
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Link-existing picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkSelectedIds, setLinkSelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [linkLoading, setLinkLoading] = useState(false);

  function handleClose() {
    setUrlInput("");
    setUrlError(null);
    onClose();
  }

  async function handleCreateCopy() {
    if (copyLoading) return;
    setCopyLoading(true);

    try {
      const [srcRes, ingsRes, stepsRes, tagsRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase
          .from("ingredients")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("sort_order"),
        supabase
          .from("steps")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("sort_order"),
        supabase
          .from("recipe_tags")
          .select("tag_id")
          .eq("recipe_id", recipeId),
      ]);

      if (srcRes.error || !srcRes.data)
        throw new Error(srcRes.error?.message ?? "Source recipe not found");
      if (ingsRes.error) throw new Error(ingsRes.error.message);
      if (stepsRes.error) throw new Error(stepsRes.error.message);
      if (tagsRes.error) throw new Error(tagsRes.error.message);

      const source = srcRes.data;

      const variationData = {
        title: source.title,
        description: source.description,
        servings: source.servings,
        servings_type: source.servings_type,
        prep_time_minutes: source.prep_time_minutes,
        cook_time_minutes: source.cook_time_minutes,
        bake_time: source.bake_time,
        bake_time_max: source.bake_time_max,
        bake_time_unit: source.bake_time_unit,
        bake_temp: source.bake_temp,
        bake_temp_max: source.bake_temp_max,
        bake_temp_unit: source.bake_temp_unit,
        notes: source.notes,
        source_url: source.source_url,
        thumbnail_url: source.thumbnail_url,
        gallery_images: source.gallery_images,
        is_image_only: source.is_image_only,
        ingredients: ingsRes.data ?? [],
        steps: stepsRes.data ?? [],
        tag_ids: (tagsRes.data ?? []).map((t) => t.tag_id),
        _variationSourceId: source.id,
      };

      sessionStorage.setItem("variationRecipe", JSON.stringify(variationData));
      router.push("/recipes/new?source=variation");
    } catch (e) {
      console.error("Create variation failed:", e);
      alert(e instanceof Error ? e.message : "Failed to create variation");
      setCopyLoading(false);
    }
  }

  async function handleUrlImport() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    try {
      const parsed = new URL(trimmed);
      if (!parsed.protocol.startsWith("http")) throw new Error();
    } catch {
      setUrlError("Enter a valid URL starting with http:// or https://");
      return;
    }

    setUrlLoading(true);
    setUrlError(null);

    try {
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setUrlError(
          data.error === "Could not fetch URL"
            ? "Couldn't reach that URL"
            : data.error === "No recipe data found on this page"
            ? "No recipe found on that page"
            : data.error || "Import failed"
        );
        setUrlLoading(false);
        return;
      }

      sessionStorage.setItem(
        "importedRecipe",
        JSON.stringify({
          ...data,
          source_url: trimmed,
          _variationSourceId: recipeId,
        })
      );
      router.push("/recipes/new?source=import");
    } catch {
      setUrlError("Import failed. Check your connection and try again.");
      setUrlLoading(false);
    }
  }

  function handleOpenPicker() {
    setPickerOpen(true);
  }

  function handlePickerToggle(recipe: Recipe) {
    setLinkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipe.id)) next.delete(recipe.id);
      else next.add(recipe.id);
      return next;
    });
  }

  function handlePickerClose() {
    setPickerOpen(false);
    setLinkSelectedIds(new Set());
  }

  async function handleLinkDone() {
    if (linkSelectedIds.size === 0) return;
    setLinkLoading(true);

    try {
      let fid = familyId;
      if (!fid) {
        fid = crypto.randomUUID();
        await supabase
          .from("recipes")
          .update({ family_id: fid })
          .eq("id", recipeId);
      }

      const ids = Array.from(linkSelectedIds);
      await supabase
        .from("recipes")
        .update({ family_id: fid })
        .in("id", ids);

      setPickerOpen(false);
      setLinkSelectedIds(new Set());
      onClose();
      router.refresh();
    } catch (e) {
      console.error("Link variation failed:", e);
      alert(e instanceof Error ? e.message : "Failed to link recipes");
    } finally {
      setLinkLoading(false);
    }
  }

  const excludeFromPicker = new Set([recipeId, ...siblingIds]);

  function isDisabledForLink(recipe: Recipe): boolean {
    return (
      recipe.family_id !== null &&
      recipe.family_id !== undefined &&
      recipe.family_id !== familyId
    );
  }

  const linkTray =
    linkSelectedIds.size > 0 ? (
      <span className="text-xs font-medium text-muted">
        {linkSelectedIds.size} recipe{linkSelectedIds.size !== 1 ? "s" : ""}{" "}
        selected
      </span>
    ) : (
      <span className="text-xs text-muted">
        Select recipes to add to this family
      </span>
    );

  return (
    <>
      {/* Hide main overlay while picker is open so we don't stack two modals */}
      {!pickerOpen && (
        <OverlayShell
          open={open}
          onClose={handleClose}
          title="Link to Variation"
          maxWidth="max-w-lg"
        >
          <div className="flex flex-col divide-y divide-border">
            {/* Option 1: Create a copy */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent-dark">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Create a copy
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Duplicate this recipe to edit as a new variation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateCopy}
                disabled={copyLoading}
                className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                {copyLoading ? "Loading..." : "Create"}
              </button>
            </div>

            {/* Option 2: Import from URL */}
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent-dark">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Import from URL
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Pull a recipe from the web and save it as a variation.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 pl-12">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUrlImport();
                    }
                  }}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={handleUrlImport}
                  disabled={urlLoading || !urlInput.trim()}
                  className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {urlLoading ? "Importing..." : "Go"}
                </button>
              </div>
              {urlError && (
                <p className="mt-2 pl-12 text-xs text-red-500">{urlError}</p>
              )}
            </div>

            {/* Option 3: Link an existing recipe */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent-dark">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Link an existing recipe
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Pick another recipe from your box to add to this family.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenPicker}
                className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
              >
                Choose
              </button>
            </div>
          </div>
        </OverlayShell>
      )}

      {/* Link-existing picker */}
      <RecipePickerOverlay
        open={pickerOpen}
        onClose={handlePickerClose}
        actionLabel={linkLoading ? "Linking..." : "Done"}
        actionDisabled={linkSelectedIds.size === 0 || linkLoading}
        onAction={handleLinkDone}
        selectedIds={linkSelectedIds}
        onToggle={handlePickerToggle}
        excludeIds={excludeFromPicker}
        isDisabled={isDisabledForLink}
        disabledTooltip="Already a variation"
        tray={linkTray}
        showCloseButton
      />
    </>
  );
}
