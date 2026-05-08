import { useState, useCallback } from "react";
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

function generateUserId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadOrCreate(): Stored {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      if (parsed.userId && parsed.avatarSeed) {
        return {
          userId: parsed.userId,
          tribeName: parsed.tribeName ?? "",
          avatarSeed: parsed.avatarSeed,
          nameChosen: parsed.nameChosen ?? false,
        };
      }
    }
  } catch {
    // corrupt — regenerate
  }
  const userId = generateUserId();
  const fresh: Stored = { userId, tribeName: "", avatarSeed: userId, nameChosen: false };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(fresh));
  return fresh;
}

export function useTribeIdentity(): TribeIdentity & { setTribeName: (name: string) => void } {
  const [stored, setStored] = useState<Stored>(loadOrCreate);
  const isAdmin = !!localStorage.getItem("tribe:admin-token");

  const setTribeName = useCallback((name: string) => {
    setStored((prev) => {
      const next: Stored = { ...prev, tribeName: name, nameChosen: true };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const effective: Stored = isAdmin
    ? { ...stored, tribeName: "@Tribe-admin", nameChosen: true }
    : stored;

  return { ...effective, avatarUrl: avatarDataUrl(stored.avatarSeed), setTribeName };
}
