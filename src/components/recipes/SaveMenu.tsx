"use client";

import { useEffect, useRef, useState } from "react";
import AddToCollectionButton from "@/components/collections/AddToCollectionButton";
import AddToMenuButton from "@/components/menus/AddToMenuButton";

type Props = {
  recipeId: string;
  recipeThumbnail?: string | null;
};

/**
 * Single "save" trigger that opens a small dropdown:
 *   • Save to Collection  → opens AddToCollectionButton headless
 *   • Add to Menu         → opens AddToMenuButton headless
 *
 * Both child components handle their own data fetching, picker UI,
 * and toggle logic. This wrapper just decides which one to open.
 */
export default function SaveMenu({ recipeId, recipeThumbnail }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [menuPickerOpen, setMenuPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss the dropdown on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Save"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Save to Collection or Menu"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {/* Same icon used previously by AddToCollectionButton — keeps the
              visual entry point unchanged for users. */}
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.6}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-md border border-border bg-white shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setCollectionPickerOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-light"
            >
              <span className="h-4 w-4 shrink-0 text-muted">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                  />
                </svg>
              </span>
              Save to Collection
            </button>

            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setMenuPickerOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-light"
            >
              <span className="h-4 w-4 shrink-0 text-muted">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                  />
                </svg>
              </span>
              Add to Menu
            </button>
          </div>
        )}
      </div>

      {/* Both pickers rendered headless (no trigger button) and externally
          controlled. Their existing overlays open on demand. */}
      <AddToCollectionButton
        recipeId={recipeId}
        recipeThumbnail={recipeThumbnail}
        trigger={() => null}
        open={collectionPickerOpen}
        onOpenChange={setCollectionPickerOpen}
      />
      <AddToMenuButton
        recipeId={recipeId}
        recipeThumbnail={recipeThumbnail}
        trigger={() => null}
        open={menuPickerOpen}
        onOpenChange={setMenuPickerOpen}
      />
    </>
  );
}
