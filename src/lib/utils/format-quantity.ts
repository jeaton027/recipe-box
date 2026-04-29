/**
 * Format a numeric quantity as a human-readable string, preferring
 * common fraction glyphs (½, ¼, ⅓, etc) when the value is close to one.
 * Falls back to a 2-decimal number when no fraction matches.
 */
export function formatQuantity(value: number): string {
  if (value === 0) return "0";

  const whole = Math.floor(value);
  const frac = value - whole;

  if (frac < 0.02) return whole > 0 ? whole.toString() : "0";
  if (frac > 0.98) return (whole + 1).toString();

  const candidates: [number, string][] = [
    [1 / 8, "⅛"],
    [1 / 4, "¼"],
    [1 / 3, "⅓"],
    [3 / 8, "⅜"],
    [1 / 2, "½"],
    [5 / 8, "⅝"],
    [2 / 3, "⅔"],
    [3 / 4, "¾"],
    [7 / 8, "⅞"],
  ];

  let best = candidates[0];
  let bestDiff = Math.abs(frac - candidates[0][0]);
  for (const c of candidates) {
    const diff = Math.abs(frac - c[0]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }

  if (bestDiff > 0.06) return value.toFixed(2);

  return whole === 0 ? best[1] : `${whole} ${best[1]}`;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "⅛": 1 / 8, "¼": 1 / 4, "⅓": 1 / 3, "⅜": 3 / 8, "½": 1 / 2,
  "⅝": 5 / 8, "⅔": 2 / 3, "¾": 3 / 4, "⅞": 7 / 8,
};

// Replace unicode fraction glyphs with their decimal equivalents (preceded
// by a space so they tokenize cleanly when sandwiched between numbers).
function normalizeUnicodeFractions(str: string): string {
  return str.replace(/[⅛¼⅓⅜½⅝⅔¾⅞]/g, (ch) => ` ${UNICODE_FRACTIONS[ch]}`);
}

/**
 * Parse a user-entered quantity string ("1/3", "1 1/2", "2", "½", "1 ¾")
 * into a decimal for DB storage. Returns null for empty/invalid input.
 */
export function parseFraction(str: string): number | null {
  if (!str.trim()) return null;
  const normalized = normalizeUnicodeFractions(str);
  const parts = normalized.trim().split(/\s+/);
  let result = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, den] = part.split("/");
      const n = parseFloat(num);
      const d = parseFloat(den);
      if (!isNaN(n) && !isNaN(d) && d !== 0) result += n / d;
    } else {
      const n = parseFloat(part);
      if (!isNaN(n)) result += n;
    }
  }
  return result === 0 ? null : result;
}

/**
 * Null-safe wrapper around formatQuantity for pre-filling editable form
 * inputs. Returns "" for null/undefined; otherwise renders the value with
 * unicode fraction glyphs (½, ¼, etc). The companion parseFraction reads
 * both unicode and ASCII fractions on the way back in.
 */
export function formatQtyForInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return formatQuantity(value);
}
