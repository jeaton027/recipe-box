/**
 * Heuristic extraction of bake temperature + bake time from recipe step
 * text. Used by both /api/import-recipe (after we've assembled steps from
 * scraped HTML / JSON-LD) and /api/parse-recipe-text (after pasted text
 * has been split into steps). Same regexes; one place to fix bugs.
 *
 * Looks for two phrasings:
 *   • "preheat the oven to 350°F" / "preheat to 200 degrees C"
 *   • "bake for 25 minutes", "bake for 25-30 min", "bake for 1 hour"
 *
 * If a recipe doesn't match either pattern (e.g. stovetop dishes), the
 * corresponding fields come back null.
 */

export type BakeInfo = {
  bake_temp: number | null;
  bake_temp_max: number | null;
  bake_temp_unit: "F" | "C" | null;
  bake_time: number | null;
  bake_time_max: number | null;
  bake_time_unit: "min" | "hr" | null;
};

export function extractBakeFromSteps(steps: string[]): BakeInfo {
  const allStepText = steps.join(" ");

  let bake_temp: number | null = null;
  let bake_temp_unit: "F" | "C" | null = null;
  const tempMatch = allStepText.match(
    /preheat(?:\s+the)?(?:\s+oven)?\s+to\s+(\d+)\s*(?:°\s*|degrees?\s*)(F|C|fahrenheit|celsius)/i
  );
  if (tempMatch) {
    bake_temp = parseInt(tempMatch[1], 10);
    bake_temp_unit = tempMatch[2].toLowerCase().startsWith("c") ? "C" : "F";
  }

  let bake_time: number | null = null;
  let bake_time_max: number | null = null;
  let bake_time_unit: "min" | "hr" | null = null;
  const timeMatch = allStepText.match(
    /bake\s+.*?for\s+(\d+)\s*(?:(?:to|[-–])\s*(\d+))?\s*(min(?:utes?)?|hrs?|hours?)/i
  );
  if (timeMatch) {
    bake_time = parseInt(timeMatch[1], 10);
    bake_time_max = timeMatch[2] ? parseInt(timeMatch[2], 10) : null;
    bake_time_unit = timeMatch[3].toLowerCase().startsWith("h") ? "hr" : "min";
  }

  return {
    bake_temp,
    bake_temp_max: null, // no current heuristic for a temp range
    bake_temp_unit,
    bake_time,
    bake_time_max,
    bake_time_unit,
  };
}
