"use client";

import { useState, useEffect } from "react";
import type { Recipe } from "@/lib/types/database";
import RecipePickerOverlay from "@/components/shared/RecipePickerOverlay";

export type CourseType = "main" | "side" | "starter" | "drink" | "dessert" | "other";

const courseOptions: { label: string; value: CourseType }[] = [
  { label: "Main", value: "main" },
  { label: "Side", value: "side" },
  { label: "Starter", value: "starter" },
  { label: "Drink", value: "drink" },
  { label: "Dessert", value: "dessert" },
  { label: "Other", value: "other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Recipe IDs already in this menu — excluded from picker. */
  excludeIds: Set<string>;
  /** Called with selected recipes + chosen course when user clicks Done. */
  onAdd: (recipes: Recipe[], course: CourseType) => void;
  /** Initial course to pre-select (whichever "+ Add" the user clicked). */
  initialCourse?: CourseType;
};

export default function MenuRecipePicker({
  open,
  onClose,
  excludeIds,
  onAdd,
  initialCourse = "main",
}: Props) {
  const [course, setCourse] = useState<CourseType>(initialCourse);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);

  // Sync course when the parent changes which "+ Add" was clicked
  useEffect(() => {
    setCourse(initialCourse);
  }, [initialCourse]);

  function handleToggle(recipe: Recipe) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipe.id)) {
        next.delete(recipe.id);
      } else {
        next.add(recipe.id);
      }
      return next;
    });
    setSelectedRecipes((prev) => {
      if (prev.some((r) => r.id === recipe.id)) {
        return prev.filter((r) => r.id !== recipe.id);
      }
      return [...prev, recipe];
    });
  }

  function handleAction() {
    if (selectedRecipes.length === 0) return;
    onAdd(selectedRecipes, course);
    // Reset
    setSelectedIds(new Set());
    setSelectedRecipes([]);
    setCourse(initialCourse);
  }

  function handleClose() {
    setSelectedIds(new Set());
    setSelectedRecipes([]);
    setCourse(initialCourse);
    onClose();
  }

  return (
    <RecipePickerOverlay
      open={open}
      onClose={handleClose}
      actionLabel={`Add${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
      actionDisabled={selectedIds.size === 0}
      onAction={handleAction}
      selectedIds={selectedIds}
      onToggle={handleToggle}
      excludeIds={excludeIds}
      showCloseButton={false}
      tray={
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted">Course:</span>
          {courseOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCourse(opt.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                course === opt.value
                  ? "bg-accent text-white"
                  : "bg-accent-light text-accent-dark hover:bg-accent hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
