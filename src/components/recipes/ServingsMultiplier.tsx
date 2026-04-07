"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/types/database";

type Props = {
  servings: number | null;
  servingsType?: string | null;
  ingredients: Ingredient[];
};

type Option = 0.5 | 1 | 2 | "custom";

function formatQuantity(value: number): string {
  if (value === 0) return "0";

  const whole = Math.floor(value);
  const frac = value - whole;

  if (frac < 0.02) return whole > 0 ? whole.toString() : "0";
  if (frac > 0.98) return (whole + 1).toString();

  const candidates: [number, string][] = [
    [1 / 8, "⅛"],
    [1 / 4, "¼"],
    [1 / 3, "⅓"],
    [3 / 8, "⅜"],
    [1 / 2, "½"],
    [5 / 8, "⅝"],
    [2 / 3, "⅔"],
    [3 / 4, "¾"],
    [7 / 8, "⅞"],
  ];

  let best = candidates[0];
  let bestDiff = Math.abs(frac - candidates[0][0]);
  for (const c of candidates) {
    const diff = Math.abs(frac - c[0]);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }

  if (bestDiff > 0.06) return value.toFixed(2);

  return whole === 0 ? best[1] : `${whole} ${best[1]}`;
}

export default function ServingsMultiplier({ servings, servingsType, ingredients }: Props) {
  const [selected, setSelected] = useState<Option>(1);
  const [customValue, setCustomValue] = useState("");

  const multiplier =
    selected === "custom" ? parseFloat(customValue) || 1 : selected;

  const scaledServings = servings ? Math.round(servings * multiplier) : null;

  const options: { label: string; value: Option }[] = [
    { label: "½×", value: 0.5 },
    { label: "1×", value: 1 },
    { label: "2×", value: 2 },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="mb-8">
      {/* Heading row with pill */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-xl font-semibold">Ingredients</h2>
          {scaledServings !== null && multiplier !== 1 && (
            <span className="text-xs text-muted">
              {scaledServings} {servingsType || "servings"}
            </span>
          )}
        </div>

        {/* Pill selector */}
        <div className="flex items-center rounded-full border border-border text-xs">
          {options.map((opt, i) => {
            const isFirst = i === 0;
            const isLast = i === options.length - 1;
            const isActive = selected === opt.value;
            const isCustomActive = opt.value === "custom" && isActive;
            return (
              <button
                key={opt.label}
                onClick={() => setSelected(opt.value)}
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
                    onChange={(e) => setCustomValue(e.target.value)}
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
      </div>

      {/* Scaled ingredients */}
      {ingredients.length > 0 && (
        <ul className="space-y-1.5">
          {ingredients.map((ing) =>
            ing.unit === "§" ? (
              <li key={ing.id} className="mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-base font-semibold">{ing.name}</span>
                <div className="h-px flex-1 bg-border" />
              </li>
            ) : (
              <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {ing.quantity !== null && (
                  <span className="font-medium whitespace-nowrap">
                    {formatQuantity(ing.quantity * multiplier)}
                    {ing.quantity_max !== null && ing.quantity_max !== undefined && (
                      <>–{formatQuantity(ing.quantity_max * multiplier)}</>
                    )}
                    {" "}{ing.unit}
                  </span>
                )}
                <span>{ing.name}</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
