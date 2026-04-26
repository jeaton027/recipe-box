import { NextRequest, NextResponse } from "next/server";
import { parseIngredientLine } from "@/lib/parsers/ingredient";
import { extractBakeFromSteps } from "@/lib/parsers/bake";

const INGREDIENT_HEADERS = /^(ingredients?|what you('ll)? need):?$/i;
const DIVIDER_FOR_THE = /^for\s+(?:the\s+)?(.+?)[:.]?\s*$/i;
const DIVIDER_COLON = /^([^0-9]+):$/;
const INSTRUCTION_HEADERS = /^(instructions?|directions?|steps?|method|preparation|how to (make|prepare)):?$/i;
const NOTES_HEADERS = /^(notes?|tips?|tips?\s*&\s*notes?|notes?\s*&\s*tips?|recipe\s*notes?|chef'?s?\s*(?:notes?|tips?)|variations?|storage|to\s+store|substitutions?|make\s+ahead):?$/i;
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

    // ── Notes section ──
    if (section === "notes") {
      notesLines.push(decodeHtml(line));
    }
  }

  // Extract bake temp and time from step text
  const bake = extractBakeFromSteps(steps);

  return NextResponse.json({
    title,
    description: description || null,
    servings,
    servings_type: servingsType || null,
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    ...bake,
    notes: notesLines.length ? notesLines.join("\n") : null,
    ingredients,
    steps,
    source_url: null,
    image_url: null,
    images: [],
  });
}
