import { NextRequest, NextResponse } from "next/server";

const INGREDIENT_HEADERS = /^(ingredients?|what you('ll)? need):?$/i;
const DIVIDER_FOR_THE = /^for\s+(?:the\s+)?(.+?)[:.]?\s*$/i;
const DIVIDER_COLON = /^([^0-9]+):$/;
const INSTRUCTION_HEADERS = /^(instructions?|directions?|steps?|method|preparation|how to (make|prepare)):?$/i;
const META_SERVINGS = /^(?:makes?|serves?|yields?)\s+(?:about\s+)?(\d+)\s*(.*)/i;
const META_PREP = /prep(?:\s+time)?:?\s*(\d+)\s*(?:hours?|hrs?|minutes?|mins?)/i;
const META_COOK = /(?:cook|bake)(?:\s+time)?:?\s*(\d+)\s*(?:hours?|hrs?|minutes?|mins?)/i;
const STEP_NUMBER = /^(?:step\s*)?\d+[.):\s]\s*/i;
const LOOKS_LIKE_INGREDIENT = /^[\d⅛¼⅓⅜½⅝⅔¾⅞]/;

function decodeHtml(str: string): string {
  return str
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/gi, "&");
}

function parseIngredientLine(str: string): {
  quantity: string | null;
  quantity_max: string | null;
  unit: string | null;
  name: string;
} {
  const clean = str.trim();

  // Range + unit + name: "1-2 tsp sugar", "1/4-1/2 C flour"
  const mr = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
  );
  if (mr) return { quantity: mr[1].trim(), quantity_max: mr[2].trim(), unit: mr[3], name: decodeHtml(mr[4].trim()) };

  // Range + name (no unit): "1-2 eggs"
  const mr2 = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+(.+)$/
  );
  if (mr2) return { quantity: mr2[1].trim(), quantity_max: mr2[2].trim(), unit: null, name: decodeHtml(mr2[3].trim()) };

  // Single quantity + unit + name: "1 1/2 cups all-purpose flour"
  const m = clean.match(
    /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
  );
  if (m) return { quantity: m[1].trim(), quantity_max: null, unit: m[2], name: decodeHtml(m[3].trim()) };

  // Single quantity + name (no unit): "2 eggs"
  const m2 = clean.match(/^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+(.+)$/);
  if (m2) return { quantity: m2[1].trim(), quantity_max: null, unit: null, name: decodeHtml(m2[2].trim()) };

  // Fallback: whole string as name
  return { quantity: null, quantity_max: null, unit: null, name: decodeHtml(str) };
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  const lines = text
    .split("\n")
    .map((l: string) => l.trim().replace(/^[•\-–—*▪▸►◦‣⁃▢☐□✓✔☑]\s*/, ""))
    .filter((l: string) => l.length > 0);

  let title = "";
  let description = "";
  let servings: number | null = null;
  let servingsType = "";
  let prepTime: number | null = null;
  let cookTime: number | null = null;
  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  const steps: string[] = [];

  let section: "pre" | "ingredients" | "instructions" = "pre";

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

    // ── Pre-section: title, metadata, description ──
    if (section === "pre") {
      if (!title) {
        title = decodeHtml(line);
        continue;
      }

      // Servings: "Makes 36 cookies", "Serves 4"
      const sm = line.match(META_SERVINGS);
      if (sm) {
        servings = parseInt(sm[1]);
        const type = sm[2]?.trim().replace(/[.,;]$/, "");
        if (type) servingsType = type;
        continue;
      }

      // Prep time
      const pm = line.match(META_PREP);
      if (pm) {
        const n = parseInt(pm[1]);
        prepTime = /hours?|hrs?/i.test(line) ? n * 60 : n;
        continue;
      }

      // Cook time
      const cm = line.match(META_COOK);
      if (cm) {
        const n = parseInt(cm[1]);
        cookTime = /hours?|hrs?/i.test(line) ? n * 60 : n;
        continue;
      }

      // No headers found — detect sections by line pattern
      if (!hasHeaders) {
        if (LOOKS_LIKE_INGREDIENT.test(line)) {
          section = "ingredients";
          ingredients.push(parseIngredientLine(line));
          continue;
        }
        if (STEP_NUMBER.test(line)) {
          section = "instructions";
          const cleaned = line.replace(STEP_NUMBER, "").trim();
          if (cleaned) steps.push(decodeHtml(cleaned));
          continue;
        }
      }

      // Otherwise treat as description
      description = description ? description + " " + line : line;
      continue;
    }

    // ── Ingredients section ──
    if (section === "ingredients") {
      // A numbered line after ingredients → switch to instructions
      if (
        STEP_NUMBER.test(line) &&
        !LOOKS_LIKE_INGREDIENT.test(line) &&
        ingredients.length > 0
      ) {
        section = "instructions";
        const cleaned = line.replace(STEP_NUMBER, "").trim();
        if (cleaned) steps.push(decodeHtml(cleaned));
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
  }

  // Extract bake temp and time from step text
  const allStepText = steps.join(" ");

  let bakeTemp: number | null = null;
  let bakeTempUnit: string | null = null;
  const tempMatch = allStepText.match(/preheat(?:\s+the)?(?:\s+oven)?\s+to\s+(\d+)\s*(?:°\s*|degrees?\s*)(F|C|fahrenheit|celsius)/i);
  if (tempMatch) {
    bakeTemp = parseInt(tempMatch[1]);
    const rawUnit = tempMatch[2].toLowerCase();
    bakeTempUnit = rawUnit.startsWith("c") ? "C" : "F";
  }

  let bakeTime: number | null = null;
  let bakeTimeMax: number | null = null;
  let bakeTimeUnit: string | null = null;
  const timeMatch = allStepText.match(/bake\s+.*?for\s+(\d+)\s*(?:(?:to|[-–])\s*(\d+))?\s*(min(?:utes?)?|hrs?|hours?)/i);
  if (timeMatch) {
    bakeTime = parseInt(timeMatch[1]);
    bakeTimeMax = timeMatch[2] ? parseInt(timeMatch[2]) : null;
    const rawTimeUnit = timeMatch[3].toLowerCase();
    bakeTimeUnit = rawTimeUnit.startsWith("h") ? "hr" : "min";
  }

  return NextResponse.json({
    title,
    description: description || null,
    servings,
    servings_type: servingsType || null,
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    bake_time: bakeTime,
    bake_time_max: bakeTimeMax,
    bake_time_unit: bakeTimeUnit,
    bake_temp: bakeTemp,
    bake_temp_max: null,
    bake_temp_unit: bakeTempUnit,
    ingredients,
    steps,
    source_url: null,
    image_url: null,
    images: [],
  });
}
