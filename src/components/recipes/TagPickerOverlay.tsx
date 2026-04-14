"use client";

import { useState, useRef, useEffect } from "react";
import type { Tag, TagCategory } from "@/lib/types/database";
import { categoryLabels, categoryOrder } from "@/lib/utils/tag-helpers";

type Props = {
  tags: Tag[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  onClose: () => void;
};

export default function TagPickerOverlay({
  tags,
  selectedIds,
  onToggle,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus search on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const q = search.toLowerCase().trim();

  // Group tags by category in display order
  const tagsByCategory = categoryOrder
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat],
      tags: tags
        .filter((t) => t.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.tags.length > 0);

  // When searching: flat filtered list grouped by category
  const isSearching = q.length > 0;
  const searchResults = isSearching
    ? tagsByCategory
        .map((g) => ({
          ...g,
          tags: g.tags.filter((t) => t.name.toLowerCase().includes(q)),
        }))
        .filter((g) => g.tags.length > 0)
    : [];

  function toggleCategory(cat: string) {
    setOpenCategory((prev) => (prev === cat ? null : cat));
  }

  // Count selected per category
  const selectedSet = new Set(selectedIds);
  function selectedCountIn(catTags: Tag[]): number {
    return catTags.filter((t) => selectedSet.has(t.id)).length;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
      />

      {/* Overlay panel */}
      <div
        ref={overlayRef}
        className="fixed inset-x-4 top-[10vh] bottom-[10vh] z-50 mx-auto flex max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:inset-x-auto sm:w-[28rem]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-heading text-lg font-semibold">All Tags</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              className="w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isSearching ? (
            /* ── Search results: flat grouped list ── */
            searchResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No tags matching "{search}"
              </p>
            ) : (
              <div className="space-y-4">
                {searchResults.map((group) => (
                  <div key={group.category}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag) => {
                        const selected = selectedSet.has(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => onToggle(tag.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              selected
                                ? "bg-accent text-white"
                                : "bg-accent-light text-accent-dark hover:bg-accent/20"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Accordion view ── */
            <div className="space-y-1">
              {tagsByCategory.map((group) => {
                const isOpen = openCategory === group.category;
                const count = selectedCountIn(group.tags);
                // Preview: first 3 tag names
                const preview = group.tags.slice(0, 3).map((t) => t.name).join(", ");

                return (
                  <div key={group.category}>
                    {/* Accordion header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-50"
                    >
                      <svg
                        className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className="text-sm font-medium">{group.label}</span>
                      {count > 0 && (
                        <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                          {count}
                        </span>
                      )}
                      {!isOpen && (
                        <span className="ml-auto truncate text-xs text-muted">
                          {preview}…
                        </span>
                      )}
                    </button>

                    {/* Expanded pill grid */}
                    {isOpen && (
                      <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                        {group.tags.map((tag) => {
                          const selected = selectedSet.has(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => onToggle(tag.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                selected
                                  ? "bg-accent text-white"
                                  : "bg-accent-light text-accent-dark hover:bg-accent/20"
                              }`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
