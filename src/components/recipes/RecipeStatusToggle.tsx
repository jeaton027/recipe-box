"use client";

import { useState, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Status = "saved" | "tried" | "favorite";

type Props = {
  recipeId: string;
  initialStatus: Status;
  /** "cycle" (default): saved → tried → favorite → tried → …
   *  "reset": toggles between current initial status and "saved" */
  mode?: "cycle" | "reset";
};

// Detail page: saved → tried → favorite → tried → favorite …
function nextCycle(current: Status): Status {
  if (current === "saved") return "tried";
  if (current === "tried") return "favorite";
  return "tried"; // favorite → tried
}

function statusLabel(status: Status): string {
  if (status === "favorite") return "Favorite";
  if (status === "tried") return "Tried";
  return "Saved";
}

export default function RecipeStatusToggle({
  recipeId,
  initialStatus,
  mode = "cycle",
}: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // For "reset" mode: remember the non-saved status to toggle back to
  const originalRef = useRef<Status>(initialStatus);

  async function handleClick() {
    const prev = status;
    let next: Status;

    if (mode === "reset") {
      // If original was "saved", toggle to "tried" and back
      // Otherwise toggle between "saved" and the original non-saved status
      if (originalRef.current === "saved") {
        next = status === "saved" ? "tried" : "saved";
      } else {
        next = status === "saved" ? originalRef.current : "saved";
      }
    } else {
      next = nextCycle(status);
    }

    setStatus(next); // optimistic

    const supabase = createClient();
    const { error } = await supabase
      .from("recipes")
      .update({ status: next })
      .eq("id", recipeId);

    if (error) {
      setStatus(prev); // rollback
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  const isFavorite = status === "favorite";
  const isTried = status === "tried";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={statusLabel(status)}
      className="group relative flex items-center justify-center rounded-md p-1.5 hover:bg-accent-light/50"
    >
      <svg
        className={`h-6 w-6 ${
          isFavorite
            ? "fill-amber-400 text-amber-500"
            : isTried
            ? "fill-accent text-accent"
            : "fill-none text-muted group-hover:text-accent"
        }`}
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
        />
      </svg>
    </button>
  );
}
