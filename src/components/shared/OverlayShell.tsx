"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Header-right content (e.g. Done button). If omitted, just shows close button. */
  headerRight?: React.ReactNode;
  /** Max width of the panel (tailwind class). Default max-w-2xl. */
  maxWidth?: string;
  children: React.ReactNode;
};

/**
 * Reusable centered-modal shell: backdrop, panel, header with title + close.
 * The panel is a vertical flex column — children get flex-1 overflow-y-auto naturally.
 */
export default function OverlayShell({
  open,
  onClose,
  title,
  headerRight,
  maxWidth = "max-w-2xl",
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/30"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className={`mx-4 mb-8 mt-28 flex w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-light hover:text-foreground"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
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
        </div>

        {children}
      </div>
    </div>
  );
}
