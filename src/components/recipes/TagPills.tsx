"use client";

import { useState } from "react";
import Link from "next/link";

type TagWithCategory = {
  id: string;
  name: string;
  category: string;
};

// Lower = more specific = shown first
const specificity: Record<string, number> = {
  cuisine: 0,
  method: 1,
  dietary: 2,
  dish_type: 3,
  ingredient: 4,
  baked_goods: 5,
  occasion: 6,
  season: 7,
  meal_type: 8,
  custom: 9,
};

const MAX_VISIBLE = 4;

export default function TagPills({ tags }: { tags: TagWithCategory[] }) {
  const [expanded, setExpanded] = useState(false);

  if (tags.length === 0) return null;

  // Sort by specificity
  const sorted = [...tags].sort(
    (a, b) => (specificity[a.category] ?? 9) - (specificity[b.category] ?? 9)
  );

  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
  const remaining = sorted.length - MAX_VISIBLE;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <Link
          key={tag.id}
          href={`/browse/${tag.id}`}
          className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark transition-colors hover:bg-accent hover:text-white"
        >
          {tag.name}
        </Link>
      ))}
      {remaining > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          +{remaining}
        </button>
      )}
      {expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Show less
        </button>
      )}
    </div>
  );
}
