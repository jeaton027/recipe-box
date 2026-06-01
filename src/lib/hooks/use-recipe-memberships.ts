"use client";

import { useEffect } from "react";

/**
 * Tiny window-event bus for "recipe X's menu/collection memberships changed".
 * The detail page's Related rail and Seen-in chips read membership via their
 * own Supabase queries inside client components, so a server-side
 * `router.refresh()` doesn't invalidate their local state. Instead the
 * SaveMenu pickers emit on each successful toggle/create, and the rails/chips
 * subscribe and re-fetch.
 *
 * Keyed by recipeId so unrelated detail pages mounted in tabs don't refetch.
 */
const EVENT = "recipe-memberships-changed";

export function emitMembershipsChanged(recipeId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { recipeId } }));
}

/** Re-run `onChange` whenever memberships for `recipeId` change. */
export function useOnMembershipsChanged(
  recipeId: string,
  onChange: () => void
) {
  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<{ recipeId: string }>;
      if (ce.detail?.recipeId === recipeId) onChange();
    }
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [recipeId, onChange]);
}
