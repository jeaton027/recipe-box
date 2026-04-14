"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types/database";
import RecipePickerOverlay from "@/components/shared/RecipePickerOverlay";

type Props = {
  recipeId: string;
  familyId: string | null;
  siblingIds: string[];
};

export default function CreateVariationButton({
  recipeId,
  familyId,
  siblingIds,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Split-button menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // ── Menu close on outside click / Escape ───────────────────────

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setUrlInput("");
        setUrlError(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUrlInput("");
        setUrlError(null);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  // ── Create by copy (existing behavior) ─────────────────────────

  async function handleCreateVariation() {
    if (loading) return;
    setLoading(true);

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
      setLoading(false);
    }
  }

  // ── Import from URL ────────────────────────────────────────────

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

  // ── Link existing recipes ──────────────────────────────────────

  function handleOpenPicker() {
    setMenuOpen(false);
    setPickerOpen(true);
  }

  function handlePickerToggle(recipe: Recipe) {
    setLinkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipe.id)) {
        next.delete(recipe.id);
      } else {
        next.add(recipe.id);
      }
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
      // Resolve or create the family_id
      let fid = familyId;
      if (!fid) {
        fid = crypto.randomUUID();
        // Assign to current recipe first
        await supabase
          .from("recipes")
          .update({ family_id: fid })
          .eq("id", recipeId);
      }

      // Assign family_id to all selected recipes
      const ids = Array.from(linkSelectedIds);
      await supabase
        .from("recipes")
        .update({ family_id: fid })
        .in("id", ids);

      setPickerOpen(false);
      setLinkSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      console.error("Link variation failed:", e);
      alert(e instanceof Error ? e.message : "Failed to link recipes");
    } finally {
      setLinkLoading(false);
    }
  }

  // Exclude current recipe + existing siblings from the link picker
  const excludeFromPicker = new Set([recipeId, ...siblingIds]);

  // Disable recipes that belong to a different family
  function isDisabledForLink(recipe: Recipe): boolean {
    return (
      recipe.family_id !== null &&
      recipe.family_id !== undefined &&
      recipe.family_id !== familyId
    );
  }

  // ── Tray for the link-existing picker ──────────────────────────

  // We don't have full recipe data for tray display until the picker
  // fetches it, so we'll use a lighter-weight tray that shows count.
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
      <div ref={menuRef} className="relative inline-flex">
        {/* Left: Create by copy (primary — one click) */}
        <button
          type="button"
          onClick={handleCreateVariation}
          disabled={loading}
          className="rounded-l-md border border-r-0 border-border bg-white px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent-dark disabled:opacity-50"
          title="Create a copy of this recipe as a variation"
        >
          {loading ? "Loading..." : "+ Variation"}
        </button>

        {/* Right: Menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="rounded-r-md border border-border bg-white px-1.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent-dark"
          aria-label="More variation options"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-white shadow-lg">
            {/* Link existing recipe */}
            <button
              type="button"
              onClick={handleOpenPicker}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent-light transition-colors"
            >
              <svg
                className="h-4 w-4 text-muted"
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
              Add existing recipe
            </button>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Import from URL */}
            <div className="px-3 py-2.5">
              <p className="mb-1.5 text-xs font-medium text-foreground">
                Import from URL
              </p>
              <div className="flex gap-2">
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
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={handleUrlImport}
                  disabled={urlLoading || !urlInput.trim()}
                  className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {urlLoading ? "..." : "Go"}
                </button>
              </div>
              {urlError && (
                <p className="mt-1 text-xs text-red-500">{urlError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Link-existing picker overlay */}
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
