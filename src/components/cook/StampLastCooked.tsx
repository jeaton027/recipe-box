"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Fire-and-forget: stamps `recipes.last_cooked_at = now()` when Cook Mode
 * loads. Powers the "Recently Made" section on the homepage. Runs once
 * per page mount; the write is async and we don't block rendering on it.
 */
export default function StampLastCooked({ recipeId }: { recipeId: string }) {
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("recipes")
      .update({ last_cooked_at: new Date().toISOString() })
      .eq("id", recipeId)
      .then(({ error }) => {
        if (error) {
          // Non-fatal; the user can still cook. Log for debugging.
          console.warn("[cook] failed to stamp last_cooked_at:", error.message);
        }
      });
  }, [recipeId]);

  return null;
}
