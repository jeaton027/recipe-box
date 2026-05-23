"use client";

import { useState } from "react";
import {
  toDatasetSchema,
  reconstructText,
  type RecipeBoxParserOutput,
  type DatasetExpected,
} from "@/lib/labeling/to-dataset-schema";

const BUCKETS = [
  {
    value: "clean_structured",
    label: "Clean structured",
    desc: "Clear Ingredients/Instructions headers, line-broken",
  },
  {
    value: "multi_section",
    label: "Multi-section",
    desc: "Cake + frosting, dough + filling — multiple For the X dividers",
  },
  {
    value: "instagram_caption",
    label: "Instagram caption",
    desc: "Emoji-heavy, no headers, prose+list mix",
  },
  {
    value: "prose_style",
    label: "Prose-style",
    desc: "Paragraphs only, no list structure",
  },
  {
    value: "flat_paste",
    label: "Flat paste",
    desc: "Single-line jumble, no newlines",
  },
  {
    value: "edge_weird",
    label: "Edge weird",
    desc: "All caps, foreign chars, missing fields, weird ranges",
  },
] as const;

type Mode = "url" | "text";

export default function LabelingTool() {
  const [bucket, setBucket] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [datasetInput, setDatasetInput] = useState("");
  const [expectedJson, setExpectedJson] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string>("");

  const canParse =
    !!bucket && (mode === "url" ? !!url.trim() : !!textInput.trim());
  const canSave = !!bucket && !!datasetInput && !!expectedJson;

  async function handleParse() {
    setError(null);
    setSuccess(null);
    if (!bucket) {
      setError("Select a bucket first — what kind of input is this?");
      return;
    }
    setParsing(true);
    try {
      let parsed: RecipeBoxParserOutput;
      let inputText: string;
      let src: string | null = null;

      if (mode === "url") {
        if (!url.trim()) throw new Error("Enter a URL");
        const res = await fetch("/api/import-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "URL import failed");
        parsed = data as RecipeBoxParserOutput;
        inputText = reconstructText(parsed);
        src = url;
      } else {
        if (!textInput.trim()) throw new Error("Paste recipe text");
        const res = await fetch("/api/parse-recipe-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textInput }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Text parse failed");
        parsed = data as RecipeBoxParserOutput;
        inputText = textInput;
      }

      const expected = toDatasetSchema(parsed);
      setDatasetInput(inputText);
      setExpectedJson(JSON.stringify(expected, null, 2));
      setSourceUrl(src ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (!bucket) {
      setError("Select a bucket first.");
      return;
    }
    setSaving(true);
    try {
      let expected: DatasetExpected;
      try {
        expected = JSON.parse(expectedJson) as DatasetExpected;
      } catch (e) {
        throw new Error(`Expected JSON is invalid: ${(e as Error).message}`);
      }
      const res = await fetch("/api/save-to-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: datasetInput,
          expected,
          bucket,
          source_url: sourceUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSuccess(`Saved as "${bucket}". Dataset now has ${data.count} entries.`);
      // Clear inputs but keep the bucket so you can batch-label same-type
      // entries without re-clicking.
      setUrl("");
      setTextInput("");
      setDatasetInput("");
      setExpectedJson("");
      setSourceUrl("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-bold">Dataset Labeling Tool</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the bucket first, then parse a URL or pasted text, hand-correct
          the JSON, and save.
        </p>
      </header>

      {/* Bucket selection — required first */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          1. Bucket {bucket ? "" : <span className="text-red-500">(required)</span>}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BUCKETS.map((b) => {
            const selected = bucket === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setBucket(b.value)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent-light"
                    : "border-border bg-white hover:border-accent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      selected ? "border-accent bg-accent" : "border-border"
                    }`}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="text-sm font-medium">{b.label}</span>
                </div>
                <p className="mt-1 ml-6 text-xs text-muted">{b.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Source mode toggle */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          2. Source
        </h2>
        <div className="flex rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-lg ${
              mode === "url" ? "bg-accent text-white" : "text-muted"
            }`}
          >
            From URL
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-lg border-l border-border ${
              mode === "text" ? "bg-accent text-white" : "text-muted"
            }`}
          >
            Paste Text
          </button>
        </div>

        {mode === "url" ? (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe/..."
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        ) : (
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste a recipe (with section headers, Instagram caption, etc.)"
            rows={10}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono"
          />
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={parsing || !canParse}
            title={!bucket ? "Select a bucket first" : ""}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {parsing ? "Parsing..." : "Parse"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      </section>

      {(datasetInput || expectedJson) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            3. Edit & save
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Input (raw text the model sees)
              </label>
              <textarea
                value={datasetInput}
                onChange={(e) => setDatasetInput(e.target.value)}
                rows={24}
                className="block w-full rounded-md border border-border bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Expected (gold JSON — edit as needed)
              </label>
              <textarea
                value={expectedJson}
                onChange={(e) => setExpectedJson(e.target.value)}
                rows={24}
                className="block w-full rounded-md border border-border bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-md bg-accent-soft px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save to Dataset${bucket ? ` (as ${bucket})` : ""}`}
          </button>
        </section>
      )}
    </div>
  );
}
