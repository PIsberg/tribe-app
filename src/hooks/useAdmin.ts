import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

const TOKEN_KEY = "tribe:admin-token";

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
  const convex = useConvex();

  const login = useCallback(
    async (pwd: string): Promise<boolean> => {
      const valid = await convex.query(api.admin.verifyToken, { token: pwd });
      if (valid) {
        localStorage.setItem(TOKEN_KEY, pwd);
        setToken(pwd);
      }
      return !!valid;
    },
    [convex]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return { isAdmin: !!token, token, login, logout };
}
