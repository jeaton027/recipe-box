"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Auto-save hook for the Cook's Notes field. Debounces writes to
 * `recipes.cook_notes` by 1.5s of inactivity, and force-flushes on
 * unmount so a user closing Cook Mode mid-typing doesn't lose work.
 *
 * Usage:
 *   const { value, setValue } = useCookNotesAutosave(recipeId, initial);
 *
 * No save indicator is surfaced to the UI — the user explicitly didn't
 * want save toasts. Errors land in the console and the local state is
 * preserved so the user can keep typing; the next successful save flushes.
 *
 * Session-date prepend lives in this hook so both the cook-mode sheet
 * and the detail-page editor get the same behavior automatically.
 * Triggered the first time the user types after a calendar-day gap
 * since the last save (or the first time the notes are non-empty).
 */
const DEBOUNCE_MS = 1500;

// Tag pattern: "--- Mon DD, YYYY ---" on its own line.
const SESSION_TAG_RE = /^--- [A-Z][a-z]{2} \d{1,2}, \d{4} ---$/m;

function todayTag(): string {
  // Locale-en for stable parsing; cosmetic so consistency matters more
  // than localization here.
  const d = new Date();
  const m = d.toLocaleDateString("en-US", { month: "short" });
  return `--- ${m} ${d.getDate()}, ${d.getFullYear()} ---`;
}

function ensureSessionHeader(prev: string, next: string): string {
  // Only auto-prepend when the user is genuinely starting a new chunk
  // (next.length > prev.length) AND today's date isn't already the most
  // recent header. Avoids spamming headers on every keystroke.
  if (next.length <= prev.length) return next;
  const tag = todayTag();
  // Walk from the end backwards to find the last session tag.
  const lines = next.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SESSION_TAG_RE.test(lines[i])) {
      // If the most recent tag is already today, no-op.
      if (lines[i] === tag) return next;
      break;
    }
  }
  // Determine where the new content starts: index of divergence.
  let i = 0;
  while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
  // Insert the tag at the typing-start point, prefixed by a blank
  // line if there's existing content before it.
  const before = next.slice(0, i);
  const after = next.slice(i);
  const sep = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  return `${before}${sep}${tag}\n${after}`;
}

export function useCookNotesAutosave(recipeId: string, initial: string) {
  const [value, setValueRaw] = useState(initial);
  const lastSavedRef = useRef(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The supabase client is stable per render — keep a single instance.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();

  const flush = useCallback(async (toSave: string) => {
    if (toSave === lastSavedRef.current) return;
    const supabase = supabaseRef.current!;
    const { error } = await supabase
      .from("recipes")
      .update({ cook_notes: toSave || null })
      .eq("id", recipeId);
    if (error) {
      console.warn("[cook_notes] save failed:", error.message);
      return;
    }
    lastSavedRef.current = toSave;
  }, [recipeId]);

  // Wraps setState to also schedule a debounced save AND auto-prepend
  // the session header when entering text after a day gap.
  const setValue = useCallback(
    (next: string) => {
      setValueRaw((prev) => {
        const stamped = ensureSessionHeader(prev, next);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void flush(stamped);
        }, DEBOUNCE_MS);
        return stamped;
      });
    },
    [flush]
  );

  // Force-flush on unmount so closing the sheet/page doesn't lose
  // pending changes still in the debounce window.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Read latest from the closure's last setValue invocation by
      // pulling current state via a microtask read against the ref.
      // We can't read state directly here — so we rely on the timer
      // having fired or the next-mount recovering. Simpler: store the
      // most recent value in a ref each time setValue runs.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Maintain a ref mirror of the current value so unmount can flush it.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      // Final flush on unmount.
      void flush(valueRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { value, setValue };
}
