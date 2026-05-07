import { useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { useAdmin } from "../hooks/useAdmin";
import { TribeAd } from "./TribeAd";

function FlipNumber({ value }: { value: number }) {
  const label = value.toLocaleString();
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={label}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
        className="tabular-nums"
      >
        {label}
      </motion.span>
    </AnimatePresence>
  );
}

function BigStatCard({
  emoji,
  label,
  value,
  delay = 0,
}: {
  emoji: string;
  label: string;
  value: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="rounded-2xl border border-fire-ember/25 bg-[#050f05] px-6 py-5 flex items-center gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay }}
    >
      <span className="text-3xl select-none" aria-hidden>{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-fire-char/50">
          {label}
        </p>
        <p className="font-mono text-3xl font-bold text-white leading-tight">
          <FlipNumber value={value} />
        </p>
      </div>
    </motion.div>
  );
}

function SkeletonBig() {
  return (
    <div className="rounded-2xl border border-fire-ember/10 bg-[#050f05] px-6 py-5 h-20 animate-pulse" />
  );
}

function formatTrackingSince(ts: number | null): string {
  if (!ts) return "Tracking begins on first event";
  const d = new Date(ts);
  return `Tracking since ${d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}

export function MetricsPage() {
  const { token } = useAdmin();
  const data = useQuery(
    api.metrics.getLifetimeMetrics,
    token ? { token } : "skip"
  );
  const loading = data === undefined;

  const avgMsgsPerUser =
    !loading && data.uniqueUsers > 0
      ? Math.round((data.messagesEver / data.uniqueUsers) * 10) / 10
      : null;
  const avgUsersPerTribe =
    !loading && data.tribesEver > 0
      ? Math.round((data.uniqueUsers / data.tribesEver) * 10) / 10
      : null;

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 pb-16 pt-10 overflow-y-auto" data-testid="metrics-page">
      {/* Hero */}
      <div className="text-center mb-10">
        <motion.div
          className="text-5xl mb-4 select-none"
          animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          📊
        </motion.div>
        <motion.h1
          className="font-mono text-2xl font-bold text-white tracking-tight uppercase"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          Lifetime Metrics
        </motion.h1>
        <motion.p
          className="font-mono text-[10px] text-fire-char/50 uppercase tracking-widest mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          every campfire, every voice
        </motion.p>
      </div>

      {/* Three big counter cards */}
      <div className="flex flex-col gap-3 mb-6">
        {loading ? (
          <>
            <SkeletonBig />
            <SkeletonBig />
            <SkeletonBig />
          </>
        ) : (
          <>
            <BigStatCard
              emoji="🔥"
              label="Campfires lit ever"
              value={data.tribesEver}
              delay={0.0}
            />
            <BigStatCard
              emoji="👥"
              label="Unique users seen"
              value={data.uniqueUsers}
              delay={0.05}
            />
            <BigStatCard
              emoji="💬"
              label="Messages sent ever"
              value={data.messagesEver}
              delay={0.1}
            />
          </>
        )}
      </div>

      {/* Ad unit */}
      <TribeAd slot={import.meta.env.VITE_ADSENSE_SLOT_METRICS} />

      {/* Derived stats */}
      {!loading && (avgMsgsPerUser !== null || avgUsersPerTribe !== null) && (
        <motion.div
          className="rounded-xl border border-fire-ember/10 bg-[#050f05]/60 px-5 py-3 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-fire-char/40 mb-1">
            Derived
          </p>
          <p className="font-mono text-xs text-fire-char/70 italic">
            {avgMsgsPerUser !== null && (
              <>~{avgMsgsPerUser} messages per user</>
            )}
            {avgMsgsPerUser !== null && avgUsersPerTribe !== null && " · "}
            {avgUsersPerTribe !== null && (
              <>~{avgUsersPerTribe} users per campfire</>
            )}
          </p>
        </motion.div>
      )}

      {/* Footer */}
      <div className="text-center mt-auto pt-4 space-y-2">
        <p className="font-mono text-[9px] text-fire-char/30 leading-relaxed">
          {!loading && formatTrackingSince(data.trackingSince)}
        </p>
        <p className="font-mono text-[9px] text-fire-char/25 leading-relaxed">
          Counters are sharded (10 shards) and increment-only.
          <br />
          Lifetime totals — never decrement when content expires.
        </p>
        <button
          onClick={() => {
            window.history.pushState(null, "", "/admin");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-fire-char/40 hover:text-fire-ember/70 transition-colors"
          data-testid="metrics-back-btn"
        >
          ← back to admin
        </button>
      </div>
    </div>
  );
}
