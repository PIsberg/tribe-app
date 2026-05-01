import { useState, useCallback } from "react";
import { generateTribeName, generateUserId } from "../utils/tribeNames";
import { avatarDataUrl } from "../utils/avatar";

export type TribeIdentity = {
  userId: string;
  tribeName: string;
  avatarUrl: string;
  avatarSeed: string;
  nameChosen: boolean;
};

const IDENTITY_KEY = "tribe:identity";

type Stored = Omit<TribeIdentity, "avatarUrl">;

function loadOrCreate(): Stored {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed.userId && parsed.tribeName && parsed.avatarSeed) {
        return { ...parsed, nameChosen: parsed.nameChosen ?? false };
      }
    }
  } catch {
    // corrupt — regenerate
  }
  const userId = generateUserId();
  const tribeName = generateTribeName();
  const avatarSeed = `${userId}-${tribeName}`;
  const fresh: Stored = { userId, tribeName, avatarSeed, nameChosen: false };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(fresh));
  return fresh;
}

export function useTribeIdentity(): TribeIdentity & { setTribeName: (name: string) => void } {
  const [stored, setStored] = useState<Stored>(loadOrCreate);

  const setTribeName = useCallback((name: string) => {
    setStored((prev) => {
      const next: Stored = { ...prev, tribeName: name, nameChosen: true };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { ...stored, avatarUrl: avatarDataUrl(stored.avatarSeed), setTribeName };
}
