import { useMemo } from "react";
import { generateTribeName, generateUserId } from "../utils/tribeNames";
import { avatarDataUrl } from "../utils/avatar";

export type TribeIdentity = {
  userId: string;
  tribeName: string;
  avatarUrl: string;
  avatarSeed: string;
};

export function useTribeIdentity(): TribeIdentity {
  return useMemo(() => {
    const stored = localStorage.getItem("tribe:identity");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Omit<TribeIdentity, "avatarUrl">;
        if (parsed.userId && parsed.tribeName && parsed.avatarSeed) {
          return { ...parsed, avatarUrl: avatarDataUrl(parsed.avatarSeed) };
        }
      } catch {
        // corrupt storage — regenerate
      }
    }

    const userId = generateUserId();
    const tribeName = generateTribeName();
    const avatarSeed = `${userId}-${tribeName}`;
    localStorage.setItem("tribe:identity", JSON.stringify({ userId, tribeName, avatarSeed }));
    return { userId, tribeName, avatarSeed, avatarUrl: avatarDataUrl(avatarSeed) };
  }, []);
}
