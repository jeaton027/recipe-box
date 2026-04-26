/**
 * sessionStorage handoff between "I have a recipe payload" pages
 * (ImportForm, ManageVariationsOverlay) and the new-recipe form
 * (RecipeForm with `?source=import` or `?source=variation`).
 *
 * We use sessionStorage instead of query params because the payloads
 * include arrays (ingredients, steps, gallery images) that would blow
 * out URL length limits and look awful in the address bar.
 *
 * Centralizing the keys + read-and-clear pattern here so:
 *   - Renaming a key is a one-line change.
 *   - Read sites always remove on consume (was easy to forget inline).
 *   - SSR-safety check (`typeof window`) lives in one place.
 *
 * Payload types live in @/lib/types/recipe-handoff so both producer and
 * consumer reference the same field declarations. There are two
 * variants — see that file for the rationale.
 */

import type {
  ImportedRecipePayload,
  VariationRecipePayload,
} from "@/lib/types/recipe-handoff";

const KEYS = {
  imported: "importedRecipe",
  variation: "variationRecipe",
} as const;

function setKey(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(payload));
}

function consumeKey<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Producer: stash an imported recipe payload before navigating to /recipes/new?source=import. */
export function setImportedRecipe(payload: ImportedRecipePayload): void {
  setKey(KEYS.imported, payload);
}

/** Consumer: read + clear the imported payload. Returns null if missing or unparseable. */
export function consumeImportedRecipe(): ImportedRecipePayload | null {
  return consumeKey<ImportedRecipePayload>(KEYS.imported);
}

/** Producer: stash a variation-copy payload before navigating to /recipes/new?source=variation. */
export function setVariationRecipe(payload: VariationRecipePayload): void {
  setKey(KEYS.variation, payload);
}

/** Consumer: read + clear the variation payload. Returns null if missing or unparseable. */
export function consumeVariationRecipe(): VariationRecipePayload | null {
  return consumeKey<VariationRecipePayload>(KEYS.variation);
}
