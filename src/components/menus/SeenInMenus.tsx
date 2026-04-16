"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type MenuRef = { id: string; name: string };

export default function SeenInMenus({ recipeId }: { recipeId: string }) {
  const [menus, setMenus] = useState<MenuRef[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("menu_recipes")
        .select("menu_id, menus(id, name)")
        .eq("recipe_id", recipeId);
      if (!cancelled && data) {
        const refs = data
          .map((d) => d.menus as unknown as MenuRef | null)
          .filter(Boolean) as MenuRef[];
        setMenus(refs);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [recipeId]);

  if (!menus || menus.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-sm text-muted">Seen in:</span>
      {menus.map((m) => (
        <Link
          key={m.id}
          href={`/menus/${m.id}`}
          className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {m.name}
        </Link>
      ))}
    </div>
  );
}
