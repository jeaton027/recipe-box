export type Recipe = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  servings: number | null;
  servings_type: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  notes: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  gallery_images: string[] | null;
  bake_time: number | null;
  bake_time_max: number | null;
  bake_time_unit: string | null;
  bake_temp: number | null;
  bake_temp_max: number | null;
  bake_temp_unit: string | null;
  is_image_only: boolean;
  family_id: string | null;
  variant_label: string | null;
  created_at: string;
  updated_at: string;
};

export type Ingredient = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  quantity_max: number | null;
  unit: string | null;
  sort_order: number;
};

export type Step = {
  id: string;
  recipe_id: string;
  instruction: string;
  image_url: string | null;
  sort_order: number;
};

export type RecipeImage = {
  id: string;
  recipe_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
};

export type TagCategory =
  | "meal_type"
  | "season"
  | "cuisine"
  | "dietary"
  | "method"
  | "occasion"
  | "custom";

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  category: TagCategory;
};

export type RecipeTag = {
  recipe_id: string;
  tag_id: string;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
};

export type CollectionRecipe = {
  collection_id: string;
  recipe_id: string;
  sort_order: number;
};

// Composite types for queries
export type RecipeWithDetails = Recipe & {
  ingredients: Ingredient[];
  steps: Step[];
  images: RecipeImage[];
  tags: Tag[];
};

export type RecipeFormData = {
  title: string;
  description?: string;
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  notes?: string;
  source_url?: string;
  is_image_only?: boolean;
  ingredients: Omit<Ingredient, "id" | "recipe_id">[];
  steps: Omit<Step, "id" | "recipe_id">[];
  tag_ids: string[];
};
