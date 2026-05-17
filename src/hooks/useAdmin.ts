import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const ADMIN_TOKEN_KEY = "tribe:admin-token";
const TOKEN_CHANGE_EVENT = "tribe:admin-token-change";

export type AdminHook = {
  isAdmin: boolean;
  token: string | null;
  login: (pwd: string) => Promise<boolean>;
  logout: () => void;
};

function readToken(): string | null {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const legacyToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (legacyToken) {
    if (!token) sessionStorage.setItem(ADMIN_TOKEN_KEY, legacyToken);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return token ?? legacyToken;
  }
  return token;
}

export function useAdmin(): AdminHook {
  const [token, setToken] = useState<string | null>(readToken);
  const verifyMutation = useMutation(api.admin.verifyToken);

  // Keep all useAdmin() instances in this tab sync when login/logout fires anywhere.
  useEffect(() => {
    const sync = () => {
      const stored = readToken();
      setToken((prev) => (prev === stored ? prev : stored));
    };
    window.addEventListener(TOKEN_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener(TOKEN_CHANGE_EVENT, sync);
    };
  }, []);

  const login = useCallback(
    async (pwd: string): Promise<boolean> => {
      try {
        const valid = await verifyMutation({ token: pwd });
        if (valid) {
          sessionStorage.setItem(ADMIN_TOKEN_KEY, pwd);
          setToken(pwd);
          window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [verifyMutation]
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return { isAdmin: !!token, token, login, logout };
}
