"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOnMembershipsChanged } from "@/lib/hooks/use-recipe-memberships";

type Ref = { id: string; name: string };

export default function SeenInMenus({ recipeId }: { recipeId: string }) {
  const [menus, setMenus] = useState<Ref[] | null>(null);
  const [collections, setCollections] = useState<Ref[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: mr }, { data: cr }] = await Promise.all([
      supabase
        .from("menu_recipes")
        .select("menu_id, menus(id, name)")
        .eq("recipe_id", recipeId),
      supabase
        .from("collection_recipes")
        .select("collection_id, collections(id, name)")
        .eq("recipe_id", recipeId),
    ]);
    setMenus(
      ((mr ?? [])
        .map((d) => d.menus as unknown as Ref | null)
        .filter(Boolean) as Ref[])
    );
    setCollections(
      ((cr ?? [])
        .map((d) => d.collections as unknown as Ref | null)
        .filter(Boolean) as Ref[])
    );
  }, [recipeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when SaveMenu pickers add/remove this recipe from a
  // menu or collection.
  useOnMembershipsChanged(recipeId, load);

  const hasMenus = menus && menus.length > 0;
  const hasCollections = collections && collections.length > 0;
  if (!hasMenus && !hasCollections) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Seen in</p>
      {hasMenus && (
        <Row
          label="Menus"
          items={menus!}
          hrefFor={(id) => `/menus/${id}`}
          variant="menu"
        />
      )}
      {hasCollections && (
        <Row
          label="Collections"
          items={collections!}
          hrefFor={(id) => `/collections/${id}`}
          variant="collection"
        />
      )}
    </div>
  );
}

const pillBase =
  "inline-flex items-center rounded-md px-3 py-1.5 text-[13px] font-medium border transition-colors";

const pillVariants = {
  // Menus: outlined / white
  menu:
    "border-border bg-white text-foreground hover:border-accent hover:text-accent-dark",
  // Collections: blue-tinted
  collection:
    "border-transparent bg-[#eef1f6] text-[#46566b] hover:bg-[#e2e8f1]",
} as const;

function Row({
  label,
  items,
  hrefFor,
  variant,
}: {
  label: string;
  items: Ref[];
  hrefFor: (id: string) => string;
  variant: keyof typeof pillVariants;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {items.map((m) => (
        <Link
          key={m.id}
          href={hrefFor(m.id)}
          className={`${pillBase} ${pillVariants[variant]}`}
        >
          {m.name}
        </Link>
      ))}
    </div>
  );
}