"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter , useSearchParams} from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImagePicker from "@/components/recipes/ImagePicker";
import type { RecipeWithDetails, Tag } from "@/lib/types/database";

// § is used as a divider marker in the DB (unit field for ingredients, instruction prefix for steps)
const DIVIDER_MARKER = "§";

// Parse "1/3", "1 1/2", "2" etc. to decimal for DB storage
function parseFraction(str: string): number | null {
  if (!str.trim()) return null;
  const parts = str.trim().split(/\s+/);
  let result = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, den] = part.split("/");
      const n = parseFloat(num);
      const d = parseFloat(den);
      if (!isNaN(n) && !isNaN(d) && d !== 0) result += n / d;
    } else {
      const n = parseFloat(part);
      if (!isNaN(n)) result += n;
    }
  }
  return result === 0 ? null : result;
}

// Convert a stored decimal back to a readable fraction string for form display
function formatQtyForInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.01) return whole > 0 ? whole.toString() : "";
  if (frac > 0.99) return (whole + 1).toString();
  const candidates: [number, string][] = [
    [1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 3, "1/3"], [3 / 8, "3/8"],
    [1 / 2, "1/2"], [5 / 8, "5/8"], [2 / 3, "2/3"], [3 / 4, "3/4"], [7 / 8, "7/8"],
  ];
  let best = candidates[0];
  let bestDiff = Math.abs(frac - candidates[0][0]);
  for (const c of candidates) {
    const diff = Math.abs(frac - c[0]);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }
  if (bestDiff > 0.05) return value.toFixed(2);
  return whole === 0 ? best[1] : `${whole} ${best[1]}`;
}

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
  const [servingsType, setServingsType] = useState(recipe?.servings_type ?? "");
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes?.toString() ?? "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [isImageOnly, setIsImageOnly] = useState(
    recipe?.is_image_only ?? searchParams.get("imageOnly") === "true"
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(recipe?.thumbnail_url ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    recipe?.tags?.map((t) => t.id) ?? []
  );

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

  const [dragIngredientIndex, setDragIngredientIndex] = useState<number | null>(null);
  const [dragIngredientOverIndex, setDragIngredientOverIndex] = useState<number | null>(null);
  const [dragStepIndex, setDragStepIndex] = useState<number | null>(null);
  const [dragStepOverIndex, setDragStepOverIndex] = useState<number | null>(null);
  const dragIngredientRef = useRef<number | null>(null);
  const dragIngredientOverRef = useRef<number | null>(null);
  const dragStepRef = useRef<number | null>(null);
  const dragStepOverRef = useRef<number | null>(null);

  // Ghost line: shows where the last moved item came from
  const [ingredientGhostIndex, setIngredientGhostIndex] = useState<number | null>(null);
  const [ingredientGhostKey, setIngredientGhostKey] = useState(0);
  const [stepGhostIndex, setStepGhostIndex] = useState<number | null>(null);
  const [stepGhostKey, setStepGhostKey] = useState(0);

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
      const raw = sessionStorage.getItem("importedRecipe");
      if (raw) {
        const data = JSON.parse(raw);
        sessionStorage.removeItem("importedRecipe");
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setServings(data.servings?.toString() ?? "");
        setPrepTime(data.prep_time_minutes?.toString() ?? "");
        setCookTime(data.cook_time_minutes?.toString() ?? "");
        setIngredients(
          data.ingredients?.map((i: { quantity: string | null; quantity_max: string | null; unit: string | null; name: string }): IngredientItem =>
            i.unit === DIVIDER_MARKER
              ? { kind: "divider", label: i.name }
              : { kind: "ingredient", name: i.name, quantity: i.quantity ?? "", quantityMax: i.quantity_max ?? "", showMax: !!i.quantity_max, unit: i.unit ?? "" }
          ) ?? [{ kind: "ingredient", name: "", quantity: "", quantityMax: "", showMax: false, unit: "" }]
        );
        setSteps(
          data.steps?.map((s: string): StepItem =>
            s.startsWith(DIVIDER_MARKER)
              ? { kind: "divider", label: s.slice(1) }
              : { kind: "step", instruction: s }
          ) ?? [{ kind: "step", instruction: "" }]
        );
        setSourceUrl(data.source_url ?? "");
        if (data.images?.length) {
          setImportedImages(data.images);
          setGalleryImages([data.images[0]]);
          setThumbnailUrl(data.images[0]);
        }
      }
    }
  }, []);

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  const categoryLabels: Record<string, string> = {
    meal_type: "Meal Type", season: "Season", cuisine: "Cuisine",
    dietary: "Dietary", method: "Method", occasion: "Occasion", custom: "Custom",
  };

  function toggleTag(tagId: string) {
    const scrollY = window.scrollY;
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
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
        const rangeMatch = value.match(/^([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)\s*(?:[-–]|to)\s*([\d.\s\/⅛¼⅜½⅝¾⅞⅓⅔]+)$/);
        if (rangeMatch) {
          updated[index] = { ...item, quantity: rangeMatch[1].trim(), quantityMax: rangeMatch[2].trim(), showMax: true };
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
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("recipe-images").upload(filePath, file);
    if (error) { console.error("Upload error:", error); return; }
    const { data: { publicUrl } } = supabase.storage.from("recipe-images").getPublicUrl(filePath);
    setImportedImages((prev) => [...prev, publicUrl]);
    setGalleryImages((prev) => [...prev, publicUrl]);
    setThumbnailUrl((prev) => prev || publicUrl);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!title.trim()) { setError("Title is required"); setSaving(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in"); setSaving(false); return; }

    const recipeData = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      servings: servings ? parseInt(servings) : null,
      servings_type: servingsType.trim() || null,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      notes: notes.trim() || null,
      source_url: sourceUrl.trim() || null,
      thumbnail_url: thumbnailUrl || galleryImages[0] || null,
      gallery_images: galleryImages.length > 0 ? galleryImages : null,
      is_image_only: isImageOnly,
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
      const { data, error: insertError } = await supabase.from("recipes").insert(recipeData).select("id").single();
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

    router.push(`/recipes/${recipeId}`);
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

      {/* Times & Servings */}
      <div className="grid grid-cols-3 gap-4">
        {/* Servings: count + type */}
        <div>
          <label className="block text-sm font-medium">Servings</label>
          <div className="mt-1 flex gap-1">
            <input
              id="servings"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-14 shrink-0 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <input
              type="text"
              value={servingsType}
              onChange={(e) => setServingsType(e.target.value)}
              placeholder="servings"
              className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
        {[
          { id: "prepTime", label: "Prep (min)", value: prepTime, set: setPrepTime },
          { id: "cookTime", label: "Cook (min)", value: cookTime, set: setCookTime },
        ].map(({ id, label, value, set }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-sm font-medium">{label}</label>
            <input id={id} type="number" min={0} value={value} onChange={(e) => set(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
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
                    <span {...ingredientGripHandlers(i)} className="relative z-20 cursor-grab touch-none text-muted hover:text-foreground">
                      <GripIcon />
                    </span>
                    {/* Fixed-width qty area so Unit always aligns */}
                    <div className="flex w-40 shrink-0 items-center gap-1 justify-end">
                      {item.showMax ? (
                        <>
                          <input type="text" value={item.quantity}
                            onChange={(e) => updateIngredientField(i, "quantity", e.target.value)}
                            placeholder="Min"
                            className="w-16 shrink-0 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                          <span className="text-xs text-muted shrink-0">–</span>
                          <input type="text" value={item.quantityMax}
                            onChange={(e) => updateIngredientField(i, "quantityMax", e.target.value)}
                            placeholder="Max"
                            className="w-16 shrink-0 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                        </>
                      ) : (
                        <input type="text" value={item.quantity}
                          onChange={(e) => updateIngredientField(i, "quantity", e.target.value)}
                          placeholder="Qty"
                          className="w-16 shrink-0 rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ml-auto" />
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

      {/* Tags */}
      <fieldset>
        <legend className="text-sm font-medium">Tags</legend>
        <div className="mt-3 space-y-4">
          {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
            <div key={category}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                {categoryLabels[category] ?? category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categoryTags.map((tag) => {
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
          ))}
        </div>
      </fieldset>

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
      </div>
    </form>
  );
}
