/**
 * Shape of payloads passed via sessionStorage between "I have a recipe to
 * pre-fill the form with" pages and `RecipeForm`. There are two distinct
 * variants because the producers differ in what they have on hand:
 *
 *   • ImportedRecipePayload — produced by /api/import-recipe (URL scrape)
 *     and /api/parse-recipe-text (pasted text / Instagram caption). The
 *     parsers return ingredients as *string* quantities (since they're
 *     reading "1 1/2 cups", "200-250g", etc.) and steps as plain strings.
 *
 *   • VariationRecipePayload — produced by ManageVariationsOverlay's
 *     "Create a copy" flow. It clones an existing DB recipe, so it
 *     carries DB row shapes — ingredients with *numeric* quantities and
 *     steps as `{ instruction }` rows — plus extras the parsers can't
 *     produce (tag_ids, thumbnail_url, gallery_images).
 *
 * RecipeForm's import/variation effects branch on `?source=` and read the
 * matching shape, so divergent fields like `ingredients` are safe.
 *
 * Tightening these types caught real drift the loose `Record<string, any>`
 * never would (e.g. the bake_*_unit string vs. literal-union mismatch).
 */

/** Fields shared across both handoff variants. */
export type RecipeHandoffMeta = {
  title?: string;
  description?: string | null;
  servings?: number | null;
  servings_max?: number | null;
  servings_type?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  bake_time?: number | null;
  bake_time_max?: number | null;
  bake_time_unit?: "min" | "hr" | null;
  bake_temp?: number | null;
  bake_temp_max?: number | null;
  bake_temp_unit?: "F" | "C" | null;
  notes?: string | null;
  source_url?: string | null;
  /**
   * If set, the form will lazily assign `family_id` to the source recipe
   * on save — links a freshly-imported variation back to its sibling.
   */
  _variationSourceId?: string;
};

/** Parser-shaped ingredient: quantities arrive as raw strings (with fractions). */
export type ImportedIngredient = {
  quantity: string | null;
  quantity_max: string | null;
  unit: string | null;
  name: string;
};

/** DB-row-shaped ingredient: quantities are numeric. */
export type VariationIngredient = {
  quantity: number | null;
  quantity_max: number | null;
  unit: string | null;
  name: string;
};

/** DB-row-shaped step. RecipeForm only reads `instruction`, but the row has more fields in practice. */
export type VariationStep = {
  instruction: string;
};

export type ImportedRecipePayload = RecipeHandoffMeta & {
  ingredients?: ImportedIngredient[];
  steps?: string[];
  images?: string[];
};

export type VariationRecipePayload = RecipeHandoffMeta & {
  ingredients?: VariationIngredient[];
  steps?: VariationStep[];
  tag_ids?: string[];
  thumbnail_url?: string | null;
  gallery_images?: string[] | null;
  is_image_only?: boolean | null;
};
