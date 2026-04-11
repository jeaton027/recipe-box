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
