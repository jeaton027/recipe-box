// fetches and parses
import { NextRequest, NextResponse } from "next/server";

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
    // match: optional number/fraction, optional unit word, rest is name
    const m = str.match(
      /^([\d.\s\/⅛¼⅓⅜½⅝⅔¾⅞]+)\s+([a-zA-Z]+\.?)\s+(.+)$/
    );
    if (m) {
      return { quantity: m[1].trim() || null, unit: m[2], name: m[3] };
    }
    // backup: whole string as name
    return { quantity: null, unit: null, name: str };
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

  return NextResponse.json({
    title: decodeHtml(String(schema.name ?? "")),
    description: decodeHtml(String(schema.description ?? "")),
    servings: parseServings(schema.recipeYield),
    prep_time_minutes: parseDuration(schema.prepTime),
    cook_time_minutes: parseDuration(schema.cookTime),
    images: allImages,
    ingredients: ingredients.map((i) => ({ ...i, name: decodeHtml(i.name), unit: i.unit ? decodeHtml(i.unit) : i.unit })),
    steps: steps.map((s) => decodeHtml(String(s))),
  });
}


