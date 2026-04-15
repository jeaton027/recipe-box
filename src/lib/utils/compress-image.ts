/**
 * Client-side image compression.
 * Resizes to fit within maxDim and re-encodes as WebP.
 * Only applies to new uploads — existing images are untouched.
 */

const MAX_DIM = 1200;
const QUALITY = 0.6;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file: File): Promise<File> {
  // Skip non-image files or SVGs (can't canvas-compress SVG well)
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const img = await loadImage(file);
  let { naturalWidth: w, naturalHeight: h } = img;

  // If already small enough and already webp, skip
  if (w <= MAX_DIM && h <= MAX_DIM && file.type === "image/webp" && file.size < 200_000) {
    URL.revokeObjectURL(img.src);
    return file;
  }

  // Scale down if needed
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/webp", QUALITY);
  });

  // Return as a File so the upload code can use it seamlessly
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}
