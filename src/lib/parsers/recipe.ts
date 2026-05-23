import { parseIngredientLine, type ParsedIngredient } from "./ingredient";
import { extractBakeFromSteps, type BakeInfo } from "./bake";
import { stripEmoji, decodeHtml, titleCaseFromAllCaps } from "./text";

const INGREDIENT_HEADERS = /^(ingredients?|what you('ll)? need):?$/i;
const DIVIDER_FOR_THE = /^for\s+(?:the\s+)?(.+?)[:.]?\s*$/i;
const DIVIDER_COLON = /^([^0-9]+):$/;
const INSTRUCTION_HEADERS = /^(instructions?|directions?|steps?|method|preparation|how to (make|prepare)):?$/i;
const NOTES_HEADERS = /^(notes?|tips?|tips?\s*&\s*notes?|notes?\s*&\s*tips?|recipe\s*notes?|chef'?s?\s*(?:notes?|tips?)|variations?|storage|to\s+store|substitutions?|make\s+ahead):?$/i;
const META_SERVINGS = /^(?:makes?|serves?|yields?)\s+(?:about\s+)?(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(.*)/i;
const META_PREP = /prep(?:\s+time)?:?\s*(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(?:hours?|hrs?|minutes?|mins?)/i;
const META_COOK = /(?:cook|bake)(?:\s+time)?:?\s*(\d+)(?:\s*(?:[-–]|to)\s*(\d+))?\s*(?:hours?|hrs?|minutes?|mins?)/i;
const STEP_NUMBER = /^(?:step\s*)?\d+[.):\s]\s*/i;
const STEP_NUMBER_STRICT = /^(?:step\s*)?\d+\s*[.):]\s+/i;
const LOOKS_LIKE_INGREDIENT = /^[\d⅛¼⅓⅜½⅝⅔¾⅞]/;
const IMPERATIVE_VERBS = new RegExp(
  "^(?:to\\s+)?(?:" +
    [
      "mix", "combine", "add", "stir", "whisk", "beat", "fold", "toss",
      "blend", "pulse", "process", "puree", "whip", "knead", "work",
      "preheat", "heat", "warm", "cook", "bake", "roast", "broil", "grill",
      "saute", "sauté", "sear", "fry", "boil", "simmer", "steam", "poach",
      "smoke", "toast", "melt", "reduce",
      "place", "put", "set\\s+aside", "transfer", "remove", "return",
      "spoon", "ladle", "tip", "slide", "arrange", "scatter", "lay",
      "spread", "drizzle", "sprinkle", "pour", "brush", "dust", "garnish",
      "cut", "chop", "slice", "dice", "mince", "grate", "crush", "crumble",
      "grind", "press", "shape", "form", "divide", "roll", "wash", "rinse",
      "drain", "pat", "squeeze", "strain", "skim", "scrape", "discard",
      "reserve", "marinate", "season", "taste",
      "cool", "chill", "refrigerate", "freeze", "thaw", "rest", "let",
      "allow", "continue", "repeat", "cover", "uncover", "line", "grease",
      "serve", "plate",
      "make", "prepare", "assemble", "finish", "complete",
      "begin", "start", "first", "then", "next", "finally", "now",
      "meanwhile", "while", "once", "after", "before",
      "bring",
    ].join("|") +
    ")\\b",
  "i"
);

export type ParsedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  servings_max: number | null;
  servings_type: string | null;
  prep_time_minutes: number | null;
  prep_time_minutes_max: number | null;
  cook_time_minutes: number | null;
  cook_time_minutes_max: number | null;
  notes: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  source_url: string | null;
  image_url: string | null;
  images: string[];
} & BakeInfo;

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text
    .split("\n")
    .map((l: string) =>
      stripEmoji(l).trim().replace(/^[•\-–—*▪▸►◦‣⁃▢☐□✓✔☑]\s*/, "")
    )
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
  const ingredients: ParsedIngredient[] = [];
  const steps: string[] = [];
  const notesLines: string[] = [];

  let section: "pre" | "ingredients" | "instructions" | "notes" = "pre";

  let hasHeaders = false;
  for (const line of lines) {
    if (INGREDIENT_HEADERS.test(line) || INSTRUCTION_HEADERS.test(line)) {
      hasHeaders = true;
      break;
    }
  }

  for (const line of lines) {
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

    if (section === "pre") {
      if (!title) {
        title = decodeHtml(line);
        continue;
      }

      const sm = line.match(META_SERVINGS);
      if (sm) {
        servings = parseInt(sm[1]);
        if (sm[2]) servingsMax = parseInt(sm[2]);
        const type = sm[3]?.trim().replace(/[.,;]$/, "");
        if (type) servingsType = type;
        continue;
      }

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

      description = description ? description + " " + line : line;
      continue;
    }

    if (section === "ingredients") {
      if (STEP_NUMBER_STRICT.test(line) && ingredients.length > 0) {
        section = "instructions";
        const cleaned = line.replace(STEP_NUMBER_STRICT, "").trim();
        if (cleaned) steps.push(decodeHtml(cleaned));
        continue;
      }
      if (
        IMPERATIVE_VERBS.test(line) &&
        !LOOKS_LIKE_INGREDIENT.test(line) &&
        ingredients.length > 0
      ) {
        section = "instructions";
        steps.push(decodeHtml(line));
        continue;
      }
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

    if (section === "instructions") {
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

    if (section === "notes") {
      notesLines.push(decodeHtml(line));
    }
  }

  const bake = extractBakeFromSteps(steps);

  const rawNotes = notesLines.length
    ? notesLines
        .join("\n")
        .replace(/^\s*(?:notes?|tips?|pro\s*tips?|chef'?s?\s*(?:notes?|tips?))\s*:?\s*/i, "")
    : "";

  return {
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
  };
}
