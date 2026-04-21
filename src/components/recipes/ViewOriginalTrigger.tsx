"use client";

import { useState } from "react";
import OriginalSnapshotOverlay from "@/components/recipes/OriginalSnapshotOverlay";
import type { OriginalSnapshot } from "@/lib/types/database";

type Props = {
  snapshot: OriginalSnapshot | null;
};

/**
 * Quiet "View original" link for the recipe edit page header.
 * Renders nothing if no snapshot exists (shouldn't happen for recipes
 * created after this feature shipped, but guards against pre-migration data).
 */
export default function ViewOriginalTrigger({ snapshot }: Props) {
  const [open, setOpen] = useState(false);

  if (!snapshot) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted underline-offset-2 transition-colors hover:text-accent-dark hover:underline"
        title="View the original version — a read-only snapshot captured when this recipe was created."
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        View original
      </button>

      <OriginalSnapshotOverlay
        open={open}
        onClose={() => setOpen(false)}
        snapshot={snapshot}
      />
    </>
  );
}
