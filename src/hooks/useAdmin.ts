import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const TOKEN_KEY = "tribe:admin-token";
const TOKEN_CHANGE_EVENT = "tribe:admin-token-change";

export type AdminHook = {
  isAdmin: boolean;
  token: string | null;
  login: (pwd: string) => Promise<boolean>;
  logout: () => void;
};

export function useAdmin(): AdminHook {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const verifyMutation = useMutation(api.admin.verifyToken);

  // Keep all useAdmin() instances in sync when login/logout fires anywhere.
  // Also handles cross-tab logout via the native "storage" event.
  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      setToken((prev) => (prev === stored ? prev : stored));
    };
    window.addEventListener(TOKEN_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TOKEN_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const login = useCallback(
    async (pwd: string): Promise<boolean> => {
      const startedAt = Date.now();
      try {
        const valid = await verifyMutation({ token: pwd });
        const tookMs = Date.now() - startedAt;
        if (valid) {
          console.info("[admin] login OK", { inputLength: pwd.length, tookMs });
          localStorage.setItem(TOKEN_KEY, pwd);
          setToken(pwd);
          window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
          return true;
        }
        console.warn("[admin] login REJECTED", {
          inputLength: pwd.length,
          tookMs,
          hint:
            "verifyToken returned false. Check `npx convex env list` shows ADMIN_TOKEN, " +
            "and that what you typed matches its value. Surrounding quotes shown by " +
            "`env list` are display formatting, not part of the value.",
        });
        return false;
      } catch (err) {
        console.error("[admin] login ERROR", {
          inputLength: pwd.length,
          tookMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
          hint:
            "The verifyToken mutation threw. Common causes: convex/admin.ts not " +
            "deployed (run `npx convex dev`), Convex unreachable, or a server bug.",
        });
        return false;
      }
    },
    [verifyMutation]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return { isAdmin: !!token, token, login, logout };
}
