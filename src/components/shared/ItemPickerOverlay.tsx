"use client";

import { useState } from "react";
import Image from "next/image";
import OverlayShell from "./OverlayShell";

export type PickerItem = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;

  items: PickerItem[];
  loading: boolean;
  memberIds: Set<string>;
  onToggle: (itemId: string) => void;

  /** Label for the "new item" button (e.g. "New Collection", "New Menu"). */
  newItemLabel: string;
  /** Placeholder for the inline new-item input. */
  newItemPlaceholder?: string;
  /** Create a new item and auto-add the target to it. Returns new item id. */
  onCreateItem: (name: string) => Promise<void>;

  /** Optional content rendered between the search bar and the "New X" button. */
  headerMiddle?: React.ReactNode;

  /** Text shown when no items exist at all. */
  emptyText?: string;
};

/**
 * Generic overlay for picking items from a list (with toggle membership + inline
 * create). Shared between "Save to Collection" and "Add to Menu".
 */
export default function ItemPickerOverlay({
  open,
  onClose,
  title,
  items,
  loading,
  memberIds,
  onToggle,
  newItemLabel,
  newItemPlaceholder = "Name...",
  onCreateItem,
  headerMiddle,
  emptyText = "Nothing here yet.",
}: Props) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setSearch("");
    setCreating(false);
    setNewName("");
    onClose();
  }

  async function handleCreate() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await onCreateItem(newName.trim());
      setCreating(false);
      setNewName("");
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const doneButton = (
    <button
      onClick={handleClose}
      className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
    >
      Done
    </button>
  );

  return (
    <OverlayShell
      open={open}
      onClose={handleClose}
      title={title}
      headerRight={doneButton}
    >
      {/* Top bar: search + middle slot + new item */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            autoFocus
          />
        </div>

        {headerMiddle}

        <button
          onClick={() => {
            setCreating(true);
            setSearch("");
          }}
          className="shrink-0 rounded-md bg-accent-light px-3.5 py-1.5 text-sm font-medium text-accent-dark transition-colors hover:bg-accent hover:text-white"
        >
          {newItemLabel}
        </button>
      </div>

      {/* Inline new item form */}
      {creating && (
        <div className="flex items-center gap-3 border-b border-border bg-accent-light/30 px-4 py-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder={newItemPlaceholder}
            autoFocus
            className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || saving}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Grid content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {items.length === 0 ? (
              <>
                {emptyText} Click <strong>{newItemLabel}</strong> above to create
                one.
              </>
            ) : (
              <>No results matching &ldquo;{search}&rdquo;</>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {filtered.map((item) => {
              const selected = memberIds.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  className="group overflow-hidden rounded-lg text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <div className="relative aspect-square bg-accent-light">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 200px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg
                          className="h-8 w-8 text-accent/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                          />
                        </svg>
                      </div>
                    )}
                    {selected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <svg
                          className="h-8 w-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="truncate px-1.5 py-1.5 text-xs font-medium leading-tight">
                    {item.name}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </OverlayShell>
  );
}
