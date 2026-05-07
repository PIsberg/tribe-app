import { useState } from "react";
import { motion } from "framer-motion";
import { useAdmin } from "../hooks/useAdmin";

interface Props {
  returnTo: string;
}

export function AdminLogin({ returnTo }: Props) {
  const { login } = useAdmin();
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwd.trim() || loading) return;
    setLoading(true);
    setError(false);
    const ok = await login(pwd.trim());
    if (ok) {
      window.history.pushState(null, "", returnTo);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6">
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-fire-ember/30 bg-[#050f05] px-6 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3 select-none">🛡️</div>
          <h1 className="font-mono text-lg font-bold text-white uppercase tracking-widest">
            Admin Access
          </h1>
          <p className="font-mono text-[10px] text-fire-char/40 mt-1 uppercase tracking-widest">
            Enter the token to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setError(false); }}
            placeholder="Admin token"
            autoFocus
            data-testid="admin-password-input"
            className="w-full bg-fire-ash/60 border border-fire-char/30 rounded-xl px-4 py-3 text-sm text-white placeholder-fire-char/40 font-mono outline-none focus:border-fire-ember/50 focus:ring-1 focus:ring-fire-ember/20 transition-all"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-mono text-xs text-fire-ember text-center"
              data-testid="admin-login-error"
            >
              Invalid token.
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={!pwd.trim() || loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl bg-fire-ember font-mono text-sm font-bold text-white uppercase tracking-widest disabled:opacity-40 transition-opacity"
            style={{ boxShadow: "0 0 16px rgba(255,69,0,0.3)" }}
            data-testid="admin-login-submit"
          >
            {loading ? "Checking…" : "Unlock"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
