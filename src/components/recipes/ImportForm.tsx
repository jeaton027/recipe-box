"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setImportedRecipe } from "@/lib/storage/recipe-handoff";
import type { ImportedRecipePayload } from "@/lib/types/recipe-handoff";

type Mode = "url" | "paste" | "image";

function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(?:^|\.)instagram\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

export default function ImportForm() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Instagram detection
  const isIG = isInstagramUrl(url);
  const [igCaption, setIgCaption] = useState("");
  const [igThumbnail, setIgThumbnail] = useState<string | null>(null);
  const [igAuthor, setIgAuthor] = useState<string | null>(null);
  const [igFetching, setIgFetching] = useState(false);

  // Fetch Instagram oEmbed data when URL is detected as IG
  useEffect(() => {
    if (!isIG || !url.trim()) {
      setIgThumbnail(null);
      setIgAuthor(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIgFetching(true);
      try {
        const res = await fetch("/api/instagram-oembed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setIgThumbnail(data.thumbnail_url ?? null);
          setIgAuthor(data.author_name ?? null);
        }
      } catch {
        // silently fail — thumbnail is optional
      } finally {
        if (!cancelled) setIgFetching(false);
      }
    }, 500); // debounce

    return () => { cancelled = true; clearTimeout(timer); };
  }, [url, isIG]);

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

      // The /api/import-recipe response is JSON-typed any; this cast asserts
      // the contract so the spread + setImportedRecipe call is type-checked.
      setImportedRecipe({ ...(data as ImportedRecipePayload), source_url: url });
      router.push("/recipes/new?source=import");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleInstagramImport() {
    setError(null);
    if (!igCaption.trim()) {
      setError("Paste the recipe text from the Instagram caption or comments.");
      return;
    }
    setLoading(true);
    try {
      // Parse the caption text using our existing text parser
      const res = await fetch("/api/parse-recipe-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: igCaption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      // Attach Instagram thumbnail and source URL
      const parsed = data as ImportedRecipePayload;
      const importData: ImportedRecipePayload = {
        ...parsed,
        source_url: url,
        images: igThumbnail ? [igThumbnail, ...(parsed.images ?? [])] : (parsed.images ?? []),
      };

      // Use IG author as title hint if parser didn't find one
      if (!importData.title && igAuthor) {
        importData.title = `Recipe by ${igAuthor}`;
      }

      setImportedRecipe(importData);
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

      setImportedRecipe(data as ImportedRecipePayload);
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

          {isIG ? (
            /* ── Instagram flow ── */
            <div className="space-y-3 rounded-lg border border-accent-light bg-accent-light/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-accent-dark">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
                Instagram detected
                {igFetching && <span className="text-xs text-muted">fetching preview...</span>}
              </div>

              {/* Thumbnail preview */}
              {igThumbnail && (
                <div className="flex items-center gap-3">
                  <img
                    src={igThumbnail}
                    alt="Instagram thumbnail"
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="text-sm">
                    {igAuthor && <p className="font-medium text-foreground">@{igAuthor}</p>}
                    <p className="text-xs text-muted">Thumbnail will be used as recipe image</p>
                  </div>
                </div>
              )}

              {/* Caption paste area */}
              <div>
                <label className="mb-1 block text-sm text-muted">
                  Paste the recipe from the caption or comments
                </label>
                <textarea
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  placeholder={`Copy the recipe text from Instagram and paste here, e.g.:\n\nChocolate Chip Cookies\n\nIngredients:\n2 cups flour\n1 cup sugar\n...\n\nInstructions:\n1. Preheat oven...\n2. Mix ingredients...`}
                  rows={10}
                  className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                />
                <p className="mt-1 text-xs text-muted">
                  Tip: long-press the caption on Instagram → Copy
                </p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={handleInstagramImport}
                disabled={!igCaption.trim() || loading}
                className="block mx-auto rounded-md bg-accent-soft px-4 py-2.5 text-sm font-medium text-black transition-colors hover:ring-1 hover:ring-inset hover:ring-accent disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import Recipe"}
              </button>
            </div>
          ) : (
            /* ── Standard URL flow ── */
            <>
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
