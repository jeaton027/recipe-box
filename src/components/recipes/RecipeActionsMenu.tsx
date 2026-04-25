"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ManageVariationsOverlay from "@/components/recipes/ManageVariationsOverlay";

type Props = {
  recipeId: string;
  recipeSlug: string;
  familyId: string | null;
  siblingIds: string[];
};

/**
 * Vertical ellipsis menu on the recipe detail page.
 * Actions: Manage Variations, Edit, Delete.
 *
 * "Related" and "Add to Menu" used to live here; both moved out to
 * dedicated controls on the page (Related → inline button next to
 * tags; Add to Menu → SaveMenu dropdown).
 */
export default function RecipeActionsMenu({
  recipeId,
  recipeSlug,
  familyId,
  siblingIds,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  function handleLinkVariation() {
    setMenuOpen(false);
    setVariationOpen(true);
  }

  function handleEdit() {
    setMenuOpen(false);
    router.push(`/recipes/${recipeSlug}/edit`);
  }

  function handleDeleteClick() {
    setMenuOpen(false);
    setConfirmingDelete(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId);

    if (error) {
      alert("Failed to delete recipe: " + error.message);
      setDeleting(false);
      setConfirmingDelete(false);
    } else {
      router.push("/recipes");
      router.refresh();
    }
  }

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleConfirmDelete}
          disabled={deleting}
          className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  const menuItems: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      label: "Manage Variations",
      onClick: handleLinkVariation,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      label: "Edit",
      onClick: handleEdit,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
      ),
    },
    {
      label: "Delete",
      onClick: handleDeleteClick,
      danger: true,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-md border border-border bg-white shadow-lg"
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={item.onClick}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-light ${
                  item.danger
                    ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                    : "text-foreground"
                }`}
              >
                <span className={`h-4 w-4 shrink-0 ${item.danger ? "text-red-500" : "text-muted"}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ManageVariationsOverlay
        open={variationOpen}
        onClose={() => setVariationOpen(false)}
        recipeId={recipeId}
        familyId={familyId}
        siblingIds={siblingIds}
      />
    </>
  );
}
