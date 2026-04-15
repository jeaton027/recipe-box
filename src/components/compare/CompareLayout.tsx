"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Recipe, Ingredient, Step } from "@/lib/types/database";
import { formatQuantity } from "@/lib/utils/format-quantity";

type CompareData = {
  recipe: Recipe;
  ingredients: Ingredient[];
  steps: Step[];
};

type MultiplierOption = 0.5 | 1 | 2 | "custom";

export default function CompareLayout({ recipes }: { recipes: CompareData[] }) {
  // Independent multiplier per column so you can scale recipes separately
  const [selected, setSelected] = useState<MultiplierOption[]>(
    recipes.map(() => 1 as MultiplierOption)
  );
  const [custom, setCustom] = useState<string[]>(recipes.map(() => ""));

  const multipliers = selected.map((sel, i) =>
    sel === "custom" ? parseFloat(custom[i]) || 1 : sel
  );

  // If one column starts with a divider label ("For the dough") but another
  // doesn't, we want the first real ingredient/step in each column to line
  // up. Each column that doesn't start with a divider gets an invisible
  // divider-shaped spacer at the top.
  const ingredientsStartWithDivider = recipes.map(
    (r) => r.ingredients.length > 0 && r.ingredients[0].unit === "§"
  );
  const anyIngredientLeadingDivider = ingredientsStartWithDivider.some(Boolean);

  const stepsStartWithDivider = recipes.map(
    (r) => r.steps.length > 0 && r.steps[0].instruction.startsWith("§")
  );
  const anyStepLeadingDivider = stepsStartWithDivider.some(Boolean);

  const anyNotes = recipes.some((r) => r.recipe.notes);

  return (
    <>
      {/* Mobile — not supported */}
      <div className="mx-auto block max-w-md px-4 py-16 text-center sm:hidden">
        <h1 className="font-heading text-2xl font-bold">Compare recipes</h1>
        <p className="mt-3 text-muted">
          Open this page on a desktop to compare recipes side by side.
        </p>
        <Link
          href="/recipes"
          className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Back to recipes
        </Link>
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-3xl px-6 py-8 sm:block">
        {/* Sticky titles */}
        <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            {recipes.map(({ recipe }) => (
              <div key={recipe.id} className="min-w-0">
                <Link href={`/recipes/${recipe.slug}`}>
                  <h2 className="font-heading truncate text-xl font-bold hover:text-accent-dark">
                    {recipe.title}
                  </h2>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Thumbnail + meta row */}
        <div className="grid grid-cols-2 gap-6 py-6">
          {recipes.map(({ recipe }) => (
            <div key={recipe.id} className="flex gap-4">
              {recipe.thumbnail_url ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={recipe.thumbnail_url}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-md bg-gray-100" />
              )}
              <div className="flex flex-1 flex-col justify-center gap-1 text-sm text-muted">
                {recipe.prep_time_minutes && (
                  <span>
                    <strong className="text-foreground">
                      {recipe.prep_time_minutes}
                    </strong>{" "}
                    min prep
                  </span>
                )}
                {recipe.cook_time_minutes && (
                  <span>
                    <strong className="text-foreground">
                      {recipe.cook_time_minutes}
                    </strong>{" "}
                    min cook
                  </span>
                )}
                {(recipe.bake_time || recipe.bake_temp) && (
                  <span className="text-foreground">
                    {recipe.bake_time && (
                      <>
                        {recipe.bake_time}
                        {recipe.bake_time_max && <>–{recipe.bake_time_max}</>}
                        {recipe.bake_time_unit || "min"}
                      </>
                    )}
                    {recipe.bake_time && recipe.bake_temp && " @ "}
                    {recipe.bake_temp && (
                      <>
                        {recipe.bake_temp}
                        {recipe.bake_temp_max && <>–{recipe.bake_temp_max}</>}
                        °{recipe.bake_temp_unit || "F"}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ingredients band — aligned rows */}
        <section className="mb-8 border-t border-border pt-6">
          <h3 className="font-heading mb-3 text-lg font-semibold">Ingredients</h3>

          {/* Per-column multiplier pills + scaled servings */}
          <div className="mb-3 grid grid-cols-2 gap-6">
            {recipes.map(({ recipe }, col) => {
              const m = multipliers[col];
              const scaledServings = recipe.servings
                ? Math.round(recipe.servings * m)
                : null;
              const scaledServingsMax = recipe.servings_max
                ? Math.round(recipe.servings_max * m)
                : null;
              return (
                <div
                  key={col}
                  className="flex items-center justify-between gap-3"
                >
                  {scaledServings !== null ? (
                    <span className="text-sm text-muted">
                      <strong className="text-foreground">{scaledServings}{scaledServingsMax ? `–${scaledServingsMax}` : ""}</strong> {recipe.servings_type || "servings"}
                    </span>
                  ) : (
                    <span />
                  )}
                  <MultiplierPill
                    selected={selected[col]}
                    customValue={custom[col]}
                    onSelect={(v) =>
                      setSelected((prev) => {
                        const next = [...prev];
                        next[col] = v;
                        return next;
                      })
                    }
                    onCustomChange={(v) =>
                      setCustom((prev) => {
                        const next = [...prev];
                        next[col] = v;
                        return next;
                      })
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {recipes.map(({ ingredients }, col) => {
              const m = multipliers[col];
              const needsLeadingSpacer =
                anyIngredientLeadingDivider && !ingredientsStartWithDivider[col];
              return (
                <ul key={col} className="space-y-1.5">
                  {needsLeadingSpacer && (
                    <li
                      aria-hidden="true"
                      className="mt-4 flex items-center gap-3"
                    >
                      <span className="text-base font-semibold opacity-0">
                        ·
                      </span>
                    </li>
                  )}
                  {ingredients.map((ing) => {
                    if (ing.unit === "§") {
                      return (
                        <li
                          key={ing.id}
                          className="mt-4 flex items-center gap-3"
                        >
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-base font-semibold">
                            {ing.name}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </li>
                      );
                    }
                    return (
                      <li
                        key={ing.id}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {ing.quantity !== null && (
                          <span className="whitespace-nowrap font-medium">
                            {formatQuantity(ing.quantity * m)}
                            {ing.quantity_max !== null &&
                              ing.quantity_max !== undefined && (
                                <>–{formatQuantity(ing.quantity_max * m)}</>
                              )}{" "}
                            {ing.unit}
                          </span>
                        )}
                        <span>{ing.name}</span>
                      </li>
                    );
                  })}
                </ul>
              );
            })}
          </div>
        </section>

        {/* Steps — independent columns, start-aligned */}
        <section className="mb-8 border-t border-border pt-6">
          <h3 className="font-heading mb-3 text-lg font-semibold">Steps</h3>
          <div className="grid grid-cols-2 gap-6">
            {recipes.map(({ steps }, col) => {
              let stepCount = 0;
              const needsLeadingSpacer =
                anyStepLeadingDivider && !stepsStartWithDivider[col];
              return (
                <ol key={col} className="space-y-4">
                  {needsLeadingSpacer && (
                    <li
                      aria-hidden="true"
                      className="mt-4 flex items-center gap-3"
                    >
                      <span className="text-sm font-semibold opacity-0">·</span>
                    </li>
                  )}
                  {steps.map((step) => {
                    if (step.instruction.startsWith("§")) {
                      const label = step.instruction.slice(1);
                      return (
                        <li
                          key={step.id}
                          className="mt-4 flex items-center gap-3"
                        >
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-sm font-semibold">{label}</span>
                          <div className="h-px flex-1 bg-border" />
                        </li>
                      );
                    }
                    stepCount++;
                    return (
                      <li key={step.id} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-medium text-accent-dark">
                          {stepCount}
                        </span>
                        <p className="text-sm leading-relaxed">
                          {step.instruction}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              );
            })}
          </div>
        </section>

        {/* Notes — independent columns */}
        {anyNotes && (
          <section className="mb-8 border-t border-border pt-6">
            <h3 className="font-heading mb-3 text-lg font-semibold">Notes</h3>
            <div className="grid grid-cols-2 gap-6">
              {recipes.map(({ recipe }) => (
                <div key={recipe.id}>
                  {recipe.notes ? (
                    <div className="whitespace-pre-wrap rounded-lg bg-accent-light/50 p-4 text-sm leading-relaxed">
                      {recipe.notes}
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted">No notes</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function MultiplierPill({
  selected,
  customValue,
  onSelect,
  onCustomChange,
}: {
  selected: MultiplierOption;
  customValue: string;
  onSelect: (v: MultiplierOption) => void;
  onCustomChange: (v: string) => void;
}) {
  const options: { label: string; value: MultiplierOption }[] = [
    { label: "½×", value: 0.5 },
    { label: "1×", value: 1 },
    { label: "2×", value: 2 },
    { label: "Custom", value: "custom" },
  ];
  return (
    <div className="flex items-center rounded-full border border-border text-xs">
      {options.map((opt, i) => {
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        const isActive = selected === opt.value;
        const isCustomActive = opt.value === "custom" && isActive;
        return (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.value)}
            className={`px-3 py-1 transition-colors
              ${isFirst ? "rounded-l-full" : ""}
              ${isLast ? "rounded-r-full" : ""}
              ${!isFirst ? "border-l border-border" : ""}
              ${isActive ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
          >
            {isCustomActive ? (
              <input
                type="text"
                inputMode="decimal"
                value={customValue}
                onChange={(e) => onCustomChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-10 bg-transparent text-center text-white outline-none placeholder-white/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="×"
              />
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}
