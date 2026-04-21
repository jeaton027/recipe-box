"use client";

import { useEffect, useState } from "react";

// Minimal typing for the Screen Wake Lock API. Lib.dom in older TS configs
// doesn't always ship these, so we declare just what we touch.
type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};
type WakeLockAPI = {
  request: (type: "screen") => Promise<WakeLockSentinel>;
};

export type WakeLockStatus =
  | "active" // holding the lock
  | "unsupported" // browser lacks the API entirely
  | "failed"; // browser has the API but refused (permissions, policy, battery, etc.)

/**
 * Keep the screen awake while `enabled` is true. No-op when disabled.
 *
 * Behavior:
 *   - Requests a screen wake lock on mount / when enabled flips true
 *   - Automatically re-acquires when the tab returns to the foreground
 *     (browsers release the lock whenever a tab loses visibility)
 *   - Releases on unmount or when enabled flips false
 *
 * Returns a status so the caller can render a warning in the "failed" /
 * "unsupported" cases. Happy path returns "active" and should be silent.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus | null {
  const [status, setStatus] = useState<WakeLockStatus | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      return;
    }

    const api = (navigator as unknown as { wakeLock?: WakeLockAPI }).wakeLock;
    if (!api) {
      setStatus("unsupported");
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const s = await api!.request("screen");
        if (cancelled) {
          // Component unmounted or disabled while we were awaiting
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
        setStatus("active");

        // Browsers release wake locks automatically on visibility change.
        // Use "release" event to clear local ref; re-acquisition is handled
        // by the visibilitychange listener below.
        s.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && !sentinel && !cancelled) {
        acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [enabled]);

  return status;
}
