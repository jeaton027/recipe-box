// server component shell
"use client";

import { useRouter } from "next/navigation";
import ImportForm from "@/components/recipes/ImportForm";

export default function ImportPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="font-heading text-2xl font-bold">Import Recipe</h1>
        <button
          onClick={() => router.push("/recipes/new")}
          className="rounded-md bg-accent-soft px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-light"
        >
          From Scratch
        </button>
      </div>
      <div className="mb-8 flex items-baseline justify-between">
        <p className="text-sm text-muted">
          Import from a URL or paste recipe text directly.
        </p>
        <p className="text-xs text-muted">
          Manually enter recipe details.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
