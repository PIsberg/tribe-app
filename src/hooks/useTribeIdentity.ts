import { useState, useCallback } from "react";
import { avatarDataUrl } from "../utils/avatar";
import { ADMIN_TOKEN_KEY } from "./useAdmin";

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
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isLegacyUserId(userId: string): boolean {
  return /^[a-z0-9]+-[a-z0-9]{7}$/.test(userId);
}

function loadOrCreate(): Stored {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      if (parsed.userId && parsed.avatarSeed) {
        const userId = isLegacyUserId(parsed.userId) ? generateUserId() : parsed.userId;
        const stored: Stored = {
          userId,
          tribeName: parsed.tribeName ?? "",
          avatarSeed: userId === parsed.userId ? parsed.avatarSeed : userId,
          nameChosen: parsed.nameChosen ?? false,
        };
        if (userId !== parsed.userId) localStorage.setItem(IDENTITY_KEY, JSON.stringify(stored));
        return stored;
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
  const isAdmin = !!sessionStorage.getItem(ADMIN_TOKEN_KEY);

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
