/**
 * Shared ingredient-line parser.
 *
 * Used by both /api/import-recipe (parsing JSON-LD or scraped HTML strings)
 * and /api/parse-recipe-text (parsing pasted text). Previously each route
 * had its own copy with subtly different regex coverage, which meant
 * "400g flour" parsed correctly when pasted but lost its unit when
 * imported from a URL. Centralizing here so both flows share identical
 * coverage.
 *
 * Tiers, in order of preference:
 *   1. Range + unit + name        — "1-2 tsp sugar", "1/4-1/2 C flour"
 *   2. Range + name (no unit)     — "1-2 eggs"
 *   3. Compact range + unit       — "200-250g flour"
 *   4. Compact qty + unit         — "400g flour", "2tbsp sugar", "1/2c milk"
 *   5. Single qty + unit + name   — "1 1/2 cups all-purpose flour"
 *   6. Single qty + name          — "2 eggs"
 *   7. Fallback                   — whole string as name
 */

export type ParsedIngredient = {
  quantity: string | null;
  quantity_max: string | null;
  unit: string | null;
  name: string;
};

// HTML-entity decode kept local: callers may already have their own
// decoder for full-page HTML, but we always need it here for the `name`
// field since either flow can hand us encoded text. decodeHtml is
// idempotent on already-decoded input, so this is safe to apply twice.
function decodeHtml(str: string): string {
  return str
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/gi, "&");
}

// Common units used in compact form (no space between number and unit).
const COMPACT_UNITS = "g|kg|ml|l|oz|lb|lbs|tsp|tbsp|cup|cups|c|T|t";

const FRAC_CHARS = "⅛¼⅓⅜½⅝⅔¾⅞";

/** True if the string contains any digit or vulgar fraction. */
export function hasNumber(s: string): boolean {
  return /\d/.test(s) || [...s].some((c) => FRAC_CHARS.includes(c));
}

// Normalize an extracted quantity: trim whitespace, collapse to null when
// nothing meaningful is left. Preserves the safer `null`-on-empty contract
// the API layer relies on.
function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export function parseIngredientLine(str: string): ParsedIngredient {
  const clean = str.trim();

  // 1. Range + unit + name: "1-2 tsp sugar", "1/4-1/2 C flour"
  const mr = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
  );
  if (mr) {
    return {
      quantity: nullIfEmpty(mr[1]),
      quantity_max: nullIfEmpty(mr[2]),
      unit: mr[3],
      name: decodeHtml(mr[4].trim()),
    };
  }

  // 2. Range + name (no unit): "1-2 eggs"
  const mr2 = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+(.+)$/
  );
  if (mr2) {
    return {
      quantity: nullIfEmpty(mr2[1]),
      quantity_max: nullIfEmpty(mr2[2]),
      unit: null,
      name: decodeHtml(mr2[3].trim()),
    };
  }

  // 3. Compact range + unit + name: "200-250g flour"
  const mrc = clean.match(
    new RegExp(
      `^([\\d.]+)\\s*[-–]\\s*([\\d.]+)\\s*(${COMPACT_UNITS})\\s+(.+)$`,
      "i"
    )
  );
  if (mrc) {
    return {
      quantity: mrc[1],
      quantity_max: mrc[2],
      unit: mrc[3],
      name: decodeHtml(mrc[4].trim()),
    };
  }

  // 4. Compact quantity + unit + name: "400g flour", "2tbsp sugar", "1/2c milk"
  const mc = clean.match(
    new RegExp(
      `^([\\d.\\/⅛¼⅓⅜½⅝⅔¾⅞\\s]+?)\\s*(${COMPACT_UNITS})\\s+(.+)$`,
      "i"
    )
  );
  if (mc) {
    return {
      quantity: nullIfEmpty(mc[1]),
      quantity_max: null,
      unit: mc[2],
      name: decodeHtml(mc[3].trim()),
    };
  }

  // 5. Single quantity + unit + name: "1 1/2 cups all-purpose flour"
  const m = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
  );
  if (m) {
    return {
      quantity: nullIfEmpty(m[1]),
      quantity_max: null,
      unit: m[2],
      name: decodeHtml(m[3].trim()),
    };
  }

  // 6. Single quantity + name (no unit): "2 eggs"
  const m2 = clean.match(/^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+(.+)$/);
  if (m2) {
    return {
      quantity: nullIfEmpty(m2[1]),
      quantity_max: null,
      unit: null,
      name: decodeHtml(m2[2].trim()),
    };
  }

  // 7. Fallback: whole string as name.
  return { quantity: null, quantity_max: null, unit: null, name: decodeHtml(str) };
}
