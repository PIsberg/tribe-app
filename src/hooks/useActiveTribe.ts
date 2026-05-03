import { useState, useCallback } from "react";

const KEY = "tribe:activeTribeId";

function getInitialTribeId(): string | null {
  const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : null;
  if (hash) return hash;
  return localStorage.getItem(KEY);
}

export function useActiveTribe() {
  const [activeTribeId, setActiveTribeIdState] = useState<string | null>(getInitialTribeId);

  const setActiveTribeId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(KEY, id);
    } else {
      localStorage.removeItem(KEY);
    }
    setActiveTribeIdState(id);
  }, []);

  return { activeTribeId, setActiveTribeId };
}
