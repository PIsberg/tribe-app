import { useState, useCallback } from "react";

const KEY = "tribe:activeTribeId";

export function useActiveTribe() {
  const [activeTribeId, setActiveTribeIdState] = useState<string | null>(
    () => localStorage.getItem(KEY)
  );

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
