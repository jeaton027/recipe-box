"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import CookNotesSheet from "@/components/cook/CookNotesSheet";

type Props = {
  title: string;
  /** Where the "back" arrow should navigate. Typically the recipe detail page. */
  backHref: string;
  /** Recipe id — required to read/write Cook's Notes. */
  recipeId: string;
  /** Initial value of cook_notes from the server. */
  initialCookNotes: string;
};

/**
 * Sticky top bar for Cook Mode. Always visible at the top of the viewport
 * while in cook mode; provides the only exit path.
 *
 * Also owns the wake-lock lifecycle — held for the duration of cook mode
 * and released on unmount. A non-intrusive warning appears below the bar
 * if wake lock fails or isn't supported; silent otherwise.
 */
export default function CookHeader({
  title,
  backHref,
  recipeId,
  initialCookNotes,
}: Props) {
  const status = useWakeLock(true);
  const [dismissed, setDismissed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // If wake lock re-fails after user dismissed (e.g. browser released it
  // and re-acquisition on visibilitychange failed), surface the warning
  // again.
  useEffect(() => {
    if (status === "active") setDismissed(false);
  }, [status]);

  const showWarning =
    !dismissed && (status === "failed" || status === "unsupported");

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur-sm">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-accent-light hover:text-foreground"
          aria-label="Exit Cook Mode"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          <span className="hidden sm:inline">Exit</span>
        </Link>
        <h1 className="flex-1 truncate text-center font-heading text-base font-semibold sm:text-lg">
          {title}
        </h1>
        {/* Pencil — opens Cook's Notes sheet. Same horizontal weight
            as the back link so the title stays optically centered. */}
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          aria-label="Cook's Notes"
          className="flex w-[60px] shrink-0 items-center justify-end rounded-md px-2 py-1 text-muted transition-colors hover:text-foreground sm:w-[72px]"
        >
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
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
            />
          </svg>
        </button>
      </div>

      <CookNotesSheet
        recipeId={recipeId}
        initial={initialCookNotes}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />

      {showWarning && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <span className="flex-1">
            Screen may dim —{" "}
            {status === "unsupported"
              ? "your browser doesn't support keeping the screen awake."
              : "couldn't keep screen awake. Adjust your device's screen-timeout if needed."}
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded px-2 py-0.5 text-xs font-medium hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
