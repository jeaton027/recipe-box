// fetches and parses
import { NextRequest, NextResponse } from "next/server";

const NOTES_MAX_CHARS = 2000;

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

// Convert a snippet of HTML into plain text with lightweight markdown:
// bullet (`- `) for <ul>/<li>, numbered for <ol>/<li>, paragraphs get
// double newlines, <br> becomes single newline. All other tags are stripped
// but their inner text is preserved.
function htmlToMarkdown(html: string): string {
  let out = html.replace(/\r\n/g, "\n");

  // <br> → newline
  out = out.replace(/<br\s*\/?>/gi, "\n");

  // <ul>...</ul> → "- item\n- item"
  out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner: string) => {
    const items = inner
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => {
        const cleaned = item.replace(/<[^>]+>/g, "").trim();
        return cleaned ? `- ${cleaned}\n` : "";
      })
      // drop anything outside <li>...</li>
      .replace(/(?:^|\n)(?!- )[^\n]*/g, "");
    return `\n${items}\n`;
  });

  // <ol>...</ol> → "1. item\n2. item"
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    let n = 0;
    const items = inner
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => {
        const cleaned = item.replace(/<[^>]+>/g, "").trim();
        if (!cleaned) return "";
        n++;
        return `${n}. ${cleaned}\n`;
      })
      .replace(/(?:^|\n)(?!\d+\. )[^\n]*/g, "");
    return `\n${items}\n`;
  });

  // <p>text</p> → text + blank line
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner: string) => {
    return `${inner.trim()}\n\n`;
  });

  // Strip any remaining tags
  out = out.replace(/<[^>]+>/g, "");

  // Decode entities and tidy whitespace
  out = decodeHtml(out);
  out = out.replace(/[ \t]+/g, " "); // collapse runs of spaces
  out = out.replace(/[ \t]*\n[ \t]*/g, "\n"); // trim around newlines
  out = out.replace(/\n{3,}/g, "\n\n"); // max one blank line

  return out.trim();
}

// Walks forward from an opening <div> tag counting <div>/</div> to find
// the matching close — more robust than a naive non-greedy regex when the
// notes container has nested elements.
function extractContainerByClass(html: string, className: string): string | null {
  const openRegex = new RegExp(
    `<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`,
    "i"
  );
  const openMatch = openRegex.exec(html);
  if (!openMatch) return null;

  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  let i = start;
  while (i < html.length) {
    const nextOpen = html.toLowerCase().indexOf("<div", i);
    const nextClose = html.toLowerCase().indexOf("</div>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        return html.slice(start, nextClose);
      }
      i = nextClose + 6;
    }
  }
  return null;
}

// Layer 1: look for notes in non-standard JSON-LD fields.
// Schema.org Recipe doesn't define a `notes` property, but some sites /
// plugins include one under `recipeNotes`, or inside `additionalProperty`
// as `[{ name: "Notes", value: "..." }, ...]`.
function extractNotesFromSchema(
  schema: Record<string, unknown>
): string | null {
  // `recipeNotes` — string or array of strings
  const rn = schema.recipeNotes;
  if (typeof rn === "string" && rn.trim()) return rn.trim();
  if (Array.isArray(rn)) {
    const joined = rn
      .filter((n): n is string => typeof n === "string")
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  // `additionalProperty` with a `name` of Notes/Tips/etc.
  if (Array.isArray(schema.additionalProperty)) {
    for (const prop of schema.additionalProperty) {
      if (typeof prop === "object" && prop !== null) {
        const p = prop as Record<string, unknown>;
        const name =
          typeof p.name === "string" ? p.name.toLowerCase().trim() : "";
        const matches =
          name === "notes" ||
          name === "tips" ||
          name === "recipe notes" ||
          name === "recipe tips" ||
          name === "cook's notes" ||
          name === "chef's notes";
        if (matches && typeof p.value === "string" && p.value.trim()) {
          return p.value.trim();
        }
      }
    }
  }

  return null;
}

// Layer 2: scrape known recipe-plugin DOM containers. These classes are
// stable even when the displayed heading is "Tips" instead of "Notes".
const PLUGIN_NOTES_CLASSES = [
  "wprm-recipe-notes", // WP Recipe Maker
  "tasty-recipes-notes-body", // Tasty Recipes (body before container to prefer inner)
  "tasty-recipes-notes",
  "mv-create-notes-content", // Mediavine Create
  "mv-create-notes",
  "recipe-card-notes", // Recipe Card Blocks
];

function extractNotesFromHtml(html: string): string | null {
  for (const cls of PLUGIN_NOTES_CLASSES) {
    const inner = extractContainerByClass(html, cls);
    if (inner && inner.trim()) return inner;
  }
  return null;
}

// Top-level note extractor: layer 1 first, then layer 2. Hard-fails to
// null if the processed markdown exceeds NOTES_MAX_CHARS (we almost
// certainly grabbed the wrong chunk of the page).
function extractNotes(
  schema: Record<string, unknown>,
  html: string
): string | null {
  const raw =
    extractNotesFromSchema(schema) ?? extractNotesFromHtml(html) ?? null;
  if (!raw) return null;
  const processed = htmlToMarkdown(raw);
  if (!processed) return null;
  if (processed.length > NOTES_MAX_CHARS) return null;
  return processed;
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // 1) fetch HTML
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: "Could not fetch URL" }, { status: 422 });
  }

  // 2) find application/ld+json script blocks
  const ldJsonBlocks: string[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    ldJsonBlocks.push(match[1]);
  }
  console.log("Found ld+json blocks:", ldJsonBlocks.length);

  // 3) find recipe schema (might be nested inside @graph)
  let schema: Record<string, unknown> | null = null;
  for (const block of ldJsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"]
        ? parsed["@graph"]
        : [parsed];
      const recipe = candidates.find(
        (item: Record<string, unknown>) =>
          item["@type"] === "Recipe" ||
          (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
      );
      if (recipe) { schema = recipe; break; }
    } catch {}
  }

  if (!schema) {
    return NextResponse.json({ error: "No recipe data found on this page" }, { status: 422 });
  }

  // 4) parse ISO duration to minutes  e.g. "PT1H30M" -> 90
  function parseDuration(val: unknown): number | null {
    if (!val || typeof val !== "string") return null;
    const h = val.match(/(\d+)H/)?.[1];
    const m = val.match(/(\d+)M/)?.[1];
    return (parseInt(h ?? "0") * 60) + parseInt(m ?? "0") || null;
  }

  // 5) parse servings from "4 servings" or just "4"
  function parseServings(val: unknown): number | null {
    if (!val) return null;
    const n = parseInt(String(val));
    return isNaN(n) ? null : n;
  }

  // 6) parse ingredients — attempt to split "2 cups flour" into parts
  const rawIngredients: string[] = Array.isArray(schema.recipeIngredient)
    ? schema.recipeIngredient.map(String)
    : [];

  const ingredients = rawIngredients.map((str) => {
    // Range: "1-2 tsp sugar" or "1/4-1/2 C flour"
    const mr = str.match(
      /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
    );
    if (mr) {
      return { quantity: mr[1].trim() || null, quantity_max: mr[2].trim() || null, unit: mr[3], name: mr[4] };
    }
    // Range without unit: "1-2 eggs"
    const mr2 = str.match(
      /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+(.+)$/
    );
    if (mr2) {
      return { quantity: mr2[1].trim() || null, quantity_max: mr2[2].trim() || null, unit: null, name: mr2[3] };
    }
    // Single quantity: optional number/fraction, optional unit word, rest is name
    const m = str.match(
      /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
    );
    if (m) {
      return { quantity: m[1].trim() || null, quantity_max: null, unit: m[2], name: m[3] };
    }
    // backup: whole string as name
    return { quantity: null, quantity_max: null, unit: null, name: str };
  });

  // 7)parse steps — handles flat HowToStep arrays AND nested HowToSection
  const rawSteps = Array.isArray(schema.recipeInstructions)
    ? schema.recipeInstructions
    : [];
  const steps: string[] = [];
  for (const s of rawSteps) {
    if (typeof s === "string") { if (s.trim()) steps.push(s); continue; }
    if (typeof s === "object" && s !== null) {
      const obj = s as Record<string, unknown>;
      // HowToSection: has a name and nested itemListElement
      if (Array.isArray(obj.itemListElement)) {
        if (obj.name && typeof obj.name === "string") {
          steps.push("§" + obj.name); // section divider
        }
        for (const sub of obj.itemListElement) {
          if (typeof sub === "string") { if (sub.trim()) steps.push(sub); }
          else if (typeof sub === "object" && sub !== null) {
            const text = (sub as Record<string, unknown>).text;
            if (text && typeof text === "string") steps.push(text);
          }
        }
        continue;
      }
      // HowToStep: has .text
      if (obj.text && typeof obj.text === "string") steps.push(obj.text);
    }
  }

  // 8) collect images — take best single image from schema, plus step images
  function getBestImage(img: unknown): string | null {
    if (!img) return null;
    if (typeof img === "string") return img.startsWith("http") ? img : null;
    if (Array.isArray(img)) {
      // Array of ImageObjects (same photo, different sizes) — pick highest resolution
      const candidates = img
        .map((item) => {
          if (typeof item === "string") return { url: item, width: 0 };
          if (typeof item === "object" && item !== null) {
            const r = item as Record<string, unknown>;
            const url = typeof r.url === "string" ? r.url : null;
            const width = typeof r.width === "number" ? r.width : 0;
            return url ? { url, width } : null;
          }
          return null;
        })
        .filter((x): x is { url: string; width: number } => x !== null && x.url.startsWith("http"));
      if (!candidates.length) return null;
      return candidates.sort((a, b) => b.width - a.width)[0].url;
    }
    if (typeof img === "object" && img !== null) {
      return getBestImage((img as Record<string, unknown>).url);
    }
    return null;
  }

  // Extract images embedded in HowToStep objects (step-by-step photos)
  const stepImages: string[] = rawSteps
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && "image" in s)
    .map((s) => getBestImage(s.image))
    .filter((url): url is string => url !== null);

  // og:image and twitter:image meta tags
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  const metaImages = metaPatterns
    .map((p) => html.match(p)?.[1])
    .filter((s): s is string => !!s && s.startsWith("http"));

  const mainImage = getBestImage(schema.image);
  const allImages = [...new Set([
    ...(mainImage ? [mainImage] : []),
    ...stepImages,
    ...metaImages,
  ])];

  // 9) Extract bake temp and time from step text
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
    title: decodeHtml(String(schema.name ?? "")),
    description: decodeHtml(String(schema.description ?? "")),
    servings: parseServings(schema.recipeYield),
    prep_time_minutes: parseDuration(schema.prepTime),
    cook_time_minutes: parseDuration(schema.cookTime),
    bake_time: bakeTime,
    bake_time_max: bakeTimeMax,
    bake_time_unit: bakeTimeUnit,
    bake_temp: bakeTemp,
    bake_temp_max: null,
    bake_temp_unit: bakeTempUnit,
    notes: extractNotes(schema, html),
    images: allImages,
    ingredients: ingredients.map((i) => ({ ...i, name: decodeHtml(i.name), unit: i.unit ? decodeHtml(i.unit) : i.unit })),
    steps: steps.map((s) => decodeHtml(String(s))),
  });
}


