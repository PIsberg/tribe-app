import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import type { TribeIdentity } from "../hooks/useTribeIdentity";

interface Props {
  identity: TribeIdentity;
  tribeName: string;
  onLeave: () => void;
  memberCount?: number;
}

export function TribeHeader({ identity, tribeName, onLeave, memberCount }: Props) {
  return (
    <motion.header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-fire-ember/20 bg-[#051a05]/80 backdrop-blur-md"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
    >
      {/* Leave button */}
      <button
        onClick={onLeave}
        className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-2 py-1 rounded-lg hover:bg-fire-ash/40"
        aria-label="Leave tribe"
      >
        ← Leave
      </button>

      {/* Flame + title */}
      <div className="flex-1 flex items-center gap-2">
        <motion.span
          className="text-xl select-none"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.span>
        <div>
          <div className="font-mono text-sm font-bold text-white truncate max-w-[160px]">
            {tribeName}
          </div>
          {memberCount != null && (
            <div className="font-mono text-[10px] text-fire-char/60">
              {memberCount} around the fire
            </div>
          )}
        </div>
      </div>

      {/* Identity chip */}
      <div className="flex items-center gap-2 bg-fire-ash/50 rounded-lg px-2.5 py-1.5 border border-fire-char/30">
        <Avatar url={identity.avatarUrl} name={identity.tribeName} size={24} />
        <span className="font-mono text-xs text-fire-glow font-bold truncate max-w-[120px]">
          {identity.tribeName}
        </span>
      </div>
    </motion.header>
  );
}
