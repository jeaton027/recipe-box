"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Fire-and-forget on Cook Mode mount:
 *   1. Stamps `recipes.last_cooked_at = now()` — powers "Recently Made".
 *      Also clears `in_lineup = false` in the same UPDATE so the recipe
 *      drops out of the homepage Lineup row once the user actually starts
 *      cooking it (the lineup self-empties as recipes get made).
 *   2. Promotes status from "saved" → "tried" if and only if the current
 *      status is "saved". A user entering Cook Mode is almost always
 *      actually making the dish, so the implicit promotion is fair.
 *      We use an `.eq("status", "saved")` predicate so we never
 *      *downgrade* a "favorite" back to "tried".
 *
 * Both writes are async and don't block rendering. They run in parallel.
 */
export default function StampLastCooked({ recipeId }: { recipeId: string }) {
  useEffect(() => {
    const supabase = createClient();

    // Stamp last_cooked_at + clear lineup in one UPDATE.
    supabase
      .from("recipes")
      .update({
        last_cooked_at: new Date().toISOString(),
        in_lineup: false,
      })
      .eq("id", recipeId)
      .then(({ error }) => {
        if (error) {
          console.warn("[cook] failed to stamp last_cooked_at:", error.message);
        }
      });

    // Conditionally promote status: saved → tried. The .eq("status","saved")
    // predicate makes this atomic and a no-op for "tried" / "favorite" rows.
    supabase
      .from("recipes")
      .update({ status: "tried" })
      .eq("id", recipeId)
      .eq("status", "saved")
      .then(({ error }) => {
        if (error) {
          console.warn("[cook] failed to promote status to tried:", error.message);
        }
      });
  }, [recipeId]);

  return null;
}
