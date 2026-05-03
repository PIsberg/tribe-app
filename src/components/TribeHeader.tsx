import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import type { TribeIdentity } from "../hooks/useTribeIdentity";

interface Props {
  identity: TribeIdentity;
  tribeName: string;
  tribeId: string;
  onLeave: () => void;
  memberCount?: number;
  nearbyCount?: number;
  onShowNearby?: () => void;
}

export function TribeHeader({
  identity,
  tribeName,
  tribeId,
  onLeave,
  memberCount,
  nearbyCount,
  onShowNearby,
}: Props) {
  const shareUrl = `${window.location.origin}${window.location.pathname}#${tribeId}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: tribeName, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <motion.header
      className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 border-b border-fire-ember/20 bg-[#051a05]/80 backdrop-blur-md"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
    >
      {/* Leave button */}
      <button
        onClick={onLeave}
        className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-2 py-1 rounded-lg hover:bg-fire-ash/40 flex-shrink-0"
        aria-label="Leave tribe"
      >
        ← Leave
      </button>

      {/* Flame + title */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <motion.span
          className="text-lg select-none flex-shrink-0"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.span>
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-white truncate max-w-[120px]">
            {tribeName}
          </div>
          {memberCount != null && (
            <div className="font-mono text-[10px] text-fire-char/60">
              {memberCount} around the fire
            </div>
          )}
        </div>
      </div>

      {/* Share link button */}
      <button
        onClick={() => void handleShare()}
        className="font-mono text-[10px] text-fire-char/40 hover:text-fire-glow/70 transition-colors px-1.5 py-1 rounded-lg hover:bg-fire-ash/40 flex-shrink-0"
        aria-label="Share campfire link"
        title="Copy link"
      >
        🔗
      </button>

      {/* Nearby fires button */}
      {onShowNearby && (
        <button
          onClick={onShowNearby}
          className="flex items-center gap-1 font-mono text-[10px] text-fire-char/40 hover:text-fire-ember/70 transition-colors px-1.5 py-1 rounded-lg hover:bg-fire-ash/40 flex-shrink-0"
          aria-label="Show nearby campfires"
        >
          <span>🗺️</span>
          {(nearbyCount ?? 0) > 0 && (
            <span className="text-fire-ember/70">{nearbyCount}</span>
          )}
        </button>
      )}

      {/* Identity chip */}
      <div className="flex items-center gap-1.5 bg-fire-ash/50 rounded-lg px-2 py-1.5 border border-fire-char/30 flex-shrink-0">
        <Avatar url={identity.avatarUrl} name={identity.tribeName} size={20} />
        <span className="font-mono text-xs text-fire-glow font-bold truncate max-w-[80px]">
          {identity.tribeName}
        </span>
      </div>
    </motion.header>
  );
}
