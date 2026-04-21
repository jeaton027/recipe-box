"use client";

import OverlayShell from "@/components/shared/OverlayShell";
import type { OriginalSnapshot } from "@/lib/types/database";

const DIVIDER_MARKER = "§";

type Props = {
  open: boolean;
  onClose: () => void;
  snapshot: OriginalSnapshot | null;
};

function formatQty(q: number | null): string {
  if (q === null || q === undefined) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const fractions: [number, string][] = [
    [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
    [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
  ];
  if (frac < 0.02) return whole.toString();
  let best = fractions[0];
  let bestDiff = Math.abs(frac - fractions[0][0]);
  for (const c of fractions) {
    const d = Math.abs(frac - c[0]);
    if (d < bestDiff) { bestDiff = d; best = c; }
  }
  if (bestDiff > 0.05) return q.toFixed(2);
  return whole === 0 ? best[1] : `${whole}${best[1]}`;
}

function formatQtyRange(q: number | null, qMax: number | null): string {
  const a = formatQty(q);
  const b = formatQty(qMax);
  if (a && b) return `${a}–${b}`;
  return a || b;
}

export default function OriginalSnapshotOverlay({
  open,
  onClose,
  snapshot,
}: Props) {
  if (!snapshot) return null;

  const captured = new Date(snapshot.captured_at);
  const capturedLabel = captured.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const sourceHost = (() => {
    if (!snapshot.source_url) return null;
    try {
      return new URL(snapshot.source_url).hostname;
    } catch {
      return null;
    }
  })();

  const sourceLabel = {
    url_import: "URL import",
    variation_copy: "variation copy",
    manual: "manual entry",
  }[snapshot.source];

  return (
    <OverlayShell open={open} onClose={onClose} title="Original version">
      {/* Sepia / archival treatment: muted background, warmer tones */}
      <div className="flex-1 overflow-y-auto bg-[#faf7f2] px-6 py-5 text-foreground/80">
        {/* Capture metadata */}
        <div className="mb-5 flex items-center gap-2 text-xs text-muted">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Locked {capturedLabel}
          {sourceHost ? (
            <>
              {" · from "}
              <a
                href={snapshot.source_url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {sourceHost}
              </a>
            </>
          ) : (
            <> · {sourceLabel}</>
          )}
        </div>

        {/* Title + description */}
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {snapshot.title}
        </h1>
        {snapshot.description && (
          <p className="mt-2 text-sm text-muted">{snapshot.description}</p>
        )}

        {/* Meta */}
        {(snapshot.servings ||
          snapshot.prep_time_minutes ||
          snapshot.cook_time_minutes) && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            {snapshot.servings && (
              <span>
                <strong className="text-foreground/80">
                  {snapshot.servings}
                  {snapshot.servings_max ? `–${snapshot.servings_max}` : ""}
                </strong>{" "}
                {snapshot.servings_type || "servings"}
              </span>
            )}
            {snapshot.prep_time_minutes && (
              <span>
                <strong className="text-foreground/80">
                  {snapshot.prep_time_minutes}
                </strong>{" "}
                min prep
              </span>
            )}
            {snapshot.cook_time_minutes && (
              <span>
                <strong className="text-foreground/80">
                  {snapshot.cook_time_minutes}
                </strong>{" "}
                min cook
              </span>
            )}
          </div>
        )}

        {/* Ingredients */}
        {snapshot.ingredients.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading mb-2 text-lg font-semibold">
              Ingredients
            </h2>
            <ul className="space-y-1.5">
              {snapshot.ingredients.map((ing, i) => {
                if (ing.unit === DIVIDER_MARKER) {
                  return (
                    <li key={i} className="mt-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-sm font-semibold">{ing.name}</span>
                      <div className="h-px flex-1 bg-border" />
                    </li>
                  );
                }
                const qty = formatQtyRange(ing.quantity, ing.quantity_max);
                return (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    {qty && (
                      <span className="font-medium">
                        {qty}
                        {ing.unit && ` ${ing.unit}`}
                      </span>
                    )}
                    <span>{ing.name}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Steps */}
        {snapshot.steps.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading mb-2 text-lg font-semibold">Steps</h2>
            <ol className="space-y-3">
              {(() => {
                let n = 0;
                return snapshot.steps.map((step, i) => {
                  if (step.instruction.startsWith(DIVIDER_MARKER)) {
                    const label = step.instruction.slice(1);
                    return (
                      <li key={i} className="mt-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm font-semibold">{label}</span>
                        <div className="h-px flex-1 bg-border" />
                      </li>
                    );
                  }
                  n++;
                  return (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light/70 text-xs font-medium text-accent-dark">
                        {n}
                      </span>
                      <p className="text-sm leading-relaxed">
                        {step.instruction}
                      </p>
                    </li>
                  );
                });
              })()}
            </ol>
          </section>
        )}

        {/* Notes */}
        {snapshot.notes && (
          <section className="mt-6">
            <h2 className="font-heading mb-2 text-lg font-semibold">Notes</h2>
            <div className="whitespace-pre-line rounded-lg bg-white/60 p-3 text-sm leading-relaxed">
              {snapshot.notes}
            </div>
          </section>
        )}

        {/* Footer note */}
        <p className="mt-8 text-center text-xs italic text-muted">
          This is a read-only snapshot. Edits here are not possible.
        </p>
      </div>
    </OverlayShell>
  );
}
