"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

type Sibling = {
  id: string;
  slug: string;
  title: string;
  variant_label: string | null;
};

export default function VariationPills({ siblings }: { siblings: Sibling[] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (siblings.length === 0) return null;

  // Up to 2 siblings → show inline. 3+ → show a single "Variations" dropdown.
  const useDropdown = siblings.length > 2;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
      <span className="text-muted">More:</span>
      {!useDropdown &&
        siblings.map((sibling) => (
          <Link
            key={sibling.id}
            href={`/recipes/${sibling.slug}`}
            className="rounded-full border border-accent-light bg-white px-2.5 py-0.5 font-medium text-accent-dark hover:bg-accent-light transition-colors"
          >
            {sibling.variant_label || sibling.title}
          </Link>
        ))}
      {useDropdown && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="rounded-full border border-accent-light bg-white px-2.5 py-0.5 font-medium text-accent-dark hover:bg-accent-light transition-colors"
          >
            Variations ▾
          </button>
          {dropdownOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-md border border-border bg-white py-1 shadow-lg">
              {siblings.map((sibling) => (
                <Link
                  key={sibling.id}
                  href={`/recipes/${sibling.slug}`}
                  onClick={() => setDropdownOpen(false)}
                  className="block px-3 py-1.5 text-sm text-foreground hover:bg-accent-light hover:text-accent-dark"
                >
                  {sibling.variant_label || sibling.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
