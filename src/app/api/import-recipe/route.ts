// fetches and parses
import { NextRequest, NextResponse } from "next/server";
import {
  parseIngredientLine,
  hasNumber,
  type ParsedIngredient,
} from "@/lib/parsers/ingredient";
import { extractBakeFromSteps } from "@/lib/parsers/bake";
import { stripEmoji, decodeHtml, titleCaseFromAllCaps } from "@/lib/parsers/text";

const NOTES_MAX_CHARS = 2000;

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

// Strip a redundant heading from the start of the extracted notes
// block. Some recipe-card plugins render the heading inside the notes
// container, and after htmlToMarkdown the heading collides with the
// body — sometimes with no whitespace at all (e.g.
// "NotesI usually use chicken thighs..." from zestfulkitchen.com).
//
// Covers: "Note", "Notes", "Tip", "Tips", "Pro Tip(s)", "Chef's Tip(s)",
// "Chef's Note(s)" — with or without trailing colon, any case.
const NOTES_HEADER_STRIP_RE =
  /^\s*(?:notes?|tips?|pro\s*tips?|chef'?s?\s*(?:notes?|tips?))\s*:?\s*/i;

function stripLeadingNotesHeader(s: string): string {
  return s.replace(NOTES_HEADER_STRIP_RE, "");
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
  const processed = stripLeadingNotesHeader(htmlToMarkdown(raw));
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

  // 4) parse duration to {min, max} minutes. Handles three shapes:
  //    - ISO 8601 ("PT1H30M") — single value
  //    - Plain range ("15-20 minutes", "1 to 2 hours") — both
  //    - Plain single ("15 minutes") — single value
  // JSON-LD is supposed to be ISO, but real recipe sites are messy and
  // sometimes drop the raw user-entered string into prepTime/cookTime.
  function parseDuration(val: unknown): { min: number | null; max: number | null } {
    if (!val || typeof val !== "string") return { min: null, max: null };
    // ISO 8601 first.
    if (/^PT/i.test(val)) {
      const h = val.match(/(\d+)H/i)?.[1];
      const m = val.match(/(\d+)M/i)?.[1];
      const total = parseInt(h ?? "0") * 60 + parseInt(m ?? "0");
      return { min: total || null, max: null };
    }
    // Plain text — look for range first, then single.
    const range = val.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(hours?|hrs?|minutes?|mins?)?/i);
    if (range) {
      const isHours = /hours?|hrs?/i.test(range[3] ?? "");
      return {
        min: parseInt(range[1]) * (isHours ? 60 : 1),
        max: parseInt(range[2]) * (isHours ? 60 : 1),
      };
    }
    const single = val.match(/(\d+)\s*(hours?|hrs?|minutes?|mins?)?/i);
    if (single) {
      const isHours = /hours?|hrs?/i.test(single[2] ?? "");
      return { min: parseInt(single[1]) * (isHours ? 60 : 1), max: null };
    }
    return { min: null, max: null };
  }

  // 5) parse servings from "4 servings", "4-6 servings", "Serves 4 to 6", or just "4"
  function parseServings(val: unknown): { min: number | null; max: number | null } {
    if (!val) return { min: null, max: null };
    const s = String(val);
    const range = s.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)/);
    if (range) {
      return { min: parseInt(range[1]), max: parseInt(range[2]) };
    }
    const single = s.match(/(\d+)/);
    if (single) {
      return { min: parseInt(single[1]), max: null };
    }
    return { min: null, max: null };
  }

  // 6) parse ingredients — attempt to split "2 cups flour" into parts
  // Many recipe plugins (WPRM, Tasty, Mediavine) strip section headers from
  // the JSON-LD recipeIngredient array but keep them in the HTML. We scrape
  // the DOM to recover group names and interleave them as § dividers.

  // ── HTML-based ingredient group extraction ──
  // Returns an ordered list: group headers as { divider: "Section Name" }
  // and ingredient text as { text: "2 cups flour" }.
  function extractIngredientGroupsFromHtml(
    pageHtml: string
  ): { divider?: string; text?: string }[] | null {
    // WPRM: <div class="wprm-recipe-ingredient-group">
    //          <h4 class="wprm-recipe-group-name">Marinade</h4>
    //          <ul class="wprm-recipe-ingredients"><li>...</li></ul>
    //        </div>
    // Tasty: <div class="tasty-recipe-ingredients">
    //          <div class="tasty-recipe-ingredient-group"><p>Marinade</p><ul>...</ul></div>
    // Mediavine: <div class="mv-create-ingredients">
    //              <h4>Marinade</h4><ul>...</ul>

    const results: { divider?: string; text?: string }[] = [];
    let found = false;

    // WPRM pattern
    const wprmGroupRe =
      /<div[^>]*class="[^"]*wprm-recipe-ingredient-group[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*wprm-recipe-ingredient-group|<div[^>]*class="[^"]*wprm-recipe-instruction|$)/gi;
    const wprmHeaderRe =
      /<[^>]*class="[^"]*wprm-recipe-group-name[^"]*"[^>]*>([\s\S]*?)<\//i;
    const wprmItemRe =
      /<li[^>]*class="[^"]*wprm-recipe-ingredient\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

    let gm;
    while ((gm = wprmGroupRe.exec(pageHtml)) !== null) {
      found = true;
      const groupHtml = gm[1];
      const headerMatch = wprmHeaderRe.exec(groupHtml);
      if (headerMatch) {
        const name = headerMatch[1].replace(/<[^>]+>/g, "").trim();
        if (name) results.push({ divider: name });
      }
      let im;
      while ((im = wprmItemRe.exec(groupHtml)) !== null) {
        const text = decodeHtml(im[1].replace(/<[^>]+>/g, ""))
          .replace(/[\u25a2\u2610\u2611\u2612\u2713\u2714]/g, "") // strip checkbox chars
          .replace(/\s+/g, " ")
          .trim();
        if (text) results.push({ text });
      }
    }

    return found ? results : null;
  }

  // ── Build ingredient list: prefer HTML groups (has dividers), fall back to JSON-LD ──
  const rawIngredients: string[] = Array.isArray(schema.recipeIngredient)
    ? schema.recipeIngredient.map(String)
    : [];

  let ingredients: ParsedIngredient[];

  const htmlGroups = extractIngredientGroupsFromHtml(html);
  if (htmlGroups && htmlGroups.length > 0) {
    // HTML groups found — use them (they include section dividers)
    ingredients = htmlGroups.map((entry) => {
      if (entry.divider) {
        return { quantity: null, quantity_max: null, unit: "§", name: entry.divider };
      }
      return parseIngredientLine(entry.text!);
    });
  } else {
    // Fall back to JSON-LD with heuristic header detection
    ingredients = rawIngredients.map((str) => {
      // Section header heuristic: no numbers, under 60 chars
      if (!hasNumber(str) && str.length <= 60) {
        const lower = str.toLowerCase().trim();
        const isFreeformIngredient =
          /\b(to taste|as needed|for (garnish|serving|topping)|pinch|optional|a few|some|fresh|dried)\b/.test(lower);
        if (!isFreeformIngredient) {
          return { quantity: null, quantity_max: null, unit: "§", name: str.trim() };
        }
      }
      return parseIngredientLine(str);
    });
  }

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
  const bake = extractBakeFromSteps(steps);

  // Apply stripEmoji to user-visible text fields (decorative emojis
  // sneak in via Instagram captions and some recipe blogs). Numeric
  // fields are untouched.
  const notes = extractNotes(schema, html);
  const yields = parseServings(schema.recipeYield);
  const prepDur = parseDuration(schema.prepTime);
  const cookDur = parseDuration(schema.cookTime);
  return NextResponse.json({
    title: titleCaseFromAllCaps(stripEmoji(decodeHtml(String(schema.name ?? "")))),
    description: stripEmoji(decodeHtml(String(schema.description ?? ""))),
    servings: yields.min,
    servings_max: yields.max,
    prep_time_minutes: prepDur.min,
    prep_time_minutes_max: prepDur.max,
    cook_time_minutes: cookDur.min,
    cook_time_minutes_max: cookDur.max,
    ...bake,
    notes: notes ? stripEmoji(notes) : null,
    images: allImages,
    ingredients: ingredients.map((i) => ({
      ...i,
      name: stripEmoji(decodeHtml(i.name)),
      unit: i.unit ? decodeHtml(i.unit) : i.unit,
    })),
    steps: steps.map((s) => stripEmoji(decodeHtml(String(s)))),
  });
}


