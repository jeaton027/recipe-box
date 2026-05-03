/**
 * Heuristic extraction of bake temperature + bake time from recipe step
 * text. Used by both /api/import-recipe (after we've assembled steps from
 * scraped HTML / JSON-LD) and /api/parse-recipe-text (after pasted text
 * has been split into steps). Same regexes; one place to fix bugs.
 *
 * Temp triggers (any of):
 *   • "preheat (the) (oven) to N"      — "Preheat the oven to 350°F"
 *   • "heat (the) oven to N"           — "and heat oven to 375°"
 *   • "(convection) (bake|roast) at N" — "Convection bake at 400°", "Roast at 425°F"
 * Unit letter (F/C) is optional. When absent we default to "F" — the
 * alternative is missing the temp entirely, and the form has a one-click
 * F⇄C convert toggle if the guess is wrong.
 *
 * Time triggers (any of):
 *   • "(bake|roast) ... for N (range) min/hr"   — classic phrasing
 *   • "(bake|roast) ... , N (range) min/hr"     — comma-separated, e.g.
 *     "Bake tart until set, 15–18 minutes."
 * Optional filler word allowed between the connector and the number
 * ("for about 20 minutes", "for approximately 1 hour").
 * The connector pattern is bounded to one sentence (`[^.]*?`) so we
 * don't span across periods like "Bake. Cool for 5 minutes."
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
    /(?:preheat(?:\s+the)?(?:\s+oven)?\s+to|heat(?:\s+the)?\s+oven\s+to|(?:convection\s+)?(?:bake|roast)\s+at)\s+(\d+)\s*(?:°|degrees?)\s*(F|C|fahrenheit|celsius)?/i
  );
  if (tempMatch) {
    bake_temp = parseInt(tempMatch[1], 10);
    if (tempMatch[2]) {
      bake_temp_unit = tempMatch[2].toLowerCase().startsWith("c") ? "C" : "F";
    } else {
      // No unit letter present (e.g. "heat oven to 375°."). Default to F
      // since most of our data is American; user can flip via the form's
      // convert button if wrong.
      bake_temp_unit = "F";
    }
  }

  let bake_time: number | null = null;
  let bake_time_max: number | null = null;
  let bake_time_unit: "min" | "hr" | null = null;
  const timeMatch = allStepText.match(
    /(?:bake|roast)\s+[^.]*?(?:for|,)\s+(?:about\s+|approximately\s+|around\s+|~\s*)?(\d+)\s*(?:(?:to|[-–])\s*(\d+))?\s*(min(?:utes?)?|hrs?|hours?)/i
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
