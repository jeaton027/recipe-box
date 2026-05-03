/**
 * Strip emoji and emoji-related codepoints from a string. Used to scrub
 * decorative emojis from parsed recipe text — common in Instagram
 * captions ("BEST cookies"), and occasionally in scraped HTML titles or
 * descriptions.
 *
 * Covered:
 *   - Pictographic emoji (faces, food, hearts, weather, etc.)
 *   - Skin tone modifiers (U+1F3FB through U+1F3FF)
 *   - Regional indicator letters used to form country flags
 *     (U+1F1E6 through U+1F1FF)
 *   - Zero-width joiner (U+200D) used in compound emoji
 *   - Variation selectors (U+FE0E, U+FE0F)
 *   - Tag characters (U+E0020 through U+E007F) used in subdivision flags
 *
 * Deliberately NOT stripped:
 *   - Digits, ASCII punctuation — these have `Emoji=Yes` in Unicode but
 *     we obviously want them in recipes (e.g. "1/2 cup", "350").
 *   - Vulgar fractions (1/8, 1/4, 1/2, ...) — these aren't classified
 *     as Extended_Pictographic so they survive naturally.
 *
 * Whitespace left behind by stripped emojis is collapsed into single
 * spaces and the result is trimmed, so a string of decorative emojis
 * doesn't leave a trail of double-spaces.
 */
const EMOJI_PATTERN = new RegExp(
  [
    "\\p{Extended_Pictographic}",
    "[\\u{1F1E6}-\\u{1F1FF}]", // regional indicators (flags)
    "[\\u{1F3FB}-\\u{1F3FF}]", // skin tone modifiers
    "\\u200D", // zero-width joiner
    "\\uFE0E", // variation selector text
    "\\uFE0F", // variation selector emoji
    "[\\u{E0020}-\\u{E007F}]", // tag characters (subdivision flags)
  ].join("|"),
  "gu"
);

export function stripEmoji(s: string): string {
  return s.replace(EMOJI_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Decode HTML entities in a string. Used wherever recipe text is pulled
 * out of raw HTML (notes scraped from plugin containers, fallback title
 * extraction, etc.). JSON-LD content is usually pre-decoded by the
 * site's CMS but raw-HTML paths are not — and previously this function
 * only handled 7 entities, which is why scraped notes were rendering
 * "&mdash;" / "&rsquo;" / "&frac12;" verbatim.
 *
 * Strategy: one regex pass for named entities (lookup map), one for
 * decimal numeric refs, one for hex numeric refs. `&amp;` is included
 * in the map and will be matched in that single pass — which means a
 * doubly-encoded "&amp;mdash;" decodes to "&mdash;" (literal), matching
 * browser behavior. We don't recursively decode.
 */
const NAMED_ENTITIES: Record<string, string> = {
  // Core
  quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", amp: "&",
  // Dashes / hyphens
  mdash: "—", ndash: "–", hyphen: "-", minus: "−",
  // Smart quotes
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  sbquo: "‚", bdquo: "„",
  laquo: "«", raquo: "»", lsaquo: "‹", rsaquo: "›",
  // Punctuation
  hellip: "…", prime: "′", Prime: "″", bull: "•", middot: "·",
  sect: "§", para: "¶", dagger: "†", Dagger: "‡",
  // Fractions (the ones recipes actually use)
  frac12: "½", frac13: "⅓", frac14: "¼", frac15: "⅕", frac16: "⅙", frac18: "⅛",
  frac23: "⅔", frac25: "⅖", frac34: "¾", frac35: "⅗", frac38: "⅜",
  frac45: "⅘", frac56: "⅚", frac58: "⅝", frac67: "⅗", frac78: "⅞",
  // Math / measurement
  deg: "°", times: "×", divide: "÷", plusmn: "±",
  le: "≤", ge: "≥", ne: "≠", asymp: "≈", infin: "∞",
  micro: "µ", sup1: "¹", sup2: "²", sup3: "³",
  // Currency
  cent: "¢", pound: "£", yen: "¥", euro: "€",
  // Marks
  copy: "©", reg: "®", trade: "™",
  // Lowercase diacritics
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  iacute: "í", igrave: "ì", icirc: "î", iuml: "ï",
  ntilde: "ñ",
  oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü",
  ccedil: "ç", szlig: "ß", yacute: "ý", yuml: "ÿ",
  // Capital diacritics
  Aacute: "Á", Agrave: "À", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ",
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Euml: "Ë",
  Iacute: "Í", Igrave: "Ì", Icirc: "Î", Iuml: "Ï",
  Ntilde: "Ñ",
  Oacute: "Ó", Ograve: "Ò", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Uacute: "Ú", Ugrave: "Ù", Ucirc: "Û", Uuml: "Ü",
  Ccedil: "Ç", Yacute: "Ý",
  // Invisible / formatting (collapse to empty or space)
  shy: "", zwj: "", zwnj: "", ensp: " ", emsp: " ", thinsp: " ",
};

/**
 * If a title arrives in all caps ("TURMERIC TOFU KEBABS"), convert it to
 * title case where every whitespace-separated word starts with a capital
 * letter ("Turmeric Tofu Kebabs"). Filler words like "with" / "of" /
 * "the" are intentionally capitalized too — this is a "first letter of
 * each word" convention, not English-style title case (which lowercases
 * articles and short prepositions).
 *
 * Mixed-case titles are left untouched. We detect "all caps" by the
 * absence of any Unicode lowercase letter — so "ÉCLAIRS DE PARIS"
 * triggers, but "Lemon Garlic Parm Sprouts!" doesn't.
 *
 * Edge behavior:
 *   - "MOM'S COOKIES"        → "Mom's Cookies"   (apostrophe-s stays lower)
 *   - "BLT-STYLE TACOS"      → "Blt-style Tacos" (hyphenated word treated whole)
 *   - "BEST 5-INGREDIENT"    → "Best 5-ingredient"
 *   - "I LOVE COOKIES"       → "I Love Cookies"
 *   - "Already Title Case"   → unchanged
 *   - ""                     → unchanged
 */
export function titleCaseFromAllCaps(s: string): string {
  if (!s) return s;
  // Any lowercase letter (Unicode-aware) means it's not "all caps".
  if (/\p{Ll}/u.test(s)) return s;
  // Need at least one letter to bother transforming.
  if (!/\p{L}/u.test(s)) return s;
  return s
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, ws, c) => ws + c.toUpperCase());
}

export function decodeHtml(str: string): string {
  return str
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    });
}
