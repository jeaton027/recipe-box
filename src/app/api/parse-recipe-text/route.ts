import { NextRequest, NextResponse } from "next/server";
import { parseIngredientLine } from "@/lib/parsers/ingredient";
import { extractBakeFromSteps } from "@/lib/parsers/bake";
import { stripEmoji, decodeHtml, titleCaseFromAllCaps } from "@/lib/parsers/text";

const INGREDIENT_HEADERS = /^(ingredients?|what you('ll)? need):?$/i;
const DIVIDER_FOR_THE = /^for\s+(?:the\s+)?(.+?)[:.]?\s*$/i;
const DIVIDER_COLON = /^([^0-9]+):$/;
const INSTRUCTION_HEADERS = /^(instructions?|directions?|steps?|method|preparation|how to (make|prepare)):?$/i;
const NOTES_HEADERS = /^(notes?|tips?|tips?\s*&\s*notes?|notes?\s*&\s*tips?|recipe\s*notes?|chef'?s?\s*(?:notes?|tips?)|variations?|storage|to\s+store|substitutions?|make\s+ahead):?$/i;
// Each of these captures an optional max via "(\d+)\s*(?:[-–]|to)\s*(\d+)"
// so "Serves 4-6", "Prep: 15-20 min", "Cook 30 to 45 minutes" populate
// both the min and max fields.
const META_SERVINGS = /^(?:makes?|serves?|yields?)\s+(?:about\s+)?(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(.*)/i;
const META_PREP = /prep(?:\s+time)?:?\s*(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(?:hours?|hrs?|minutes?|mins?)/i;
const META_COOK = /(?:cook|bake)(?:\s+time)?:?\s*(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(?:hours?|hrs?|minutes?|mins?)/i;
// STEP_NUMBER kept loose (allows trailing space after the digit) for the
// initial "no headers, looks like a numbered list" pre-section detection,
// where it pairs with LOOKS_LIKE_INGREDIENT precedence.
const STEP_NUMBER = /^(?:step\s*)?\d+[.):\s]\s*/i;
// STEP_NUMBER_STRICT requires "." / ")" / ":" after the digit — a
// signal that's unambiguously a numbered-step prefix (never an ingredient
// quantity like "1 tsp"). Used in the ingredients section to detect
// when we've crossed into instructions.
const STEP_NUMBER_STRICT = /^(?:step\s*)?\d+\s*[.):]\s+/i;
const LOOKS_LIKE_INGREDIENT = /^[\d⅛¼⅓⅜½⅝⅔¾⅞]/;
// Imperative cooking verbs that, when leading a line *after* the
// ingredient list has started, signal a transition to instructions.
// Conservative list — limited to verbs that almost never lead a non-step
// sentence in recipe contexts. Update freely when real-world misses
// surface; the gating on `ingredients.length > 0` keeps the false-
// positive surface low.
const IMPERATIVE_VERBS = new RegExp(
  // Optional "to " prefix catches infinitive constructions like
  // "To make this dish, ...", "To prepare the sauce, ..." — common
  // opening for prose-style instructions.
  "^(?:to\\s+)?(?:" +
    [
      // Combining / mixing
      "mix", "combine", "add", "stir", "whisk", "beat", "fold", "toss",
      "blend", "pulse", "process", "puree", "whip", "knead", "work",
      // Heat / cooking
      "preheat", "heat", "warm", "cook", "bake", "roast", "broil", "grill",
      "saute", "sauté", "sear", "fry", "boil", "simmer", "steam", "poach",
      "smoke", "toast", "melt", "reduce",
      // Placement / movement
      "place", "put", "set\\s+aside", "transfer", "remove", "return",
      "spoon", "ladle", "tip", "slide", "arrange", "scatter", "lay",
      "spread", "drizzle", "sprinkle", "pour", "brush", "dust", "garnish",
      // Prep verbs
      "cut", "chop", "slice", "dice", "mince", "grate", "crush", "crumble",
      "grind", "press", "shape", "form", "divide", "roll", "wash", "rinse",
      "drain", "pat", "squeeze", "strain", "skim", "scrape", "discard",
      "reserve", "marinate", "season", "taste",
      // Time / state changes
      "cool", "chill", "refrigerate", "freeze", "thaw", "rest", "let",
      "allow", "continue", "repeat", "cover", "uncover", "line", "grease",
      // Service
      "serve", "plate",
      // Meta-step verbs (recipe section openers)
      "make", "prepare", "assemble", "finish", "complete",
      // Sequence starters (almost always lead a step, not an ingredient)
      "begin", "start", "first", "then", "next", "finally", "now",
      // Sequencing words
      "meanwhile", "while", "once", "after", "before",
      // Bring (very common: "Bring to a boil")
      "bring",
    ].join("|") +
    ")\\b",
  "i"
);

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  const lines = text
    .split("\n")
    // stripEmoji must run *before* classification, not just at response
    // time — otherwise an emoji-prefixed line like "🌱 120g flour" fails
    // LOOKS_LIKE_INGREDIENT (which requires a leading digit) and gets
    // mis-routed to description. Doing it here also strips any inline
    // decorative emojis from steps before regex matching.
    .map((l: string) =>
      stripEmoji(l).trim().replace(/^[•\-–—*▪▸►◦‣⁃▢☐□✓✔☑]\s*/, "")
    )
    // Drop empty lines and lines containing only punctuation/decoration
    // (e.g. ".", ".", "---" used as separators in pasted captions).
    // Anything with at least one alphanumeric character is meaningful.
    .filter((l: string) => l.length > 0 && /[a-zA-Z0-9]/.test(l));

  let title = "";
  let description = "";
  let servings: number | null = null;
  let servingsMax: number | null = null;
  let servingsType = "";
  let prepTime: number | null = null;
  let prepTimeMax: number | null = null;
  let cookTime: number | null = null;
  let cookTimeMax: number | null = null;
  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  const steps: string[] = [];
  const notesLines: string[] = [];

  let section: "pre" | "ingredients" | "instructions" | "notes" = "pre";

  // First pass: check if there are any section headers
  let hasHeaders = false;
  for (const line of lines) {
    if (INGREDIENT_HEADERS.test(line) || INSTRUCTION_HEADERS.test(line)) {
      hasHeaders = true;
      break;
    }
  }

  for (const line of lines) {
    // ── Section header detection ──
    if (INGREDIENT_HEADERS.test(line)) {
      section = "ingredients";
      continue;
    }
    if (INSTRUCTION_HEADERS.test(line)) {
      section = "instructions";
      continue;
    }
    if (NOTES_HEADERS.test(line)) {
      section = "notes";
      continue;
    }

    // ── Pre-section: title, metadata, description ──
    if (section === "pre") {
      if (!title) {
        title = decodeHtml(line);
        continue;
      }

      // Servings: "Makes 36 cookies", "Serves 4", "Serves 4-6"
      const sm = line.match(META_SERVINGS);
      if (sm) {
        servings = parseInt(sm[1]);
        if (sm[2]) servingsMax = parseInt(sm[2]);
        const type = sm[3]?.trim().replace(/[.,;]$/, "");
        if (type) servingsType = type;
        continue;
      }

      // Prep time: "Prep: 15 min", "Prep time 15-20 minutes"
      const pm = line.match(META_PREP);
      if (pm) {
        const isHours = /hours?|hrs?/i.test(line);
        const n = parseInt(pm[1]);
        prepTime = isHours ? n * 60 : n;
        if (pm[2]) {
          const nMax = parseInt(pm[2]);
          prepTimeMax = isHours ? nMax * 60 : nMax;
        }
        continue;
      }

      // Cook time: "Cook: 30 min", "Cook time 30-45 minutes"
      const cm = line.match(META_COOK);
      if (cm) {
        const isHours = /hours?|hrs?/i.test(line);
        const n = parseInt(cm[1]);
        cookTime = isHours ? n * 60 : n;
        if (cm[2]) {
          const nMax = parseInt(cm[2]);
          cookTimeMax = isHours ? nMax * 60 : nMax;
        }
        continue;
      }

      // No headers found — detect sections by line pattern.
      // Check STEP_NUMBER_STRICT *before* LOOKS_LIKE_INGREDIENT: a line
      // like "1. Bring a pan..." matches both, but the dot makes it
      // unambiguously a numbered step.
      if (!hasHeaders) {
        if (STEP_NUMBER_STRICT.test(line)) {
          section = "instructions";
          const cleaned = line.replace(STEP_NUMBER_STRICT, "").trim();
          if (cleaned) steps.push(decodeHtml(cleaned));
          continue;
        }
        if (LOOKS_LIKE_INGREDIENT.test(line)) {
          section = "ingredients";
          ingredients.push(parseIngredientLine(line));
          continue;
        }
      }

      // Otherwise treat as description
      description = description ? description + " " + line : line;
      continue;
    }

    // ── Ingredients section ──
    if (section === "ingredients") {
      // A strictly-numbered line after ingredients → switch to instructions.
      // STEP_NUMBER_STRICT requires "." / ")" / ":" after the digit, which
      // is unambiguously a step prefix (never an ingredient quantity like
      // "1 tsp"), so we no longer need the !LOOKS_LIKE_INGREDIENT guard.
      if (STEP_NUMBER_STRICT.test(line) && ingredients.length > 0) {
        section = "instructions";
        const cleaned = line.replace(STEP_NUMBER_STRICT, "").trim();
        if (cleaned) steps.push(decodeHtml(cleaned));
        continue;
      }
      // Imperative-verb-led line after ingredients → switch to instructions.
      // Catches unstructured captions where steps follow ingredients
      // without explicit headers or numbering ("Toast the walnuts...").
      // Gated by `ingredients.length > 0` so descriptions can still
      // contain phrases like "Set aside an hour to make these".
      // The !LOOKS_LIKE_INGREDIENT guard prevents an ingredient that
      // happens to start with a verb-shaped word from being misclassified.
      if (
        IMPERATIVE_VERBS.test(line) &&
        !LOOKS_LIKE_INGREDIENT.test(line) &&
        ingredients.length > 0
      ) {
        section = "instructions";
        steps.push(decodeHtml(line));
        continue;
      }
      // Check for divider: "For the crust" or "Sauce ingredients:"
      const forMatch = line.match(DIVIDER_FOR_THE);
      if (forMatch && !LOOKS_LIKE_INGREDIENT.test(line)) {
        ingredients.push({ quantity: null, quantity_max: null, unit: "§", name: decodeHtml(forMatch[1].trim()) });
        continue;
      }
      const colonMatch = line.match(DIVIDER_COLON);
      if (colonMatch && !LOOKS_LIKE_INGREDIENT.test(line)) {
        ingredients.push({ quantity: null, quantity_max: null, unit: "§", name: decodeHtml(colonMatch[1].trim()) });
        continue;
      }
      ingredients.push(parseIngredientLine(line));
      continue;
    }

    // ── Instructions section ──
    if (section === "instructions") {
      // Check for divider in steps: "For the glaze:" or "Assembly:"
      const forMatch = line.match(DIVIDER_FOR_THE);
      if (forMatch && !STEP_NUMBER.test(line)) {
        steps.push("§" + decodeHtml(forMatch[1].trim()));
        continue;
      }
      const colonMatch = line.match(DIVIDER_COLON);
      if (colonMatch && !STEP_NUMBER.test(line)) {
        steps.push("§" + decodeHtml(colonMatch[1].trim()));
        continue;
      }
      const cleaned = line.replace(STEP_NUMBER, "").trim();
      if (cleaned) steps.push(decodeHtml(cleaned));
    }

    // ── Notes section ──
    if (section === "notes") {
      notesLines.push(decodeHtml(line));
    }
  }

  // Extract bake temp and time from step text
  const bake = extractBakeFromSteps(steps);

  // Strip emojis from user-visible text fields. Pasted captions
  // (Instagram especially) often include decorative emojis we don't
  // want polluting the saved recipe.
  // The leading-header strip mirrors stripLeadingNotesHeader in
  // /api/import-recipe — same set of variants (Notes / Tips / Pro Tip /
  // Chef's Note, etc.). Kept inline because it's a single use and
  // /api/parse-recipe-text doesn't import from /api/import-recipe.
  const rawNotes = notesLines.length
    ? notesLines
        .join("\n")
        .replace(/^\s*(?:notes?|tips?|pro\s*tips?|chef'?s?\s*(?:notes?|tips?))\s*:?\s*/i, "")
    : "";

  return NextResponse.json({
    title: titleCaseFromAllCaps(stripEmoji(title)),
    description: description ? stripEmoji(description) : null,
    servings,
    servings_max: servingsMax,
    servings_type: servingsType || null,
    prep_time_minutes: prepTime,
    prep_time_minutes_max: prepTimeMax,
    cook_time_minutes: cookTime,
    cook_time_minutes_max: cookTimeMax,
    ...bake,
    notes: rawNotes ? stripEmoji(rawNotes) || null : null,
    ingredients: ingredients.map((i) => ({
      ...i,
      name: stripEmoji(i.name),
    })),
    steps: steps.map((s) => stripEmoji(s)),
    source_url: null,
    image_url: null,
    images: [],
  });
}
