"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
};

export default function RecipeGallery({ images }: Props) {
  const [open, setOpen] = useState(false);

  if (images.length === 0 || images.length === 1) return null;

  const preview = images.slice(1, 4);

  return (
    <>
      {/* Gallery preview box */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative mb-6 w-full overflow-hidden rounded-lg border border-border"
      >
        <div className="flex h-20 gap-px">
          {preview.map((url, i) => (
            <div key={i} className="relative flex-1 overflow-hidden">
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
        {/* Label overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
          <span className="flex items-center gap-2 text-sm font-medium text-white drop-shadow">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Gallery ({images.length})
          </span>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Gallery</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image grid */}
            <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
              {images.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                  <Image src={url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
