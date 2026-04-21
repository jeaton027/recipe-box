"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteMenuButton({ menuId }: { menuId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("menus").delete().eq("id", menuId);
    if (error) {
      alert("Failed to delete: " + error.message);
      setDeleting(false);
      setConfirming(false);
    } else {
      router.push("/menus");
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-red-300 hover:text-red-500"
    >
      Delete
    </button>
  );
}
