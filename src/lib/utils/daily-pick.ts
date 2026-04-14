// Deterministic daily pick — same tag all day, changes at midnight.
// Uses a simple hash of the date string to index into the array.

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Pick one item from an array, stable for the entire day. */
export function dailyPick<T>(items: T[], date: Date = new Date()): T | null {
  if (items.length === 0) return null;
  const dateStr = date.toISOString().slice(0, 10); // "2026-04-12"
  const index = hashString(dateStr) % items.length;
  return items[index];
}

/** Return the current meteorological season based on month (Northern Hemisphere). */
export function currentSeason(): "Spring" | "Summer" | "Fall" | "Winter" {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}
