import type { TagCategory } from "@/lib/types/database";

/** Human-readable labels for tag categories. */
export const categoryLabels: Record<TagCategory, string> = {
  meal_type: "Meal Type",
  season: "Season",
  cuisine: "Cuisine",
  dietary: "Dietary",
  method: "Method",
  occasion: "Occasion",
  ingredient: "Ingredient",
  dish_type: "Dish Type",
  baked_goods: "Baked Goods",
  custom: "Custom",
};

/**
 * Display order for tag categories.
 * Used by the form quick-tags, overlay accordion, and browse page.
 */
export const categoryOrder: TagCategory[] = [
  "meal_type",
  "cuisine",
  "dish_type",
  "occasion",
  "dietary",
  "ingredient",
  "method",
  "baked_goods",
  "season",
  "custom",
];

/**
 * Tags to show in the quick-tags row on create/edit form.
 * Maps category → list of tag names to include (trimmed set).
 * Categories not listed here are overlay-only.
 */
export const quickTagCategories: Record<string, string[] | null> = {
  meal_type: ["Dinner", "Lunch", "Desserts", "Appetizers"],
  occasion: ["Weeknight", "Meal Prep", "Easy Crew Meals"],
  dietary: ["Vegetarian", "Gluten-Free", "Dairy-Free"],
  season: null, // show all 4
};

/**
 * Specificity ranking for collapsing tags on the detail page.
 * Lower number = more specific = shown first.
 */
export const categorySpecificity: Record<TagCategory, number> = {
  cuisine: 0,
  method: 1,
  dietary: 2,
  dish_type: 3,
  ingredient: 4,
  baked_goods: 5,
  occasion: 6,
  season: 7,
  meal_type: 8,
  custom: 9,
};
