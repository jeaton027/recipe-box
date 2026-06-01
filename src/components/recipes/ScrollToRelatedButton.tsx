"use client";

/**
 * Small pill button that scrolls to the in-page Related section without
 * touching browser history. Using a plain anchor `<a href="#related">`
 * pushes a hash-only history entry, so Back has to unwind the hash before
 * actually leaving the page — looks broken to the user. scrollIntoView +
 * no history mutation avoids that entirely.
 */
export default function ScrollToRelatedButton() {
  function handleClick() {
    const el = document.getElementById("related");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Other Related Recipes"
      className="ml-auto shrink-0 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent"
    >
      Related
    </button>
  );
}
