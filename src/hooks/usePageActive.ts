import { useEffect, useState } from "react";

const IDLE_GRACE_MS = 30_000;

/**
 * `true` while the page is visible (or was very recently), `false` otherwise.
 *
 * Used to gate reactive Convex subscriptions so background tabs don't keep
 * paying the push-fan-out cost of a busy fire. When the user comes back, the
 * subscription re-opens and the latest snapshot streams in.
 *
 * Brief tab-switches don't churn the subscription — only sustained hidden
 * time past IDLE_GRACE_MS flips this to false.
 */
export function usePageActive(): boolean {
  const [active, setActive] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const onChange = () => {
      if (document.visibilityState === "visible") {
        if (hiddenTimer) {
          clearTimeout(hiddenTimer);
          hiddenTimer = null;
        }
        setActive(true);
      } else {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(() => setActive(false), IDLE_GRACE_MS);
      }
    };

    document.addEventListener("visibilitychange", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
      if (hiddenTimer) clearTimeout(hiddenTimer);
    };
  }, []);

  return active;
}
