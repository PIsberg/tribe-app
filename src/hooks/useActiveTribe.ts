import { useState, useCallback } from "react";

const KEY = "tribe:activeTribeId";

function getInitialTribeId(): string | null {
  const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : null;
  if (hash) return hash;
  return localStorage.getItem(KEY);
}

export function useActiveTribe() {
  const [activeTribeId, setActiveTribeIdState] = useState<string | null>(getInitialTribeId);
  const [confirmedTribeId, setConfirmedTribeIdState] = useState<string | null>(null);

  const setActiveTribeId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(KEY, id);
    } else {
      localStorage.removeItem(KEY);
    }
    setActiveTribeIdState(id);
  }, []);

  const setConfirmedTribeId = useCallback((id: string | null) => {
    setConfirmedTribeIdState(id);
  }, []);

  return { activeTribeId, setActiveTribeId, confirmedTribeId, setConfirmedTribeId };
}
