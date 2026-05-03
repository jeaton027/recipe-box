"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Ingredient } from "@/lib/types/database";
import { formatQuantity } from "@/lib/utils/format-quantity";

type Props = {
  servings: number | null;
  servingsMax?: number | null;
  servingsType?: string | null;
  ingredients: Ingredient[];
  /**
   * Initial multiplier value. Used by the cook-mode page to carry over
   * whatever scale the user had set on the detail page (passed via the
   * `?mult=` URL param). Maps onto the preset pills (0.5 / 1 / 2) or
   * falls back to "custom" with the value pre-filled.
   */
  initialMultiplier?: number;
};

type Option = 0.5 | 1 | 2 | "custom";

// Translate a raw multiplier number into the (selected, customValue)
// pair the pill UI uses.
function deriveInitialState(initial: number | undefined): {
  selected: Option;
  customValue: string;
} {
  if (initial === undefined || initial === 1 || !Number.isFinite(initial)) {
    return { selected: 1, customValue: "" };
  }
  if (initial === 0.5) return { selected: 0.5, customValue: "" };
  if (initial === 2) return { selected: 2, customValue: "" };
  return { selected: "custom", customValue: String(initial) };
}

export default function ServingsMultiplier({
  servings,
  servingsMax,
  servingsType,
  ingredients,
  initialMultiplier,
}: Props) {
  const initial = deriveInitialState(initialMultiplier);
  const [selected, setSelected] = useState<Option>(initial.selected);
  const [customValue, setCustomValue] = useState(initial.customValue);

  const multiplier =
    selected === "custom" ? parseFloat(customValue) || 1 : selected;

  // Reflect the current multiplier into the URL as `?mult=`. This lets
  // CookModeButton (which reads the same param) build a cook-mode href
  // that preserves the user's chosen scale, and makes the URL itself
  // bookmark/share-able with the scale baked in. Default 1× has no
  // param at all (cleaner URLs).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const current = searchParams.get("mult");
    const next = multiplier === 1 ? null : String(multiplier);
    if (current === next) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === null) params.delete("mult");
    else params.set("mult", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [multiplier, pathname, router, searchParams]);

  const scaledServings = servings ? Math.round(servings * multiplier) : null;
  const scaledServingsMax = servingsMax ? Math.round(servingsMax * multiplier) : null;

  const options: { label: string; value: Option }[] = [
    { label: "½×", value: 0.5 },
    { label: "1×", value: 1 },
    { label: "2×", value: 2 },
    { label: "Custom", value: "custom", },
  ];

  return (
    <div className="mb-8">
      {/* Heading row with pill */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-xl font-semibold">Ingredients</h2>
          {scaledServings !== null && (
            <span className="whitespace-nowrap text-sm text-muted">
              <span className="text-foreground font-medium" >{scaledServings}{scaledServingsMax ? `–${scaledServingsMax}` : ""}</span> {servingsType || "servings"}
            </span>
          )}
        </div>

        {/* Pill selector — hidden in print; whatever scale the user
            had selected stays applied to the rendered ingredient
            quantities below. */}
        <div className="flex items-center rounded-full border border-border text-xs print:hidden">
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
                  // Dynamic-width input so the trailing × hugs the value.
                  // Width grows with character count (min 1ch so the
                  // cursor stays visible when empty).
                  <span className="inline-flex items-baseline justify-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{ width: `${Math.max(customValue.length, 1)}ch` }}
                      className="bg-transparent text-right text-white outline-none placeholder-white/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    ×
                  </span>
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
