"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter , useSearchParams} from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  consumeImportedRecipe,
  consumeVariationRecipe,
} from "@/lib/storage/recipe-handoff";
import ImagePicker from "@/components/recipes/ImagePicker";
import { generateUniqueSlug } from "@/lib/utils/slug";
import type { OriginalSnapshot, RecipeWithDetails, Tag, TagCategory } from "@/lib/types/database";
import { categoryLabels, quickTagCategories, categoryOrder } from "@/lib/utils/tag-helpers";
import { compressImage } from "@/lib/utils/compress-image";
import { parseFraction, formatQtyForInput } from "@/lib/utils/format-quantity";
import TagPickerOverlay from "@/components/recipes/TagPickerOverlay";
import OverlayShell from "@/components/shared/OverlayShell";

// § is used as a divider marker in the DB (unit field for ingredients, instruction prefix for steps)
const DIVIDER_MARKER = "§";

type IngredientItem =
  | { kind: "ingredient"; name: string; quantity: string; quantityMax: string; showMax: boolean; unit: string }
  | { kind: "divider"; label: string };

type StepItem =
  | { kind: "step"; instruction: string }
  | { kind: "divider"; label: string };

// Client-side parsers for paste-and-parse feature
function parseIngredientText(text: string): IngredientItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: IngredientItem[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[•\-–—*▪▸►◦‣⁃▢☐□]\s*/, "");
    // Divider: "For the ..."
    if (/^For the .+/i.test(cleaned)) {
      items.push({ kind: "divider", label: cleaned.replace(/^For the /i, "").replace(/:$/, "") });
      continue;
    }
    // Divider: line ending with ":" and no leading numbers
    if (/^[^0-9⅛¼⅜½⅝¾⅞⅓⅔]+:$/.test(cleaned)) {
      items.push({ kind: "divider", label: cleaned.replace(/:$/, "").trim() });
      continue;
    }
    // Range qty + unit + name: "1-2 tsp sugar" or "1/4-1/2 C flour"
    const mr = cleaned.match(/^([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s+([a-zA-Z]+\.?)\s+(.+)$/);
    if (mr) { items.push({ kind: "ingredient", quantity: mr[1].trim(), quantityMax: mr[2].trim(), showMax: true, unit: mr[3], name: mr[4].trim() }); continue; }
    // Range qty + name (no unit): "1-2 eggs"
    const mr2 = cleaned.match(/^([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s+(.+)$/);
    if (mr2) { items.push({ kind: "ingredient", quantity: mr2[1].trim(), quantityMax: mr2[2].trim(), showMax: true, unit: "", name: mr2[3].trim() }); continue; }
    // Qty + unit + name
    const m = cleaned.match(/^([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s+([a-zA-Z]+\.?)\s+(.+)$/);
    if (m) { items.push({ kind: "ingredient", quantity: m[1].trim(), quantityMax: "", showMax: false, unit: m[2], name: m[3].trim() }); continue; }
    // Qty + name (no unit)
    const m2 = cleaned.match(/^([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s+(.+)$/);
    if (m2) { items.push({ kind: "ingredient", quantity: m2[1].trim(), quantityMax: "", showMax: false, unit: "", name: m2[2].trim() }); continue; }
    // Fallback: whole line as name
    items.push({ kind: "ingredient", quantity: "", quantityMax: "", showMax: false, unit: "", name: cleaned });
  }
  return items;
}

function parseStepText(text: string): StepItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: StepItem[] = [];
  for (const line of lines) {
    // Divider: "For the ..."
    if (/^For the .+/i.test(line)) {
      items.push({ kind: "divider", label: line.replace(/^For the /i, "").replace(/:$/, "") });
      continue;
    }
    // Divider: short line ending with ":"
    if (/^[^0-9]+:$/.test(line) && line.length < 50) {
      items.push({ kind: "divider", label: line.replace(/:$/, "").trim() });
      continue;
    }
    // Strip leading step numbers
    const cleaned = line.replace(/^(?:step\s*)?\d+[.):\s]\s*/i, "").trim();
    if (cleaned) items.push({ kind: "step", instruction: cleaned });
  }
  return items;
}

type RecipeFormProps = {
  recipe?: RecipeWithDetails;
  tags: Tag[];
};

const GripIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="4" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="5" cy="12" r="1.2" />
    <circle cx="11" cy="4" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="11" cy="12" r="1.2" />
  </svg>
);

const RemoveIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export default function RecipeForm({ recipe, tags }: RecipeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isEditing = !!recipe;

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [servings, setServings] = useState(recipe?.servings?.toString() ?? "");
  const [servingsMax, setServingsMax] = useState(recipe?.servings_max?.toString() ?? "");
  const [showServingsMax, setShowServingsMax] = useState(!!recipe?.servings_max);
  const [servingsType, setServingsType] = useState(recipe?.servings_type ?? "");
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes?.toString() ?? "");
  const [prepTimeMax, setPrepTimeMax] = useState(recipe?.prep_time_minutes_max?.toString() ?? "");
  const [showPrepTimeMax, setShowPrepTimeMax] = useState(!!recipe?.prep_time_minutes_max);
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes?.toString() ?? "");
  const [cookTimeMax, setCookTimeMax] = useState(recipe?.cook_time_minutes_max?.toString() ?? "");
  const [showCookTimeMax, setShowCookTimeMax] = useState(!!recipe?.cook_time_minutes_max);
  const [bakeTime, setBakeTime] = useState(recipe?.bake_time?.toString() ?? "");
  const [bakeTimeMax, setBakeTimeMax] = useState(recipe?.bake_time_max?.toString() ?? "");
  const [showBakeTimeMax, setShowBakeTimeMax] = useState(!!recipe?.bake_time_max);
  const [bakeTimeUnit, setBakeTimeUnit] = useState(recipe?.bake_time_unit ?? "min");
  const [bakeTemp, setBakeTemp] = useState(recipe?.bake_temp?.toString() ?? "");
  const [bakeTempMax, setBakeTempMax] = useState(recipe?.bake_temp_max?.toString() ?? "");
  const [showBakeTempMax, setShowBakeTempMax] = useState(!!recipe?.bake_temp_max);
  const [bakeTempUnit, setBakeTempUnit] = useState(recipe?.bake_temp_unit ?? "F");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [variantLabel, setVariantLabel] = useState(recipe?.variant_label ?? "");
  // If this is a new recipe being created as a variation, tracks the source
  // recipe's ID so we can lazily assign a family_id on first save.
  const [variationSourceId, setVariationSourceId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [isImageOnly, setIsImageOnly] = useState(
    recipe?.is_image_only ?? searchParams.get("imageOnly") === "true"
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(recipe?.thumbnail_url ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    recipe?.tags?.map((t) => t.id) ?? []
  );
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [frequentTagIds, setFrequentTagIds] = useState<string[]>([]);

  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    recipe?.ingredients?.map((i): IngredientItem =>
      i.unit === DIVIDER_MARKER
        ? { kind: "divider", label: i.name }
        : { kind: "ingredient", name: i.name, quantity: formatQtyForInput(i.quantity), quantityMax: formatQtyForInput(i.quantity_max), showMax: i.quantity_max !== null && i.quantity_max !== undefined, unit: i.unit ?? "" }
    ) ?? [{ kind: "ingredient", name: "", quantity: "", quantityMax: "", showMax: false, unit: "" }]
  );

  const [steps, setSteps] = useState<StepItem[]>(
    recipe?.steps?.map((s): StepItem =>
      s.instruction.startsWith(DIVIDER_MARKER)
        ? { kind: "divider", label: s.instruction.slice(1) }
        : { kind: "step", instruction: s.instruction }
    ) ?? [{ kind: "step", instruction: "" }]
  );

  // Paste-and-parse state
  const [showIngredientPaste, setShowIngredientPaste] = useState(false);
  const [showStepPaste, setShowStepPaste] = useState(false);
  const [ingredientPasteText, setIngredientPasteText] = useState("");
  const [stepPasteText, setStepPasteText] = useState("");

  const [importedImages, setImportedImages] = useState<string[]>(() => {
    if (!recipe) return [];
    const gallery = recipe.gallery_images ?? [];
    const thumb = recipe.thumbnail_url;
    if (thumb && !gallery.includes(thumb)) return [...gallery, thumb];
    return [...gallery];
  });
  const [galleryImages, setGalleryImages] = useState<string[]>(
    recipe?.gallery_images ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Original snapshot state — only relevant for new recipes. If the user clicks
  // "Lock as Original", we capture the form state at that moment into `lockedSnapshot`.
  // On save, we write `lockedSnapshot` if present, else serialize the final form state.
  // Once locked it cannot be unlocked; this is a one-time operation.
  const [lockedSnapshot, setLockedSnapshot] = useState<OriginalSnapshot | null>(null);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);

  const [dragIngredientIndex, setDragIngredientIndex] = useState<number | null>(null);
  const [dragIngredientOverIndex, setDragIngredientOverIndex] = useState<number | null>(null);
  const [dragStepIndex, setDragStepIndex] = useState<number | null>(null);
  const [dragStepOverIndex, setDragStepOverIndex] = useState<number | null>(null);
  const dragIngredientRef = useRef<number | null>(null);
  const dragIngredientOverRef = useRef<number | null>(null);
  const dragStepRef = useRef<number | null>(null);
  const dragStepOverRef = useRef<number | null>(null);

  // Refs for focusing the "max" input after a dash-split
  const servingsMaxRef = useRef<HTMLInputElement>(null);
  const prepTimeMaxRef = useRef<HTMLInputElement>(null);
  const cookTimeMaxRef = useRef<HTMLInputElement>(null);
  const bakeTimeMaxRef = useRef<HTMLInputElement>(null);
  const bakeTempMaxRef = useRef<HTMLInputElement>(null);
  // Dynamic refs for ingredient quantity max inputs
  const ingredientMaxRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Ghost line: shows where the last moved item came from
  const [ingredientGhostIndex, setIngredientGhostIndex] = useState<number | null>(null);
  const [ingredientGhostKey, setIngredientGhostKey] = useState(0);
  const [stepGhostIndex, setStepGhostIndex] = useState<number | null>(null);
  const [stepGhostKey, setStepGhostKey] = useState(0);

  // Fetch most-used tags for "Frequently Used" row
  useEffect(() => {
    let cancelled = false;
    async function fetchFrequent() {
      const { data } = await supabase
        .from("recipe_tags")
        .select("tag_id");
      if (cancelled || !data) return;
      // Count occurrences
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
      }
      // Sort by count descending, take top 10
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);
      setFrequentTagIds(top);
    }
    fetchFrequent();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (ingredientGhostIndex === null) return;
    const timer = setTimeout(() => setIngredientGhostIndex(null), 15000);
    return () => clearTimeout(timer);
  }, [ingredientGhostIndex, ingredientGhostKey]);

  useEffect(() => {
    if (stepGhostIndex === null) return;
    const timer = setTimeout(() => setStepGhostIndex(null), 15000);
    return () => clearTimeout(timer);
  }, [stepGhostIndex, stepGhostKey]);

  useEffect(() => {
    if (searchParams.get("source") === "import") {
      const data = consumeImportedRecipe();
      if (data) {
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setServings(data.servings?.toString() ?? "");
        if (data.servings_max) { setServingsMax(data.servings_max.toString()); setShowServingsMax(true); }
        setPrepTime(data.prep_time_minutes?.toString() ?? "");
        if (data.prep_time_minutes_max) { setPrepTimeMax(data.prep_time_minutes_max.toString()); setShowPrepTimeMax(true); }
        setCookTime(data.cook_time_minutes?.toString() ?? "");
        if (data.cook_time_minutes_max) { setCookTimeMax(data.cook_time_minutes_max.toString()); setShowCookTimeMax(true); }
        if (data.bake_time) setBakeTime(data.bake_time.toString());
        if (data.bake_time_max) { setBakeTimeMax(data.bake_time_max.toString()); setShowBakeTimeMax(true); }
        if (data.bake_time_unit) setBakeTimeUnit(data.bake_time_unit);
        if (data.bake_temp) setBakeTemp(data.bake_temp.toString());
        if (data.bake_temp_max) { setBakeTempMax(data.bake_temp_max.toString()); setShowBakeTempMax(true); }
        if (data.bake_temp_unit) setBakeTempUnit(data.bake_temp_unit);
        setIngredients(
          data.ingredients?.map((i): IngredientItem =>
            i.unit === DIVIDER_MARKER
              ? { kind: "divider", label: i.name }
              : { kind: "ingredient", name: i.name, quantity: i.quantity ?? "", quantityMax: i.quantity_max ?? "", showMax: !!i.quantity_max, unit: i.unit ?? "" }
          ) ?? [{ kind: "ingredient", name: "", quantity: "", quantityMax: "", showMax: false, unit: "" }]
        );
        setSteps(
          data.steps?.map((s): StepItem =>
            s.startsWith(DIVIDER_MARKER)
              ? { kind: "divider", label: s.slice(1) }
              : { kind: "step", instruction: s }
          ) ?? [{ kind: "step", instruction: "" }]
        );
        if (data.notes) setNotes(data.notes);
        setSourceUrl(data.source_url ?? "");
        if (data.images?.length) {
          setImportedImages(data.images);
          setGalleryImages([data.images[0]]);
          setThumbnailUrl(data.images[0]);
        }
        // If this import was triggered from the + Variation split button,
        // the source recipe ID is embedded so the family link is created
        // when the user saves (same lazy family_id logic as "create by copy").
        if (data._variationSourceId) setVariationSourceId(data._variationSourceId);
      }
    } else if (searchParams.get("source") === "variation") {
      // Loading a variation draft — no DB writes have occurred yet. The
      // source recipe's data was placed in sessionStorage by
      // ManageVariationsOverlay's "Create a copy" action. We materialize
      // everything into form state, and only commit to the DB when the
      // user clicks Save.
      const data = consumeVariationRecipe();
      if (data) {
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setServings(data.servings?.toString() ?? "");
        if (data.servings_max) { setServingsMax(data.servings_max.toString()); setShowServingsMax(true); }
        setServingsType(data.servings_type ?? "");
        setPrepTime(data.prep_time_minutes?.toString() ?? "");
        if (data.prep_time_minutes_max) { setPrepTimeMax(data.prep_time_minutes_max.toString()); setShowPrepTimeMax(true); }
        setCookTime(data.cook_time_minutes?.toString() ?? "");
        if (data.cook_time_minutes_max) { setCookTimeMax(data.cook_time_minutes_max.toString()); setShowCookTimeMax(true); }
        if (data.bake_time) setBakeTime(data.bake_time.toString());
        if (data.bake_time_max) { setBakeTimeMax(data.bake_time_max.toString()); setShowBakeTimeMax(true); }
        if (data.bake_time_unit) setBakeTimeUnit(data.bake_time_unit);
        if (data.bake_temp) setBakeTemp(data.bake_temp.toString());
        if (data.bake_temp_max) { setBakeTempMax(data.bake_temp_max.toString()); setShowBakeTempMax(true); }
        if (data.bake_temp_unit) setBakeTempUnit(data.bake_temp_unit);
        if (data.notes) setNotes(data.notes);
        setSourceUrl(data.source_url ?? "");
        setIsImageOnly(!!data.is_image_only);
        // Ingredients arrive in DB shape: { name, quantity, quantity_max, unit, sort_order }
        setIngredients(
          data.ingredients?.length
            ? data.ingredients.map((i): IngredientItem =>
                i.unit === DIVIDER_MARKER
                  ? { kind: "divider", label: i.name }
                  : { kind: "ingredient", name: i.name, quantity: formatQtyForInput(i.quantity), quantityMax: formatQtyForInput(i.quantity_max), showMax: i.quantity_max !== null && i.quantity_max !== undefined, unit: i.unit ?? "" }
              )
            : [{ kind: "ingredient", name: "", quantity: "", quantityMax: "", showMax: false, unit: "" }]
        );
        // Steps arrive in DB shape: { instruction, sort_order }
        setSteps(
          data.steps?.length
            ? data.steps.map((s): StepItem =>
                s.instruction.startsWith(DIVIDER_MARKER)
                  ? { kind: "divider", label: s.instruction.slice(1) }
                  : { kind: "step", instruction: s.instruction }
              )
            : [{ kind: "step", instruction: "" }]
        );
        if (data.tag_ids?.length) setSelectedTagIds(data.tag_ids);
        // Images
        if (data.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
        if (data.gallery_images?.length) {
          setGalleryImages(data.gallery_images);
          const thumb = data.thumbnail_url;
          const allImages = thumb && !data.gallery_images.includes(thumb)
            ? [...data.gallery_images, thumb]
            : [...data.gallery_images];
          setImportedImages(allImages);
        } else if (data.thumbnail_url) {
          setImportedImages([data.thumbnail_url]);
        }
        // Remember the source recipe so we can lazily assign family_id on save
        if (data._variationSourceId) setVariationSourceId(data._variationSourceId);
      }
    }
  }, []);

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  // categoryLabels imported from tag-helpers

  function toggleTag(tagId: string) {
    const scrollY = window.scrollY;
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }

  // ── Dash-split handler for range inputs ─────────────────────────────────────
  // When user types a dash in a single-value input, split into min/max fields
  // and focus the max input. Works for servings, bake time, bake temp.
  function handleDashSplit(
    value: string,
    setMin: (v: string) => void,
    setMax: (v: string) => void,
    setShow: (v: boolean) => void,
    maxRef: React.RefObject<HTMLInputElement | null>,
    isShowing: boolean,
  ) {
    if (!isShowing) {
      const match = value.match(/^(.+?)\s*[-–]\s*(.*)$/);
      if (match) {
        setMin(match[1].trim());
        setMax(match[2].trim());
        setShow(true);
        requestAnimationFrame(() => maxRef.current?.focus());
        return;
      }
    }
    setMin(value);
  }

  // ── Ingredients ─────────────────────────────────────────────────────────────
  function addIngredient() {
    setIngredients((prev) => [...prev, { kind: "ingredient", name: "", quantity: "", quantityMax: "", showMax: false, unit: "" }]);
  }

  function addIngredientDivider() {
    setIngredients((prev) => [...prev, { kind: "divider", label: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIngredientField(index: number, field: "name" | "quantity" | "quantityMax" | "unit", value: string) {
    setIngredients((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item.kind !== "ingredient") return updated;

      // Auto-split dash pattern in quantity field: "1-2" or "1/4-1/2"
      if (field === "quantity" && !item.showMax) {
        const rangeMatch = value.match(/^(.+?)\s*(?:[-–])\s*(.*)$/);
        if (rangeMatch) {
          updated[index] = { ...item, quantity: rangeMatch[1].trim(), quantityMax: rangeMatch[2].trim(), showMax: true };
          requestAnimationFrame(() => ingredientMaxRefs.current.get(index)?.focus());
          return updated;
        }
      }

      updated[index] = { ...item, [field]: value };
      return updated;
    });
  }

  function updateDividerLabel(index: number, value: string, list: "ingredient" | "step") {
    if (list === "ingredient") {
      setIngredients((prev) => {
        const updated = [...prev];
        const item = updated[index];
        if (item.kind === "divider") updated[index] = { ...item, label: value };
        return updated;
      });
    } else {
      setSteps((prev) => {
        const updated = [...prev];
        const item = updated[index];
        if (item.kind === "divider") updated[index] = { ...item, label: value };
        return updated;
      });
    }
  }

  function moveIngredient(from: number, to: number) {
    // Show ghost at the previous position
    setIngredientGhostIndex(from < to ? from : from + 1);
    setIngredientGhostKey((k) => k + 1);

    setIngredients((prev) => {
      const updated = [...prev];
      const [item] = updated.splice(from, 1);
      updated.splice(from < to ? to - 1 : to, 0, item);
      return updated;
    });
  }

  // ── Steps ───────────────────────────────────────────────────────────────────
  function addStep() {
    setSteps((prev) => [...prev, { kind: "step", instruction: "" }]);
  }

  function addStepDivider() {
    setSteps((prev) => [...prev, { kind: "divider", label: "" }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item.kind === "step") updated[index] = { kind: "step", instruction: value };
      return updated;
    });
  }

  function moveStep(from: number, to: number) {
    // Show ghost at the previous position
    setStepGhostIndex(from < to ? from : from + 1);
    setStepGhostKey((k) => k + 1);

    setSteps((prev) => {
      const updated = [...prev];
      const [item] = updated.splice(from, 1);
      updated.splice(from < to ? to - 1 : to, 0, item);
      return updated;
    });
  }

  // ── Image upload ─────────────────────────────────────────────────────────────
  async function handleImageUpload(file: File): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const compressed = await compressImage(file);
    const fileExt = compressed.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("recipe-images").upload(filePath, compressed);
    if (error) { console.error("Upload error:", error); return; }
    const { data: { publicUrl } } = supabase.storage.from("recipe-images").getPublicUrl(filePath);
    setImportedImages((prev) => [...prev, publicUrl]);
    setGalleryImages((prev) => [...prev, publicUrl]);
    setThumbnailUrl((prev) => prev || publicUrl);
  }

  // ── Original snapshot helpers ────────────────────────────────────────────────

  // Serialize the current form state into an immutable OriginalSnapshot.
  // Called either when the user clicks "Lock as Original" or (as a fallback)
  // at save time if they never did.
  function buildSnapshot(): OriginalSnapshot {
    const source: OriginalSnapshot["source"] =
      searchParams.get("source") === "import"
        ? "url_import"
        : searchParams.get("source") === "variation"
        ? "variation_copy"
        : "manual";

    const snapIngredients: OriginalSnapshot["ingredients"] = ingredients
      .map((item, idx) => {
        if (item.kind === "divider") {
          return {
            name: item.label || " ",
            quantity: null,
            quantity_max: null,
            unit: DIVIDER_MARKER,
            sort_order: idx,
          };
        }
        if (!item.name.trim()) return null;
        return {
          name: item.name.trim(),
          quantity: parseFraction(item.quantity),
          quantity_max: parseFraction(item.quantityMax),
          unit: item.unit.trim() || null,
          sort_order: idx,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const snapSteps: OriginalSnapshot["steps"] = steps
      .map((item, idx) => {
        if (item.kind === "divider") {
          return {
            instruction: DIVIDER_MARKER + (item.label || ""),
            sort_order: idx,
          };
        }
        if (!item.instruction.trim()) return null;
        return { instruction: item.instruction.trim(), sort_order: idx };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      captured_at: new Date().toISOString(),
      source,
      source_url: sourceUrl.trim() || null,
      title: title.trim(),
      description: description.trim() || null,
      servings: servings ? parseInt(servings) : null,
      servings_max: servingsMax ? parseInt(servingsMax) : null,
      servings_type: servingsType.trim() || null,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      prep_time_minutes_max: showPrepTimeMax && prepTimeMax ? parseInt(prepTimeMax) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      cook_time_minutes_max: showCookTimeMax && cookTimeMax ? parseInt(cookTimeMax) : null,
      notes: notes.trim() || null,
      ingredients: snapIngredients,
      steps: snapSteps,
    };
  }

  function handleConfirmLock() {
    setLockedSnapshot(buildSnapshot());
    setConfirmLockOpen(false);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!title.trim()) { setError("Title is required"); setSaving(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in"); setSaving(false); return; }

    // Generate slug (unique, updates on title change)
    const slug = await generateUniqueSlug(title.trim(), recipe?.id);

    // Resolve family_id:
    // - Editing an existing recipe → preserve its family_id
    // - New recipe from "+ Variation" → use the source's family_id, creating
    //   one lazily on the source if it doesn't have one yet
    // - Regular new recipe → no family_id
    let familyId: string | null = recipe?.family_id ?? null;
    if (!isEditing && variationSourceId) {
      const { data: sourceRow, error: srcErr } = await supabase
        .from("recipes")
        .select("family_id")
        .eq("id", variationSourceId)
        .single();
      if (srcErr || !sourceRow) {
        setError("Couldn't find source recipe for variation");
        setSaving(false);
        return;
      }
      if (sourceRow.family_id) {
        familyId = sourceRow.family_id;
      } else {
        familyId = crypto.randomUUID();
        const { error: famErr } = await supabase
          .from("recipes")
          .update({ family_id: familyId })
          .eq("id", variationSourceId);
        if (famErr) {
          setError(famErr.message);
          setSaving(false);
          return;
        }
      }
    }

    const recipeData = {
      user_id: user.id,
      slug,
      title: title.trim(),
      description: description.trim() || null,
      servings: servings ? parseInt(servings) : null,
      servings_max: servingsMax ? parseInt(servingsMax) : null,
      servings_type: servingsType.trim() || null,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      prep_time_minutes_max: showPrepTimeMax && prepTimeMax ? parseInt(prepTimeMax) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      cook_time_minutes_max: showCookTimeMax && cookTimeMax ? parseInt(cookTimeMax) : null,
      bake_time: bakeTime ? parseInt(bakeTime) : null,
      bake_time_max: bakeTimeMax ? parseInt(bakeTimeMax) : null,
      bake_time_unit: bakeTime ? bakeTimeUnit : null,
      bake_temp: bakeTemp ? parseInt(bakeTemp) : null,
      bake_temp_max: bakeTempMax ? parseInt(bakeTempMax) : null,
      bake_temp_unit: bakeTemp ? bakeTempUnit : null,
      notes: notes.trim() || null,
      variant_label: variantLabel.trim() || null,
      source_url: sourceUrl.trim() || null,
      thumbnail_url: thumbnailUrl || galleryImages[0] || null,
      gallery_images: galleryImages.length > 0 ? galleryImages : null,
      is_image_only: isImageOnly,
      family_id: familyId,
    };

    let recipeId = recipe?.id;

    if (isEditing && recipeId) {
      const { error: updateError } = await supabase.from("recipes").update(recipeData).eq("id", recipeId);
      if (updateError) { setError(updateError.message); setSaving(false); return; }
      await Promise.all([
        supabase.from("ingredients").delete().eq("recipe_id", recipeId),
        supabase.from("steps").delete().eq("recipe_id", recipeId),
        supabase.from("recipe_tags").delete().eq("recipe_id", recipeId),
      ]);
    } else {
      // Attach the original snapshot. Use the user's locked snapshot if they
      // clicked "Lock as Original"; otherwise capture the current form state.
      // This write happens once, on initial insert — never updated afterwards.
      const snapshotToSave = lockedSnapshot ?? buildSnapshot();
      const { data, error: insertError } = await supabase
        .from("recipes")
        .insert({ ...recipeData, original_snapshot: snapshotToSave })
        .select("id")
        .single();
      if (insertError || !data) { setError(insertError?.message ?? "Failed to create recipe"); setSaving(false); return; }
      recipeId = data.id;
    }

    // Insert ingredients (dividers use unit=§, name=label)
    const ingredientsToSave = ingredients.filter((item) =>
      item.kind === "divider" ? item.label.trim() !== "" || true : (item as { name: string }).name.trim() !== ""
    );
    if (ingredientsToSave.length > 0) {
      await supabase.from("ingredients").insert(
        ingredientsToSave.map((item, idx) =>
          item.kind === "divider"
            ? { recipe_id: recipeId!, name: item.label || " ", quantity: null, quantity_max: null, unit: DIVIDER_MARKER, sort_order: idx }
            : { recipe_id: recipeId!, name: item.name.trim(), quantity: parseFraction(item.quantity), quantity_max: parseFraction(item.quantityMax), unit: item.unit.trim() || null, sort_order: idx }
        ).filter((_, idx) => {
          const item = ingredientsToSave[idx];
          return item.kind === "divider" || (item as { name: string }).name.trim() !== "";
        })
      );
    }

    // Insert steps (dividers use §+label as instruction)
    const stepsToSave = steps.filter((item) =>
      item.kind === "divider" ? true : (item as { instruction: string }).instruction.trim() !== ""
    );
    if (stepsToSave.length > 0) {
      await supabase.from("steps").insert(
        stepsToSave.map((item, idx) =>
          item.kind === "divider"
            ? { recipe_id: recipeId!, instruction: DIVIDER_MARKER + (item.label || ""), sort_order: idx }
            : { recipe_id: recipeId!, instruction: (item as { instruction: string }).instruction.trim(), sort_order: idx }
        )
      );
    }

    // Insert tags
    if (selectedTagIds.length > 0) {
      await supabase.from("recipe_tags").insert(
        selectedTagIds.map((tagId) => ({ recipe_id: recipeId!, tag_id: tagId }))
      );
    }

    router.push(`/recipes/${slug}`);
    router.refresh();
  }

  // ── Shared drag handlers ──────────────────────────────────────────────────────
  // Grip handle: initiates the drag
  function ingredientGripHandlers(i: number) {
    return {
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move"; dragIngredientRef.current = i; setDragIngredientIndex(i);
        dragIngredientOverRef.current = null; setIngredientGhostIndex(null);
      },
      onDragEnd: () => {
        dragIngredientRef.current = null; dragIngredientOverRef.current = null;
        setDragIngredientIndex(null); setDragIngredientOverIndex(null);
      },
    };
  }

  // Row: sets visual indicator on hover (no onDrop — container handles it)
  function ingredientDropHandlers(i: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault(); setDragIngredientOverIndex(i); dragIngredientOverRef.current = i;
      },
    };
  }

  // Container-level drop: always reads the ref so it matches the visual line
  function handleIngredientContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragIngredientRef.current;
    const to = dragIngredientOverRef.current;
    if (from !== null && to !== null && from !== to && from !== to - 1) {
      moveIngredient(from, to);
    }
    dragIngredientRef.current = null; dragIngredientOverRef.current = null;
    setDragIngredientIndex(null); setDragIngredientOverIndex(null);
  }

  function stepGripHandlers(i: number) {
    return {
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move"; dragStepRef.current = i; setDragStepIndex(i);
        dragStepOverRef.current = null; setStepGhostIndex(null);
      },
      onDragEnd: () => {
        dragStepRef.current = null; dragStepOverRef.current = null;
        setDragStepIndex(null); setDragStepOverIndex(null);
      },
    };
  }

  function stepDropHandlers(i: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault(); setDragStepOverIndex(i); dragStepOverRef.current = i;
      },
    };
  }

  function handleStepContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragStepRef.current;
    const to = dragStepOverRef.current;
    if (from !== null && to !== null && from !== to && from !== to - 1) {
      moveStep(from, to);
    }
    dragStepRef.current = null; dragStepOverRef.current = null;
    setDragStepIndex(null); setDragStepOverIndex(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Recipe name" />
      </div>

      {/* Variation label — only shown for recipes that are part of a family */}
      {(recipe?.family_id || variationSourceId || variantLabel) && (
        <div>
          <label htmlFor="variant_label" className="block text-sm font-medium">
            Variation label
          </label>
          <input id="variant_label" type="text" value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="e.g. GF, Pork, Chicken" />
          <p className="mt-1 text-xs text-muted">
            A short label to distinguish between variations.
          </p>
        </div>
      )}


      {/* Image-only mode is set via URL param ?imageOnly=true */}

      {/* Image picker */}
      <ImagePicker
        images={importedImages}
        galleryImages={galleryImages}
        thumbnailUrl={thumbnailUrl}
        onGalleryToggle={(url) => {
          const inGallery = galleryImages.includes(url);
          if (inGallery) {
            if (thumbnailUrl === url) setThumbnailUrl("");
            setGalleryImages((prev) => prev.filter((u) => u !== url));
          } else {
            setGalleryImages((prev) => [...prev, url]);
          }
        }}
        onThumbnailSelect={(url) => {
          if (thumbnailUrl === url) {
            setThumbnailUrl("");
          } else {
            setThumbnailUrl(url);
            if (!galleryImages.includes(url)) {
              setGalleryImages((prev) => [...prev, url]);
            }
          }
        }}
        onUpload={handleImageUpload}
        onRemove={(url) => {
          setImportedImages((prev) => prev.filter((u) => u !== url));
          setGalleryImages((prev) => prev.filter((u) => u !== url));
          if (thumbnailUrl === url) setThumbnailUrl("");
        }}
      />

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="A brief description" />
      </div>

      {/* Bake for / at */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Bake for:</span>
        <input
          type="text"
          value={bakeTime}
          onChange={(e) => handleDashSplit(e.target.value, setBakeTime, setBakeTimeMax, setShowBakeTimeMax, bakeTimeMaxRef, showBakeTimeMax)}
          placeholder="Time"
          className="w-14 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {showBakeTimeMax && (
          <>
            <span className="text-xs text-muted">–</span>
            <input
              type="text"
              ref={bakeTimeMaxRef}
              value={bakeTimeMax}
              onChange={(e) => setBakeTimeMax(e.target.value)}
              placeholder="Max"
              className="w-14 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </>
        )}
        <button
          type="button"
          onClick={() => setBakeTimeUnit(bakeTimeUnit === "min" ? "hr" : "min")}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent transition-colors"
        >
          {bakeTimeUnit}
        </button>
        <span className="text-sm font-medium ml-2">at</span>
        <input
          type="text"
          value={bakeTemp}
          onChange={(e) => handleDashSplit(e.target.value, setBakeTemp, setBakeTempMax, setShowBakeTempMax, bakeTempMaxRef, showBakeTempMax)}
          placeholder="Temp"
          className="w-16 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {showBakeTempMax && (
          <>
            <span className="text-xs text-muted">–</span>
            <input
              type="text"
              ref={bakeTempMaxRef}
              value={bakeTempMax}
              onChange={(e) => setBakeTempMax(e.target.value)}
              placeholder="Max"
              className="w-16 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </>
        )}
        <span className="text-sm">°</span>
        <button
          type="button"
          onClick={() => setBakeTempUnit(bakeTempUnit === "F" ? "C" : "F")}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent transition-colors"
        >
          {bakeTempUnit}
        </button>
        <button
          type="button"
          onClick={() => {
            const convert = bakeTempUnit === "F"
              ? (v: number) => Math.round((v - 32) * 5 / 9)
              : (v: number) => Math.round(v * 9 / 5 + 32);
            if (bakeTemp) setBakeTemp(convert(parseInt(bakeTemp)).toString());
            if (bakeTempMax) setBakeTempMax(convert(parseInt(bakeTempMax)).toString());
            setBakeTempUnit(bakeTempUnit === "F" ? "C" : "F");
          }}
          className="text-xs text-muted hover:font-semibold transition-all"
        >
          convert
        </button>
      </div>

      {/* Times & Servings */}
      <div className="grid grid-cols-3 gap-4">
        {/* Servings: count (+ optional max) + type */}
        <div>
          <label className="block text-sm font-medium">Servings</label>
          <div className="mt-1 flex items-center gap-1">
            <input
              id="servings"
              type="text"
              value={servings}
              onChange={(e) => handleDashSplit(e.target.value, setServings, setServingsMax, setShowServingsMax, servingsMaxRef, showServingsMax)}
              placeholder="#"
              className="w-14 shrink-0 rounded-md border border-border bg-white px-2 py-2 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {showServingsMax && (
              <>
                <span className="text-xs text-muted">–</span>
                <input
                  type="text"
                  ref={servingsMaxRef}
                  value={servingsMax}
                  onChange={(e) => setServingsMax(e.target.value)}
                  placeholder="Max"
                  className="w-14 shrink-0 rounded-md border border-border bg-white px-2 py-2 text-sm text-center focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </>
            )}
            <input
              type="text"
              value={servingsType}
              onChange={(e) => setServingsType(e.target.value)}
              placeholder="servings"
              className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
        {/* Prep / Cook — single input by default; typing "20-30" auto-splits
            into a min/max range and reveals the second input. Mirrors the
            mobile app's rangeRow / rangeInput / rangeDash pattern. */}
        {[
          {
            id: "prepTime",
            label: "Prep (min)",
            value: prepTime,
            setValue: setPrepTime,
            valueMax: prepTimeMax,
            setValueMax: setPrepTimeMax,
            showMax: showPrepTimeMax,
            setShowMax: setShowPrepTimeMax,
            maxRef: prepTimeMaxRef,
          },
          {
            id: "cookTime",
            label: "Cook (min)",
            value: cookTime,
            setValue: setCookTime,
            valueMax: cookTimeMax,
            setValueMax: setCookTimeMax,
            showMax: showCookTimeMax,
            setShowMax: setShowCookTimeMax,
            maxRef: cookTimeMaxRef,
          },
        ].map(({ id, label, value, setValue, valueMax, setValueMax, showMax, setShowMax, maxRef }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-sm font-medium">{label}</label>
            <div className="mt-1 flex items-center gap-1">
              <input
                id={id}
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => handleDashSplit(e.target.value, setValue, setValueMax, setShowMax, maxRef, showMax)}
                className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {showMax && (
                <>
                  <span className="text-xs text-muted">–</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    ref={maxRef}
                    value={valueMax}
                    onChange={(e) => setValueMax(e.target.value)}
                    onBlur={() => { if (!valueMax.trim()) setShowMax(false); }}
                    placeholder="Max"
                    className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Ingredients ── */}
      {!isImageOnly && (
        <fieldset>
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium">Ingredients</legend>
            <button type="button" onClick={() => { setShowIngredientPaste((v) => !v); setIngredientPasteText(""); }}
              className="text-xs text-muted hover:text-foreground">
              {showIngredientPaste ? "Cancel" : "Paste & Parse"}
            </button>
          </div>
          {showIngredientPaste && (
            <div className="mt-2 space-y-2">
              <textarea
                value={ingredientPasteText}
                onChange={(e) => setIngredientPasteText(e.target.value)}
                placeholder="Paste ingredients here — one per line"
                rows={5}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button type="button"
                disabled={!ingredientPasteText.trim()}
                onClick={() => {
                  const parsed = parseIngredientText(ingredientPasteText);
                  if (parsed.length > 0) setIngredients(parsed);
                  setShowIngredientPaste(false);
                  setIngredientPasteText("");
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark disabled:opacity-50">
                Parse Ingredients
              </button>
            </div>
          )}
          <div className="mt-2 space-y-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleIngredientContainerDrop}
          >
            {ingredients.map((item, i) => (
              <Fragment key={i}>
                {dragIngredientOverIndex === i && dragIngredientIndex !== null && dragIngredientIndex !== i && dragIngredientIndex !== i - 1 && (
                  <div className="h-0.5 rounded-full bg-accent" />
                )}
                {ingredientGhostIndex === i && dragIngredientIndex === null && (
                  <div className="h-0.5 rounded-full bg-accent/30 transition-opacity duration-500" />
                )}

                {item.kind === "divider" ? (
                  /* ── Ingredient divider row ── */
                  <div
                    {...ingredientDropHandlers(i)}
                    className={`relative mt-4 flex items-center gap-2 transition-opacity ${dragIngredientIndex === i ? "opacity-40" : ""}`}
                  >
                    {dragIngredientIndex !== null && dragIngredientIndex !== i && (
                      <div className="absolute inset-0 z-10" onDragOver={(e) => e.preventDefault()} />
                    )}
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateDividerLabel(i, e.target.value, "ingredient")}
                        placeholder="Section label"
                        className="w-36 border-0 bg-transparent text-sm font-semibold focus:outline-none"
                      />
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <button type="button" onClick={() => removeIngredient(i)} className="text-muted hover:text-red-500">
                      <RemoveIcon />
                    </button>
                    <span {...ingredientGripHandlers(i)} className="relative z-20 cursor-grab touch-none text-muted hover:text-foreground">
                      <GripIcon />
                    </span>
                  </div>
                ) : (
                  /* ── Regular ingredient row ── */
                  <div
                    {...ingredientDropHandlers(i)}
                    className={`relative flex items-center gap-2 transition-opacity ${dragIngredientIndex === i ? "opacity-40" : ""}`}
                  >
                    {dragIngredientIndex !== null && dragIngredientIndex !== i && (
                      <div className="absolute inset-0 z-10" onDragOver={(e) => e.preventDefault()} />
                    )}
                    <span {...ingredientGripHandlers(i)} className="relative z-20 -mr-1 sm:mr-0 cursor-grab touch-none text-muted hover:text-foreground">
                      <GripIcon />
                    </span>
                    {/* Fixed-width qty area so Unit always aligns */}
                    <div className="flex w-24 sm:w-40 shrink-0 items-center gap-0.5 sm:gap-1 justify-end">
                      {item.showMax ? (
                        <>
                          <input type="text" value={item.quantity}
                            onChange={(e) => updateIngredientField(i, "quantity", e.target.value)}
                            placeholder="Min"
                            className="w-10 sm:w-16 shrink-0 rounded-md border border-border bg-white px-1 sm:px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                          <span className="text-xs text-muted shrink-0">–</span>
                          <input type="text" value={item.quantityMax}
                            ref={(el) => { if (el) ingredientMaxRefs.current.set(i, el); else ingredientMaxRefs.current.delete(i); }}
                            onChange={(e) => updateIngredientField(i, "quantityMax", e.target.value)}
                            placeholder="Max"
                            className="w-10 sm:w-16 shrink-0 rounded-md border border-border bg-white px-1 sm:px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                        </>
                      ) : (
                        <input type="text" value={item.quantity}
                          onChange={(e) => updateIngredientField(i, "quantity", e.target.value)}
                          placeholder="Qty"
                          className="w-10 sm:w-16 shrink-0 rounded-md border border-border bg-white px-1 sm:px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ml-auto" />
                      )}
                    </div>
                    <input type="text" value={item.unit}
                      onChange={(e) => updateIngredientField(i, "unit", e.target.value)}
                      placeholder="Unit"
                      className="w-20 shrink-0 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                    <input type="text" value={item.name}
                      onChange={(e) => updateIngredientField(i, "name", e.target.value)}
                      placeholder="Ingredient name"
                      className="flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                    {ingredients.length > 1 && (
                      <button type="button" onClick={() => removeIngredient(i)} className="text-muted hover:text-red-500">
                        <RemoveIcon />
                      </button>
                    )}
                  </div>
                )}
              </Fragment>
            ))}

            {/* Bottom drop zone */}
            {dragIngredientIndex !== null && (
              <div className="h-4"
                onDragOver={(e) => {
                  e.preventDefault(); setDragIngredientOverIndex(ingredients.length); dragIngredientOverRef.current = ingredients.length;
                }}
              >
                {dragIngredientOverIndex === ingredients.length && dragIngredientIndex !== ingredients.length - 1 && <div className="h-0.5 rounded-full bg-accent" />}
              </div>
            )}
            {ingredientGhostIndex === ingredients.length && dragIngredientIndex === null && (
              <div className="h-0.5 rounded-full bg-accent/30 transition-opacity duration-500" />
            )}
          </div>

          {/* Bottom button row */}
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={addIngredient} className="text-sm font-medium text-accent hover:text-accent-dark">
              + Add ingredient
            </button>
            <button type="button" onClick={addIngredientDivider} className="text-sm font-medium text-accent hover:text-accent-dark">
              + Add ingredient label divider
            </button>
          </div>
        </fieldset>
      )}

      {/* ── Steps ── */}
      {!isImageOnly && (
        <fieldset>
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium">Steps</legend>
            <button type="button" onClick={() => { setShowStepPaste((v) => !v); setStepPasteText(""); }}
              className="text-xs text-muted hover:text-foreground">
              {showStepPaste ? "Cancel" : "Paste & Parse"}
            </button>
          </div>
          {showStepPaste && (
            <div className="mt-2 space-y-2">
              <textarea
                value={stepPasteText}
                onChange={(e) => setStepPasteText(e.target.value)}
                placeholder="Paste steps here — one per line or numbered"
                rows={5}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button type="button"
                disabled={!stepPasteText.trim()}
                onClick={() => {
                  const parsed = parseStepText(stepPasteText);
                  if (parsed.length > 0) setSteps(parsed);
                  setShowStepPaste(false);
                  setStepPasteText("");
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark disabled:opacity-50">
                Parse Steps
              </button>
            </div>
          )}
          <div className="mt-2 space-y-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleStepContainerDrop}
          >
            {(() => {
              let stepCount = 0;
              return steps.map((item, i) => {
                if (item.kind === "step") stepCount++;
                const stepNumber = stepCount;
                return (
                  <Fragment key={i}>
                    {dragStepOverIndex === i && dragStepIndex !== null && dragStepIndex !== i && dragStepIndex !== i - 1 && (
                      <div className="h-0.5 rounded-full bg-accent" />
                    )}
                    {stepGhostIndex === i && dragStepIndex === null && (
                      <div className="h-0.5 rounded-full bg-accent/30 transition-opacity duration-500" />
                    )}

                    {item.kind === "divider" ? (
                      /* ── Step divider row ── */
                      <div
                        {...stepDropHandlers(i)}
                        className={`relative mt-4 flex items-center gap-2 transition-opacity ${dragStepIndex === i ? "opacity-40" : ""}`}
                      >
                        {dragStepIndex !== null && dragStepIndex !== i && (
                          <div className="absolute inset-0 z-10" onDragOver={(e) => e.preventDefault()} />
                        )}
                        <div className="flex flex-1 items-center gap-2">
                          <div className="h-px flex-1 bg-border" />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateDividerLabel(i, e.target.value, "step")}
                            placeholder="Section label"
                            className="w-36 border-0 bg-transparent text-sm font-semibold focus:outline-none"
                          />
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <button type="button" onClick={() => removeStep(i)} className="text-muted hover:text-red-500">
                          <RemoveIcon />
                        </button>
                        <span {...stepGripHandlers(i)} className="relative z-20 cursor-grab touch-none text-muted hover:text-foreground">
                          <GripIcon />
                        </span>
                      </div>
                    ) : (
                      /* ── Regular step row ── */
                      <div
                        {...stepDropHandlers(i)}
                        className={`relative flex items-start gap-2 transition-opacity ${dragStepIndex === i ? "opacity-40" : ""}`}
                      >
                        {dragStepIndex !== null && dragStepIndex !== i && (
                          <div className="absolute inset-0 z-10" onDragOver={(e) => e.preventDefault()} />
                        )}
                        <span {...stepGripHandlers(i)} className="relative z-20 mt-2 cursor-grab touch-none text-muted hover:text-foreground">
                          <GripIcon />
                        </span>
                        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-medium text-accent-dark">
                          {stepNumber}
                        </span>
                        <textarea
                          value={item.instruction}
                          onChange={(e) => updateStep(i, e.target.value)}
                          placeholder={`Step ${stepNumber}`}
                          rows={1}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                          onInput={(e) => {
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }}
                          style={{ maxHeight: "19.5rem" }}
                          className="flex-1 resize-none overflow-y-auto rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                        {steps.length > 1 && (
                          <button type="button" onClick={() => removeStep(i)} className="mt-2 text-muted hover:text-red-500">
                            <RemoveIcon />
                          </button>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              });
            })()}

            {/* Bottom drop zone */}
            {dragStepIndex !== null && (
              <div className="h-4"
                onDragOver={(e) => {
                  e.preventDefault(); setDragStepOverIndex(steps.length); dragStepOverRef.current = steps.length;
                }}
              >
                {dragStepOverIndex === steps.length && dragStepIndex !== steps.length - 1 && <div className="h-0.5 rounded-full bg-accent" />}
              </div>
            )}
            {stepGhostIndex === steps.length && dragStepIndex === null && (
              <div className="h-0.5 rounded-full bg-accent/30 transition-opacity duration-500" />
            )}
          </div>

          {/* Bottom button row */}
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={addStep} className="text-sm font-medium text-accent hover:text-accent-dark">
              + Add step
            </button>
            <button type="button" onClick={addStepDivider} className="text-sm font-medium text-accent hover:text-accent-dark">
              + Add step label divider
            </button>
          </div>
        </fieldset>
      )}

      {/* Source URL */}
      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium">Source URL</label>
        <input id="sourceUrl" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="https://example.com/recipe" />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium">Notes</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Personal notes, tips, variations..." />
      </div>

      {/* Tags — quick tags + overlay for full list */}
      <fieldset>
        <legend className="text-sm font-medium">Tags</legend>
        <div className="mt-3 space-y-4">
          {/* Frequently Used */}
          {frequentTagIds.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                Frequently Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {frequentTagIds
                  .map((id) => tags.find((t) => t.id === id))
                  .filter((t): t is Tag => t !== undefined)
                  .map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button key={tag.id} type="button"
                        onClick={() => toggleTag(tag.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selected ? "bg-accent text-white" : "bg-accent-light text-accent-dark hover:bg-accent/20"
                        }`}>
                        {tag.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Trimmed quick-tag categories */}
          {Object.entries(quickTagCategories).map(([category, allowedNames]) => {
            const catTags = (tagsByCategory[category] ?? [])
              .filter((t) => allowedNames === null || allowedNames.includes(t.name))
              .sort((a, b) => a.name.localeCompare(b.name));
            if (catTags.length === 0) return null;
            return (
              <div key={category}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  {categoryLabels[category as TagCategory] ?? category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {catTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button key={tag.id} type="button"
                        onClick={() => toggleTag(tag.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selected ? "bg-accent text-white" : "bg-accent-light text-accent-dark hover:bg-accent/20"
                        }`}>
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Selected tags from other categories (so user sees what they picked) */}
          {(() => {
            const quickCats = new Set(Object.keys(quickTagCategories));
            const frequentSet = new Set(frequentTagIds);
            const otherSelected = selectedTagIds
              .map((id) => tags.find((t) => t.id === id))
              .filter((t): t is Tag => t !== undefined && !quickCats.has(t.category) && !frequentSet.has(t.id));
            if (otherSelected.length === 0) return null;
            return (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  Selected
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {otherSelected.map((tag) => (
                    <button key={tag.id} type="button"
                      onClick={() => toggleTag(tag.id)}
                      onMouseDown={(e) => e.preventDefault()}
                      className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition-colors">
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* "More tags" button */}
          <button
            type="button"
            onClick={() => setTagPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            More tags
            {selectedTagIds.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">
                {selectedTagIds.length}
              </span>
            )}
          </button>
        </div>
      </fieldset>

      {/* Tag picker overlay */}
      {tagPickerOpen && (
        <TagPickerOverlay
          tags={tags}
          selectedIds={selectedTagIds}
          onToggle={toggleTag}
          onClose={() => setTagPickerOpen(false)}
        />
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button type="submit" disabled={saving}
          className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50">
          {saving ? "Saving..." : isEditing ? "Update recipe" : "Save recipe"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground">
          Cancel
        </button>

        {/* Lock as Original — new recipes only. Once clicked, locked state is
            permanent for this draft and will be written on save. */}
        {!isEditing && (
          <div className="ml-auto">
            {lockedSnapshot ? (
              <span
                className="flex items-center gap-1.5 rounded-md bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted"
                title="The original snapshot is locked and will be saved with this recipe."
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Original locked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLockOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent-dark"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Lock as Original
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation overlay for Lock as Original */}
      {confirmLockOpen && (
        <OverlayShell
          open={confirmLockOpen}
          onClose={() => setConfirmLockOpen(false)}
          title="Lock as Original?"
          maxWidth="max-w-md"
        >
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-foreground">
              This will save a permanent snapshot of the recipe as it is right now.
              You&rsquo;ll still be able to edit the recipe going forward, but the
              original snapshot <strong>cannot be changed or undone</strong>.
            </p>
            <p className="mt-3 text-sm text-muted">
              If you need a different original later, you can create a new recipe
              via &ldquo;Create a copy&rdquo; on the variation menu.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-background/50 px-6 py-3">
            <button
              type="button"
              onClick={() => setConfirmLockOpen(false)}
              className="rounded-md px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLock}
              className="rounded-md bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Save as Original
            </button>
          </div>
        </OverlayShell>
      )}
    </form>
  );
}
