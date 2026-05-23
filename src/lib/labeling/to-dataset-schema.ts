/**
 * Adapt the recipe-box parsers' flat output (sectioned via "§" markers,
 * numeric fields at top level) into the AI-recipe-parser dataset schema
 * (sectioned arrays, nested servings/times). Mirrors the Python adapter
 * in AI-recipe-parser/extractors/regex_extractor.py.
 */

import type { ParsedIngredient } from "../parsers/ingredient";

const FRACTION_CHARS: Record<string, number> = {
  "⅛": 0.125, "¼": 0.25, "⅓": 1 / 3, "⅜": 0.375,
  "½": 0.5, "⅝": 0.625, "⅔": 2 / 3, "¾": 0.75, "⅞": 0.875,
};

function toFloat(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  for (const [ch, val] of Object.entries(FRACTION_CHARS)) {
    s = s.split(ch).join(` ${val} `);
  }
  s = s.split(/\s+/).filter(Boolean).join(" ");
  const direct = Number(s);
  if (!Number.isNaN(direct)) return direct;
  let total = 0;
  for (const part of s.split(" ")) {
    if (part.includes("/")) {
      const [num, den] = part.split("/");
      const d = Number(den);
      const n = Number(num);
      if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
      total += n / d;
    } else {
      const n = Number(part);
      if (!Number.isFinite(n)) return null;
      total += n;
    }
  }
  return total || null;
}

export type DatasetIngredientItem = {
  raw: string;
  quantity: number | null;
  quantity_max: number | null;
  unit: string | null;
  name: string;
};

export type DatasetIngredientSection = {
  section: string | null;
  items: DatasetIngredientItem[];
};

export type DatasetStepSection = {
  section: string | null;
  steps: string[];
};

export type DatasetExpected = {
  title: string | null;
  description: string | null;
  servings: { min: number | null; max: number | null; unit: string | null };
  times: { prep_minutes: number | null; cook_minutes: number | null, bake_time: number|null, bake_time_max: number|null};
  temperature: {bake_temp: number | null, bake_temp_max: number | null, unit: "C" | "F" | null}
  ingredients: DatasetIngredientSection[];
  steps: DatasetStepSection[];
  notes: string[];
  tags: string[];
};

export type RecipeBoxParserOutput = {
  title?: string | null;
  description?: string | null;
  servings?: number | null;
  servings_max?: number | null;
  servings_type?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  bake_time_minutes?: number | null;
  bake_time_max_minutes?: number | null;
  bake_temp?: number | null;
  bake_temp_max?: number | null;
  bake_temp_unit: string | null;
  ingredients?: ParsedIngredient[];
  steps?: string[];
  notes?: string | null;
};

function adaptIngredients(raw: ParsedIngredient[] | undefined): DatasetIngredientSection[] {
  const sections: DatasetIngredientSection[] = [];
  let current: DatasetIngredientSection = { section: null, items: [] };

  for (const item of raw ?? []) {
    if (item.unit === "§") {
      if (current.items.length > 0 || current.section !== null) {
        sections.push(current);
      }
      current = { section: item.name?.trim() || null, items: [] };
      continue;
    }
    const name = (item.name ?? "").trim();
    const qty = toFloat(item.quantity);
    const qtyMax = toFloat(item.quantity_max);
    const unit = item.unit ?? null;

    const rawParts: string[] = [];
    if (item.quantity) rawParts.push(String(item.quantity).trim());
    if (item.quantity_max) rawParts.push("-" + String(item.quantity_max).trim());
    if (unit) rawParts.push(unit);
    if (name) rawParts.push(name);

    current.items.push({
      raw: rawParts.length ? rawParts.join(" ") : name,
      quantity: qty,
      quantity_max: qtyMax,
      unit,
      name,
    });
  }
  if (current.items.length > 0 || current.section !== null) {
    sections.push(current);
  }
  return sections;
}

function adaptSteps(raw: string[] | undefined): DatasetStepSection[] {
  const sections: DatasetStepSection[] = [];
  let current: DatasetStepSection = { section: null, steps: [] };

  for (const s of raw ?? []) {
    if (typeof s === "string" && s.startsWith("§")) {
      if (current.steps.length > 0 || current.section !== null) {
        sections.push(current);
      }
      current = { section: s.slice(1).trim() || null, steps: [] };
      continue;
    }
    current.steps.push(s);
  }
  if (current.steps.length > 0 || current.section !== null) {
    sections.push(current);
  }
  return sections;
}

function normalizeTempUnit(raw: string | null | undefined): "C" | "F" | null {
  if (!raw) return null;

  const s = raw.trim().toLowerCase();

  if (s.includes("f")) return "F";
  if (s.includes("c")) return "C";

  return null;
}

export function toDatasetSchema(input: RecipeBoxParserOutput): DatasetExpected {
  const title = input.title?.trim() ? input.title : null;
  const notes = (input.notes ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title,
    description: input.description ?? null,
    servings: {
      min: input.servings ?? null,
      max: input.servings_max ?? null,
      unit: input.servings_type ?? null,
    },
    times: {
      prep_minutes: input.prep_time_minutes ?? null,
      cook_minutes: input.cook_time_minutes ?? null,
	  bake_time: input.bake_time_minutes ?? null,
	  bake_time_max: input.bake_time_max_minutes ?? null,
    },
    temperature: {
      bake_temp: input.bake_temp?? null,
      bake_temp_max: input.bake_temp_max?? null,
      unit: normalizeTempUnit(input.bake_temp_unit),
    },
    ingredients: adaptIngredients(input.ingredients),
    steps: adaptSteps(input.steps),
    notes,
    tags: [],
  };
}

/**
 * Reconstruct a clean plain-text representation of a parsed recipe.
 * Used as the `input` field of dataset entries when the source was a URL
 * import (i.e., we never had raw text in the first place — JSON-LD gave
 * us structured fields directly). Format mirrors what users would
 * typically paste into the parse-text endpoint.
 */
export function reconstructText(input: RecipeBoxParserOutput): string {
  const lines: string[] = [];
  if (input.title) lines.push(input.title);

  const servings = input.servings;
  if (servings != null) {
    const range = input.servings_max ? `-${input.servings_max}` : "";
    const unit = input.servings_type ? ` ${input.servings_type}` : " servings";
    lines.push(`Serves ${servings}${range}${unit}`);
  }
  if (input.prep_time_minutes != null) lines.push(`Prep: ${input.prep_time_minutes} min`);
  if (input.cook_time_minutes != null) lines.push(`Cook: ${input.cook_time_minutes} min`);
  if (input.bake_time_minutes != null) lines.push(`Bake: ${input.bake_time_minutes} min`);
  if (input.bake_time_max_minutes != null) lines.push(`Bake: ${input.bake_time_max_minutes} min`);
  const temp = input.bake_temp;
  if (temp != null) {
    const range = input.bake_temp_max ? `-${input.bake_temp_max}` : "";
    const unit = input.bake_temp_unit ? `°${input.bake_temp_unit}` : "";
    lines.push(`Bake: ${temp}${range}${unit}`);
}
  if (input.description) {
    lines.push("");
    lines.push(input.description);
  }

  if (input.ingredients?.length) {
    lines.push("");
    lines.push("Ingredients:");
    for (const item of input.ingredients) {
      if (item.unit === "§") {
        lines.push("");
        lines.push(`For the ${item.name}:`);
        continue;
      }
      const parts: string[] = [];
      if (item.quantity) parts.push(String(item.quantity));
      if (item.quantity_max) parts.push(`-${item.quantity_max}`);
      if (item.unit) parts.push(item.unit);
      if (item.name) parts.push(item.name);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  if (input.steps?.length) {
    lines.push("");
    lines.push("Instructions:");
    let n = 0;
    for (const s of input.steps) {
      if (typeof s === "string" && s.startsWith("§")) {
        lines.push("");
        lines.push(`${s.slice(1).trim()}:`);
        n = 0;
        continue;
      }
      n += 1;
      lines.push(`${n}. ${s}`);
    }
  }

  if (input.notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(input.notes);
  }

  return lines.join("\n");
}
