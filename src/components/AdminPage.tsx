import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAdmin } from "../hooks/useAdmin";
import { useTribeIdentity } from "../hooks/useTribeIdentity";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTribe = {
  _id: string;
  name: string;
  lat: number;
  lng: number;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
  memberCount: number;
  kickedBannedCount: number;
  messageCount: number;
};

type SortKey = "lastActivity" | "createdDesc" | "createdAsc" | "memberCount" | "messageCount";
type StatusFilter = "all" | "active" | "expired";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ─── Member list for expanded rows ───────────────────────────────────────────

function MemberAdminList({
  tribeId,
  token,
}: {
  tribeId: string;
  token: string;
}) {
  const members = useQuery(api.members.list, {
    tribeId: tribeId as Id<"tribes">,
  });
  const kickMutation = useMutation(api.admin.kickMember);
  const banMutation = useMutation(api.admin.banMember);
  const unkickMutation = useMutation(api.admin.unkickMember);

  if (!members) {
    return (
      <div className="py-3 text-center font-mono text-[10px] text-fire-char/30 animate-pulse">
        Loading members…
      </div>
    );
  }
  if (members.length === 0) {
    return (
      <div className="py-3 text-center font-mono text-[10px] text-fire-char/30">
        No members.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pt-2">
      {members.map((m) => {
        const mid = m._id as Id<"tribeMembers">;
        const isBot = m.userId.startsWith("bot-");
        const statusTag = m.banned
          ? "banned"
          : m.kicked
          ? "kicked"
          : null;
        return (
          <div
            key={m._id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-fire-ash/30"
          >
            <span className="font-mono text-xs text-white truncate flex-1">
              {m.userName}
              {isBot && (
                <span className="ml-1 text-[9px] text-fire-char/40">[bot]</span>
              )}
            </span>
            {statusTag && (
              <span
                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded ${
                  statusTag === "banned"
                    ? "bg-red-900/40 text-red-400"
                    : "bg-fire-ash text-fire-char/60"
                }`}
              >
                {statusTag}
              </span>
            )}
            {!isBot && (
              <div className="flex gap-1 shrink-0">
                {statusTag ? (
                  <button
                    onClick={() => void unkickMutation({ token, memberId: mid })}
                    className="font-mono text-[9px] px-2 py-0.5 rounded border border-fire-char/20 text-fire-char/50 hover:border-fire-glow/40 hover:text-fire-glow transition-colors"
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => void kickMutation({ token, memberId: mid })}
                      className="font-mono text-[9px] px-2 py-0.5 rounded border border-fire-char/20 text-fire-char/50 hover:border-fire-ember/40 hover:text-fire-ember transition-colors"
                    >
                      Kick
                    </button>
                    <button
                      onClick={() => void banMutation({ token, memberId: mid })}
                      className="font-mono text-[9px] px-2 py-0.5 rounded border border-fire-char/20 text-fire-char/50 hover:border-red-500/40 hover:text-red-400 transition-colors"
                    >
                      Ban
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline read-only tribe view ──────────────────────────────────────────────

function TribeViewOverlay({
  tribe,
  onClose,
}: {
  tribe: AdminTribe;
  onClose: () => void;
}) {
  const messages = useQuery(api.messages.list, {
    tribeId: tribe._id as Id<"tribes">,
  });
  const members = useQuery(api.members.list, {
    tribeId: tribe._id as Id<"tribes">,
  });

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col bg-[#051a05]"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-fire-ember/15">
        <button
          onClick={onClose}
          className="font-mono text-xs text-fire-char/50 hover:text-fire-ember transition-colors"
        >
          ← Admin
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-bold text-white truncate">
            {tribe.name}
          </p>
          <p className="font-mono text-[9px] text-fire-char/40 uppercase tracking-widest">
            👁 Read-only view
          </p>
        </div>
        <span
          className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded-full border ${
            tribe.isActive
              ? "border-fire-ember/40 text-fire-ember/80"
              : "border-fire-char/20 text-fire-char/40"
          }`}
        >
          {tribe.isActive ? "active" : "expired"}
        </span>
      </div>

      {/* Member strip */}
      <div className="flex gap-2 px-4 py-2 border-b border-fire-ember/10 overflow-x-auto">
        {(members ?? [])
          .filter((m) => !m.kicked && !m.banned)
          .map((m) => (
            <span
              key={m._id}
              className="font-mono text-[10px] text-fire-char/60 whitespace-nowrap"
            >
              {m.userName}
            </span>
          ))}
        {!members && (
          <span className="font-mono text-[10px] text-fire-char/30 animate-pulse">
            Loading…
          </span>
        )}
      </div>

      {/* Message feed (read-only) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {!messages && (
          <p className="font-mono text-xs text-fire-char/30 text-center mt-8 animate-pulse">
            Loading messages…
          </p>
        )}
        {messages?.length === 0 && (
          <p className="font-mono text-xs text-fire-char/30 text-center mt-8">
            No messages in the last 30 minutes.
          </p>
        )}
        {(messages ?? []).map((msg) => (
          <div key={msg._id} className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] text-fire-char/50">
              {msg.author}
            </span>
            <div className="rounded-xl bg-fire-ash/40 px-3 py-2 font-mono text-sm text-white">
              {msg.text}
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt=""
                  className="mt-2 max-h-40 rounded-lg object-cover"
                />
              )}
            </div>
            <span className="font-mono text-[9px] text-fire-char/30">
              {timeAgo(msg.timestamp)}
              {(msg.likes?.length ?? 0) > 0 && (
                <> · ❤ {msg.likes.length}</>
              )}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Single tribe row ─────────────────────────────────────────────────────────

function TribeRow({
  tribe,
  token,
  onJoin,
  onView,
  onDelete,
}: {
  tribe: AdminTribe;
  token: string;
  onJoin: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="rounded-2xl border border-fire-ember/20 bg-[#050f05] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      data-testid="admin-tribe-row"
    >
      {/* Main row */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white truncate">
                🔥 {tribe.name}
              </span>
              <span
                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-full border ${
                  tribe.isActive
                    ? "border-fire-ember/40 text-fire-ember/80"
                    : "border-fire-char/20 text-fire-char/40"
                }`}
              >
                {tribe.isActive ? "active" : "expired"}
              </span>
            </div>
            <p className="font-mono text-[10px] text-fire-char/40 mt-0.5">
              Created {timeAgo(tribe.createdAt)} · last activity{" "}
              {timeAgo(tribe.lastActivity)} · {tribe.memberCount}{" "}
              {tribe.memberCount === 1 ? "member" : "members"} ·{" "}
              {tribe.messageCount} msg
              {tribe.kickedBannedCount > 0 && (
                <span className="text-fire-ember/70">
                  {" "}· ⚠ {tribe.kickedBannedCount} kicked/banned
                </span>
              )}
            </p>
            <a
              href={mapsUrl(tribe.lat, tribe.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[9px] text-fire-char/30 hover:text-fire-glow/60 transition-colors"
            >
              {tribe.lat.toFixed(4)}, {tribe.lng.toFixed(4)} ↗
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mt-2">
          {tribe.isActive && (
            <button
              onClick={onJoin}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg bg-fire-ember/20 border border-fire-ember/40 text-fire-ember hover:bg-fire-ember/30 transition-colors"
              data-testid="admin-join-btn"
            >
              Join
            </button>
          )}
          <button
            onClick={onView}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-fire-char/20 text-fire-char/50 hover:border-fire-char/40 hover:text-white transition-colors"
            data-testid="admin-view-btn"
          >
            View
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-fire-char/20 text-fire-char/50 hover:border-fire-char/40 hover:text-white transition-colors"
          >
            {expanded ? "▲ Members" : "▼ Members"}
          </button>
          <button
            onClick={onDelete}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-900/40 text-red-500/70 hover:border-red-500/50 hover:text-red-400 transition-colors ml-auto"
            data-testid="admin-delete-btn"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded member list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="members"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-fire-ember/10 px-4 pb-3"
          >
            <MemberAdminList
              tribeId={tribe._id}
              token={token}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main admin page ──────────────────────────────────────────────────────────

export function AdminPage() {
  const { token, logout } = useAdmin();
  const identity = useTribeIdentity();
  const adminJoinMutation = useMutation(api.admin.adminJoinTribe);
  const deleteTribeMutation = useMutation(api.admin.deleteTribe);

  const tribes = useQuery(
    api.admin.listAllTribes,
    token ? { token } : "skip"
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("lastActivity");
  const [viewTribe, setViewTribe] = useState<AdminTribe | null>(null);

  const filtered = useMemo(() => {
    if (!tribes) return [];
    let list = tribes as AdminTribe[];

    if (status === "active") list = list.filter((t) => t.isActive);
    if (status === "expired") list = list.filter((t) => !t.isActive);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }

    const sorted = [...list];
    switch (sort) {
      case "lastActivity":
        sorted.sort((a, b) => b.lastActivity - a.lastActivity);
        break;
      case "createdDesc":
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "createdAsc":
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "memberCount":
        sorted.sort((a, b) => b.memberCount - a.memberCount);
        break;
      case "messageCount":
        sorted.sort((a, b) => b.messageCount - a.messageCount);
        break;
    }
    return sorted;
  }, [tribes, search, status, sort]);

  const handleJoin = async (tribe: AdminTribe) => {
    if (!token) return;
    await adminJoinMutation({
      token,
      tribeId: tribe._id as Id<"tribes">,
      userId: identity.userId,
      avatarSeed: identity.avatarSeed,
    });
    window.history.pushState(null, "", `/#${tribe._id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleDelete = async (tribe: AdminTribe) => {
    if (!token) return;
    if (!confirm(`Delete campfire "${tribe.name}" and all its data? This cannot be undone.`))
      return;
    await deleteTribeMutation({
      token,
      tribeId: tribe._id as Id<"tribes">,
    });
  };

  return (
    <div className="relative flex flex-col min-h-[100dvh]">
      {/* Inline view overlay */}
      <AnimatePresence>
        {viewTribe && (
          <TribeViewOverlay
            tribe={viewTribe}
            onClose={() => setViewTribe(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-fire-ember/15 bg-[#051a05]/95 backdrop-blur-md">
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
            🛡️ Tribe Admin
          </h1>
          <p className="font-mono text-[9px] text-fire-char/40 uppercase tracking-widest">
            {tribes ? `${tribes.length} campfire${tribes.length !== 1 ? "s" : ""} total` : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => {
            window.history.pushState(null, "", "/stats");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-fire-char/40 hover:text-fire-glow/70 transition-colors px-2 py-1 rounded-lg border border-fire-char/15 hover:border-fire-char/30"
        >
          📊 Stats
        </button>
        <button
          onClick={logout}
          className="font-mono text-[10px] uppercase tracking-widest text-fire-char/40 hover:text-fire-ember transition-colors px-2 py-1 rounded-lg border border-fire-char/15 hover:border-fire-ember/30"
          data-testid="admin-logout-btn"
        >
          Logout
        </button>
      </div>

      {/* Filter / sort bar */}
      <div className="sticky top-[52px] z-10 flex flex-wrap gap-2 px-4 py-2.5 border-b border-fire-ember/10 bg-[#051a05]/90 backdrop-blur-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campfires…"
          data-testid="admin-search"
          className="flex-1 min-w-[140px] bg-fire-ash/50 border border-fire-char/25 rounded-lg px-3 py-1.5 font-mono text-xs text-white placeholder-fire-char/35 outline-none focus:border-fire-ember/40 transition-all"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          data-testid="admin-status-filter"
          className="bg-fire-ash/50 border border-fire-char/25 rounded-lg px-2 py-1.5 font-mono text-xs text-fire-char/70 outline-none focus:border-fire-ember/40 transition-all"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          data-testid="admin-sort"
          className="bg-fire-ash/50 border border-fire-char/25 rounded-lg px-2 py-1.5 font-mono text-xs text-fire-char/70 outline-none focus:border-fire-ember/40 transition-all"
        >
          <option value="lastActivity">Most active</option>
          <option value="createdDesc">Newest</option>
          <option value="createdAsc">Oldest</option>
          <option value="memberCount">Most members</option>
          <option value="messageCount">Most messages</option>
        </select>
      </div>

      {/* Tribe list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3" data-testid="admin-tribe-list">
        {!tribes && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-fire-ember/10 bg-[#050f05] h-24 animate-pulse"
              />
            ))}
          </div>
        )}

        {tribes && filtered.length === 0 && (
          <p className="font-mono text-sm text-fire-char/40 text-center mt-16">
            No campfires match.
          </p>
        )}

        {filtered.map((tribe) => (
          <TribeRow
            key={tribe._id}
            tribe={tribe}
            token={token ?? ""}
            onJoin={() => void handleJoin(tribe)}
            onView={() => setViewTribe(tribe)}
            onDelete={() => void handleDelete(tribe)}
          />
        ))}
      </div>

      {/* Footer */}
      {tribes && (
        <div className="text-center py-3 border-t border-fire-ember/10">
          <p className="font-mono text-[9px] text-fire-char/25">
            {filtered.length} of {tribes.length} campfires · refreshed live
          </p>
          <button
            onClick={() => {
              window.history.pushState(null, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="font-mono text-[9px] uppercase tracking-widest text-fire-char/25 hover:text-fire-ember/50 transition-colors mt-1"
          >
            ← Back to app
          </button>
        </div>
      )}
    </div>
  );
}
