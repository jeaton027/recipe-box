"use client";

import { useState } from "react";
import { useCookNotesAutosave } from "@/lib/hooks/useCookNotesAutosave";

type Props = {
  recipeId: string;
  initial: string;
};

/**
 * Cook's Notes section on the recipe detail page. Sits between Notes
 * (recipe-author tips) and Related. Distinct in label and styling from
 * Notes — but stays in the page's overall theme (no notebook treatment
 * here; that's reserved for Cook Mode).
 *
 * Click-to-edit: collapsed view shows the rendered text; clicking
 * (or the empty placeholder) reveals a textarea. The textarea uses the
 * same auto-save hook as the cook-mode sheet.
 */
export default function CookNotesSection({ recipeId, initial }: Props) {
  const { value, setValue } = useCookNotesAutosave(recipeId, initial);
  const [editing, setEditing] = useState(false);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-semibold">Cook&apos;s Notes</h2>
        {value && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-muted hover:text-accent"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          rows={Math.max(4, value.split("\n").length + 1)}
          className="block w-full resize-y rounded-lg border border-border bg-white px-4 py-3 text-sm leading-relaxed focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Adjustments, lessons, things to try next time…"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full whitespace-pre-line rounded-lg border border-border bg-white p-4 text-left text-sm leading-relaxed transition-colors hover:border-accent"
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full rounded-lg border border-dashed border-border bg-white px-4 py-3 text-left text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Add a note — adjustments, lessons, things to try next time…
        </button>
      )}
    </section>
  );
}
