"use client";

import { useEffect } from "react";
import { useCookNotesAutosave } from "@/lib/hooks/useCookNotesAutosave";

type Props = {
  recipeId: string;
  initial: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Bottom sheet for editing Cook's Notes from inside Cook Mode. Slides
 * up to ~55% screen height so the recipe steps remain visible above —
 * the user can read step 4 and type "double the salt next time" at the
 * same time.
 *
 * Notebook styling: very-soft sepia background (`bg-[#fbf6ec]`) with
 * faint horizontal rules (`linear-gradient` repeating background) so
 * lines of text sit on rules. Date stamp (auto-prepended by the
 * autosave hook) renders in the corner via plain text.
 *
 * Auto-saved by useCookNotesAutosave (1.5s debounce + flush-on-unmount).
 */
export default function CookNotesSheet({
  recipeId,
  initial,
  open,
  onClose,
}: Props) {
  const { value, setValue } = useCookNotesAutosave(recipeId, initial);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
      />

      {/* Sheet — bottom-anchored, ~55vh, slides up */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex h-[55vh] flex-col overflow-hidden rounded-t-2xl bg-[#fbf6ec] shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
      >
        {/* Drag indicator */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notes"
          className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#c8b896]/60"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="font-heading text-lg font-semibold text-[#5a4a2c]">
            Cook&apos;s Notes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#8a7855] hover:text-[#5a4a2c]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notebook page: rules painted directly on the textarea so the
            grid and the text share a coordinate system (no offset
            mismatch from container padding). Stride = 28px = the text's
            line-height. The 1px rule sits at the bottom of each
            line-box, right between two lines of text — classic notebook
            feel. The container handles horizontal padding only; the
            textarea's own padding is zeroed so the first line aligns
            with y=0 of the rule cycle. */}
        <div className="relative flex-1 overflow-y-auto px-6 pb-5">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a note while you cook…"
            autoFocus
            spellCheck
            rows={14}
            className="block w-full resize-none border-0 bg-transparent p-0 text-base leading-7 text-[#3a2f1a] placeholder-[#a89878] focus:outline-none focus:ring-0"
            style={{
              minHeight: "100%",
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(160,130,80,0.22) 27px, rgba(160,130,80,0.22) 28px)",
              backgroundAttachment: "local",
            }}
          />
        </div>
      </div>
    </>
  );
}
