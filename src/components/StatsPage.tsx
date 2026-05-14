import { useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(n: number, capped?: boolean): string {
  if (capped) return "10k+";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function FlipNumber({ value, capped }: { value: number; capped?: boolean }) {
  const label = fmt(value, capped);
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

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fire-glow/80">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fire-glow opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fire-glow" />
      </span>
      live
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  capped?: boolean;
  sub?: string;
  large?: boolean;
}

function StatCard({ label, value, capped, sub, large }: StatCardProps) {
  return (
    <motion.div
      className="rounded-2xl border border-fire-ember/25 bg-[#050f05] px-4 py-4 flex flex-col gap-1"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <span className="font-mono text-[9px] uppercase tracking-widest text-fire-char/50">{label}</span>
      <span className={`font-mono font-bold text-white leading-none ${large ? "text-4xl" : "text-2xl"}`}>
        <FlipNumber value={value} capped={capped} />
      </span>
      {sub && <span className="font-mono text-[9px] text-fire-char/40">{sub}</span>}
    </motion.div>
  );
}

function Sparkline({ buckets }: { buckets: number[] }) {
  const max = Math.max(...buckets, 1);
  const total = buckets.reduce((a, b) => a + b, 0);
  const barW = 100 / buckets.length;

  return (
    <motion.div
      className="rounded-2xl border border-fire-ember/25 bg-[#050f05] px-5 py-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[9px] uppercase tracking-widest text-fire-char/50">
          Messages · last 60 min
        </span>
        <span className="font-mono text-xs text-fire-ember font-bold">{total} total</span>
      </div>
      <svg viewBox="0 0 100 32" className="w-full" preserveAspectRatio="none" style={{ height: 48 }}>
        {buckets.map((v, i) => {
          const h = (v / max) * 28;
          const x = i * barW + barW * 0.1;
          const w = barW * 0.8;
          return (
            <g key={i}>
              <rect
                x={x}
                y={32 - h}
                width={w}
                height={h}
                rx={1}
                fill="#ff5722"
                opacity={0.15}
              />
              <motion.rect
                key={`${i}-${v}`}
                x={x}
                y={32 - h}
                width={w}
                height={h}
                rx={1}
                fill="#ff5722"
                initial={{ height: 0, y: 32 }}
                animate={{ height: h, y: 32 - h }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[8px] text-fire-char/30">60m ago</span>
        <span className="font-mono text-[8px] text-fire-char/30">now</span>
      </div>
    </motion.div>
  );
}

function HottestList({ tribes }: { tribes: { _id: string; name: string; lastActivity: number; memberCount: number }[] }) {
  return (
    <motion.div
      className="rounded-2xl border border-fire-ember/25 bg-[#050f05] px-5 py-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.2 }}
    >
      <span className="font-mono text-[9px] uppercase tracking-widest text-fire-char/50 block mb-3" data-testid="stats-hottest-header">
        Hottest campfires
      </span>
      {tribes.length === 0 ? (
        <p className="font-mono text-xs text-fire-char/40 text-center py-4">
          No fires lit yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tribes.map((t, i) => (
            <motion.div
              key={t._id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
            >
              <span className="font-mono text-[10px] text-fire-ember/50 w-4 shrink-0">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-sm text-white font-medium truncate">
                    {t.name}
                  </span>
                  <span className="font-mono text-[9px] text-fire-char/40 shrink-0">
                    {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-fire-char/30">
                  {timeAgo(t.lastActivity)}
                </span>
              </div>
              <span className="text-base shrink-0" aria-hidden>🔥</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div className="rounded-2xl border border-fire-ember/10 bg-[#050f05] px-4 py-4 flex flex-col gap-2 animate-pulse">
      <div className="h-2 w-16 rounded bg-fire-ash/40" />
      <div className={`rounded bg-fire-ash/30 ${large ? "h-9 w-12" : "h-6 w-8"}`} />
    </div>
  );
}

export function StatsPage() {
  const stats = useQuery(api.stats.getNetworkStats);
  const loading = stats === undefined;

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 pb-16 pt-10 overflow-y-auto" data-testid="stats-page">
      {/* Hero */}
      <div className="text-center mb-10">
        <motion.div
          className="text-5xl mb-4 select-none"
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.div>
        <motion.h1
          className="font-mono text-2xl font-bold text-white tracking-tight uppercase"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          Tribe Network
        </motion.h1>
        <motion.p
          className="font-mono text-[10px] text-fire-char/50 uppercase tracking-widest mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          live state of the fire
        </motion.p>
        <motion.div
          className="mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <LiveDot />
        </motion.div>
      </div>

      {/* Hero tiles — 3-column */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {loading ? (
          <>
            <SkeletonCard large />
            <SkeletonCard large />
            <SkeletonCard large />
          </>
        ) : (
          <>
            <StatCard label="Live now" value={stats.liveUsers} large sub="users typing" />
            <StatCard label="Active fires" value={stats.activeTribes} large sub="last 24h" />
            <StatCard
              label="Messages"
              value={stats.messagesLast30Min}
              capped={stats.messagesLast30MinCapped}
              large
              sub="last 30m"
            />
          </>
        )}
      </div>

      {/* Secondary grid — 2-column */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Speakers"
              value={stats.activeSpeakersLast30Min}
              sub="unique in 30m"
            />
            <StatCard
              label="Reactions"
              value={stats.reactionsLast30Min}
              sub="last 30m"
            />
            <StatCard
              label="Threads"
              value={stats.threadsActive}
              sub="active in 30m"
            />
            <StatCard
              label="Campfires lit"
              value={stats.totalTribes}
              capped={stats.totalTribesCapped}
              sub="all time"
            />
          </>
        )}
      </div>

      {/* Sparkline */}
      {loading ? (
        <div className="rounded-2xl border border-fire-ember/10 bg-[#050f05] px-5 py-4 mb-3 animate-pulse h-24" />
      ) : (
        <div className="mb-3">
          <Sparkline buckets={stats.sparkline} />
        </div>
      )}

      {/* Hottest campfires */}
      {loading ? (
        <div className="rounded-2xl border border-fire-ember/10 bg-[#050f05] px-5 py-5 mb-6 animate-pulse h-32" />
      ) : (
        <div className="mb-6">
          <HottestList tribes={stats.hottest} />
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-auto pt-4 space-y-2">
        <p className="font-mono text-[9px] text-fire-char/25 leading-relaxed">
          Counts above 10,000 shown as 10k+.
          <br />
          All stats refresh live via Convex reactive queries.
        </p>
        <button
          onClick={() => {
            window.history.pushState(null, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-fire-char/40 hover:text-fire-ember/70 transition-colors"
        >
          ← back to tribe
        </button>
      </div>
    </div>
  );
}
