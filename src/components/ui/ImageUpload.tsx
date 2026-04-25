"use client";

import { useState, useRef } from "react";
import Image from "next/image";

type ImageUploadProps = {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<string | null>;
  onRemove?: () => void;
  label?: string;
  className?: string;
};

export default function ImageUpload({
  currentUrl,
  onUpload,
  onRemove,
  label = "Upload image",
  className = "",
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);

    if (url) {
      setPreview(url);
    } else {
      // Upload failed, revert preview
      setPreview(currentUrl ?? null);
    }

    URL.revokeObjectURL(objectUrl);
  }

  function handleRemove() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1">
        {preview ? (
          <div className="relative inline-block">
            <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-border">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
                sizes="160px"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted hover:border-accent hover:text-accent"
          >
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="text-xs">{label}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
