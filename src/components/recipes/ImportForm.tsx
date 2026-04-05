"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "url" | "paste" | "image";

export default function ImportForm() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUrlImport() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      sessionStorage.setItem("importedRecipe", JSON.stringify({ ...data, source_url: url }));
      router.push("/recipes/new?source=import");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleTextParse() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/parse-recipe-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      if (!data.ingredients?.length && !data.steps?.length) {
        throw new Error("Couldn't detect ingredients or steps. Try adding \"Ingredients\" and \"Instructions\" as section labels.");
      }

      sessionStorage.setItem("importedRecipe", JSON.stringify(data));
      router.push("/recipes/new?source=import");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleImageOnly() {
    router.push("/recipes/new?imageOnly=true");
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex rounded-lg border border-border">
        <button
          type="button"
          onClick={() => { setMode("url"); setError(null); }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-l-lg ${
            mode === "url"
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          From URL
        </button>
        <button
          type="button"
          onClick={() => { setMode("paste"); setError(null); }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
            mode === "paste"
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          Paste Text
        </button>
        <button
          type="button"
          onClick={() => { setMode("image"); setError(null); }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-r-lg border-l border-border ${
            mode === "image"
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          Image Only
        </button>
      </div>

      {/* URL mode */}
      {mode === "url" && (
        <>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/recipe/..."
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleUrlImport}
            disabled={!url || loading}
            className="block mx-auto rounded-md bg-accent-soft px-4 py-2.5 text-sm font-medium text-black transition-colors hover:ring-1 hover:ring-inset hover:ring-accent disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import Recipe"}
          </button>
        </>
      )}

      {/* Paste mode */}
      {mode === "paste" && (
        <>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Paste a full recipe here. Works best with clear section labels, e.g.:\n\nChocolate Chip Cookies\nMakes 36 cookies\n\nIngredients\n2 cups flour\n1 cup sugar\n...\n\nInstructions\n1. Preheat oven to 375°F.\n2. Mix dry ingredients.\n...`}
            rows={14}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
          <p className="text-xs text-muted">
            Tip: include &ldquo;Ingredients&rdquo; and &ldquo;Instructions&rdquo; as section headers for the most accurate parsing.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleTextParse}
            disabled={!pasteText.trim() || loading}
            className="block mx-auto rounded-md bg-accent-soft px-4 py-2.5 text-sm font-medium text-black transition-colors hover:ring-1 hover:ring-inset hover:ring-accent disabled:opacity-50"
          >
            {loading ? "Parsing..." : "Parse Recipe"}
          </button>
        </>
      )}

      {/* Image Only mode */}
      {mode === "image" && (
        <>
          <p className="text-center text-sm text-muted">
            Upload a photo of a handwritten recipe card or screenshot.
          </p>
          <button
            type="button"
            onClick={handleImageOnly}
            className="block mx-auto rounded-md bg-accent-soft px-4 py-2.5 text-sm font-medium text-black transition-colors hover:ring-1 hover:ring-inset hover:ring-accent disabled:opacity-50"
          >
            Create Recipe
          </button>
        </>
      )}
    </div>
  );
}
