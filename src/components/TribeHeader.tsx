import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  onEditName?: () => void;
  onShowManifesto?: () => void;
}

export function TribeHeader({
  identity,
  tribeName,
  tribeId,
  onLeave,
  memberCount,
  nearbyCount,
  onShowNearby,
  onEditName,
  onShowManifesto,
}: Props) {
  const shareUrl = `${window.location.origin}${window.location.pathname}#${tribeId}`;
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: tribeName, url: shareUrl });
        return;
      }
    } catch {
      // AbortError or unsupported — fall through to clipboard
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.header
      className="sticky top-0 z-20 flex items-center gap-1.5 px-2 py-2 border-b border-fire-ember/20 bg-[#051a05]/80 backdrop-blur-md"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
    >
      {/* Leave */}
      <button
        onClick={onLeave}
        className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-1.5 py-1 rounded-lg hover:bg-fire-ash/40 flex-shrink-0"
        aria-label="Leave tribe"
      >
        ←
      </button>

      {/* Flame + title */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <motion.span
          className="text-base select-none flex-shrink-0"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.span>
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-white truncate">
            {tribeName}
          </div>
          {memberCount != null && (
            <div className="font-mono text-[9px] text-fire-char/60 leading-none">
              {memberCount} around the fire
            </div>
          )}
        </div>
      </div>

      {/* Identity chip */}
      <button
        onClick={onEditName}
        className="flex items-center gap-1 bg-fire-ash/50 rounded-lg px-1.5 py-1 border border-fire-char/30 flex-shrink-0 hover:border-fire-ember/40 transition-colors"
        title="Change your name"
      >
        <Avatar url={identity.avatarUrl} name={identity.tribeName} size={18} />
        <span className="font-mono text-[11px] text-fire-glow font-bold truncate max-w-[56px]">
          {identity.tribeName}
        </span>
      </button>

      {/* Overflow menu button */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="relative font-mono text-sm text-fire-char/50 hover:text-fire-glow/80 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fire-ash/40 flex-shrink-0"
        aria-label="More options"
        aria-expanded={menuOpen}
      >
        ···
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="absolute top-full right-2 mt-1 z-40 bg-[#0d2010] border border-fire-ember/25 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              <button
                onClick={() => { void handleShare(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 font-mono text-xs text-fire-smoke/80 hover:bg-fire-ash/50 hover:text-white transition-colors text-left"
                aria-label="Share campfire link"
              >
                <span>🔗</span>
                <span>{copied ? "✓ Copied!" : "Share link"}</span>
              </button>

              {onShowManifesto && (
                <button
                  onClick={() => { onShowManifesto(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 font-mono text-xs text-fire-smoke/80 hover:bg-fire-ash/50 hover:text-white transition-colors text-left"
                  aria-label="About this fire"
                >
                  <span>ℹ</span>
                  <span>About fire</span>
                </button>
              )}

              {onShowNearby && (
                <button
                  onClick={() => { onShowNearby(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 font-mono text-xs text-fire-smoke/80 hover:bg-fire-ash/50 hover:text-white transition-colors text-left"
                  aria-label="Show nearby campfires"
                >
                  <span>🗺️</span>
                  <span>
                    Nearby fires
                    {(nearbyCount ?? 0) > 0 && (
                      <span className="ml-1 text-fire-ember/80 font-bold">{nearbyCount}</span>
                    )}
                  </span>
                </button>
              )}

              <div className="h-px bg-fire-char/15 mx-2" />

              <button
                onClick={() => { onLeave(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 font-mono text-xs text-fire-ember/60 hover:bg-fire-ash/50 hover:text-fire-ember transition-colors text-left"
              >
                <span>🚶</span>
                <span>Leave fire</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
