"use client";

import { useRef, useState } from "react";

const ACCENT = "#7c6ca8";
const STAR_PATH =
  "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z";

type Props = {
  images: string[];
  galleryImages: string[];
  thumbnailUrl: string;
  onGalleryToggle: (url: string) => void;
  onThumbnailSelect: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: (url: string) => void;
};

export default function ImagePicker({
  images,
  galleryImages,
  thumbnailUrl,
  onGalleryToggle,
  onThumbnailSelect,
  onUpload,
  onRemove,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">Select images</p>
        {images.length > 0 && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDeleteMode((d) => !d)}
            className={`text-xs transition-colors ${
              deleteMode
                ? "font-medium text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {deleteMode ? "Done" : "Delete images"}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">
        Click an image to add to gallery · Click{" "}
        <span className="inline-block h-3 w-3 align-middle">
          <svg viewBox="0 0 24 24" fill="none">
            <path d={STAR_PATH} stroke={ACCENT} strokeWidth="1.5" />
          </svg>
        </span>{" "}
        to set as thumbnail
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((url, idx) => {
          const inGallery = galleryImages.includes(url);
          const isThumbnail = thumbnailUrl === url;
          const maskId = `star-mask-${idx}`;

          return (
            <div key={url} className="relative shrink-0">
              {/* Main image */}
              <button
                type="button"
                onClick={() => !deleteMode && onGalleryToggle(url)}
                className={`relative h-24 w-32 overflow-hidden rounded-lg transition-all ${
                  deleteMode
                    ? "cursor-default opacity-90"
                    : inGallery
                    ? "ring-2 ring-[#7c6ca8] opacity-100"
                    : "opacity-50 hover:opacity-75"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>

              {/* Delete mode: red X — Normal mode: star */}
              {deleteMode ? (
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                  title="Remove image"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onThumbnailSelect(url);
                  }}
                  className="absolute right-1.5 top-1.5"
                  title="Set as thumbnail"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <defs>
                      <mask id={maskId}>
                        <rect width="24" height="24" rx="4" fill="white" />
                        <path d={STAR_PATH} fill="black" />
                      </mask>
                    </defs>
                    <rect
                      width="24"
                      height="24"
                      rx="4"
                      fill={isThumbnail ? ACCENT : "rgba(0,0,0,0.55)"}
                      mask={`url(#${maskId})`}
                    />
                    <path
                      d={STAR_PATH}
                      fill="none"
                      stroke={isThumbnail ? "white" : "rgba(255,255,255,0.5)"}
                      strokeWidth="0.75"
                    />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {/* Import image button — always last, hidden in delete mode */}
        {!deleteMode && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-24 w-32 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-xs">Import image</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                await onUpload(file);
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
