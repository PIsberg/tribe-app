import { motion, AnimatePresence } from "framer-motion";
import { useState, type FormEvent } from "react";

const MAX_LEN = 32;
const NAME_MAX = 24;

interface Props {
  onSubmit: (tribeName: string, userName: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  defaultUserName?: string;
  nameOnly?: boolean;
}

export function CreateTribeForm({ onSubmit, onCancel, disabled, defaultUserName = "", nameOnly = false }: Props) {
  const [tribeName, setTribeName] = useState("");
  const [userName, setUserName] = useState(defaultUserName);
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const tribe = tribeName.trim();
    const user = userName.trim();
    if (!user) { setError("Tell us your name."); return; }
    if (user.length > NAME_MAX) { setError(`Your name max ${NAME_MAX} chars.`); return; }
    if (!nameOnly) {
      if (!tribe) { setError("Give your tribe a name."); return; }
      if (tribe.length > MAX_LEN) { setError(`Tribe name max ${MAX_LEN} chars.`); return; }
    }
    onSubmit(tribe, user);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Your name */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-fire-ember/70 mb-1.5">
            Your Name
          </label>
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(""); }}
              placeholder="e.g. Ghost Raven"
              maxLength={NAME_MAX}
              disabled={disabled}
              aria-label="Your name"
              className="w-full bg-fire-ash/60 border border-fire-char/40 focus:border-fire-ember/70 rounded-xl px-4 py-3 font-mono text-sm text-white placeholder-fire-char/40 outline-none focus:ring-1 focus:ring-fire-ember/20 transition-all disabled:opacity-40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-fire-char/40">
              {userName.length}/{NAME_MAX}
            </span>
          </div>
        </div>

        {/* Tribe name — hidden in nameOnly mode */}
        {!nameOnly && (
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-fire-ember/70 mb-1.5">
              Name Your Tribe
            </label>
            <div className="relative">
              <input
                type="text"
                value={tribeName}
                onChange={(e) => { setTribeName(e.target.value); setError(""); }}
                placeholder="e.g. Midnight Wolves"
                maxLength={MAX_LEN}
                disabled={disabled}
                aria-label="Tribe name"
                className="w-full bg-fire-ash/60 border border-fire-char/40 focus:border-fire-ember/70 rounded-xl px-4 py-3 font-mono text-sm text-white placeholder-fire-char/40 outline-none focus:ring-1 focus:ring-fire-ember/20 transition-all disabled:opacity-40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-fire-char/40">
                {tribeName.length}/{MAX_LEN}
              </span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="font-mono text-[11px] text-fire-ember"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <motion.button
            type="submit"
            disabled={disabled || (!nameOnly && !tribeName.trim()) || !userName.trim()}
            whileTap={{ scale: 0.96 }}
            className="flex-1 py-3 rounded-xl bg-fire-ember font-mono text-sm font-bold text-white uppercase tracking-widest disabled:opacity-40 transition-opacity glow-ember"
          >
            {nameOnly ? "Join the Fire 🔥" : "Light the Fire 🔥"}
          </motion.button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 rounded-xl border border-fire-char/30 font-mono text-xs text-fire-char/60 hover:border-fire-char/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}
