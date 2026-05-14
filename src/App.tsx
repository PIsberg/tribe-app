import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { FireBackground } from "./components/FireBackground";
import { TribeHeader } from "./components/TribeHeader";
import { TribeLanding } from "./components/TribeLanding";
import { ChatFeed } from "./components/ChatFeed";
import { MessageInput } from "./components/MessageInput";
import { TribeManifesto } from "./components/TribeManifesto";
import { StatsPage } from "./components/StatsPage";
import { AdminPage } from "./components/AdminPage";
import { AdminLogin } from "./components/AdminLogin";
import { MetricsPage } from "./components/MetricsPage";
import { NotFound } from "./components/NotFound";
import { useAdmin } from "./hooks/useAdmin";
import { ThreadPanel } from "./components/ThreadPanel";
import { NearbyTribes } from "./components/NearbyTribes";
import { CreateTribeForm } from "./components/CreateTribeForm";
import { TypingIndicator } from "./components/TypingIndicator";
import { MemberList } from "./components/MemberList";
import { useGeolocation } from "./hooks/useGeolocation";
import { useActiveTribe } from "./hooks/useActiveTribe";
import { useTribeIdentity } from "./hooks/useTribeIdentity";
import { haversineDistance, formatDistance, GEOFENCE_RADIUS_M } from "./utils/geo";
import type { Message } from "./components/MessageBubble";
import type { GeoState } from "./hooks/useGeolocation";

type Tribe = Doc<"tribes">;

// ─── Inner circle view ───────────────────────────────────────────────────────

interface InnerCircleProps {
  tribe: Tribe;
  allTribes: Tribe[];
  geo: GeoState;
  onLeave: () => void;
  onJoinOther: (tribe: Tribe) => void;
  isAdmin?: boolean;
}

function InnerCircle({ tribe, allTribes, geo, onLeave, onJoinOther, isAdmin = false }: InnerCircleProps) {
  const identity = useTribeIdentity();
  const tribeId = tribe._id;
  const rawMessages = useQuery(api.messages.list, { tribeId });
  const members = useQuery(api.members.list, { tribeId });
  const typingUsers = useQuery(api.typing.listTyping, { tribeId, excludeUserId: identity.userId });
  const sendMutation = useMutation(api.messages.send);
  const toggleLikeMutation = useMutation(api.messages.toggleLike);
  const deleteMessageMutation = useMutation(api.messages.deleteMessage);
  const joinTribeMutation = useMutation(api.members.joinTribe);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const [showManifesto, setShowManifesto] = useState(false);
  const [showNamePicker, setShowNamePicker] = useState(!identity.nameChosen);
  const [nameError, setNameError] = useState<string | null>(null);
  const messages = (rawMessages ?? []) as unknown as Message[];
  const openThreadMessage = openThreadId
    ? messages.find((m) => m._id === openThreadId) ?? null
    : null;

  // Register with the tribe (or update name) whenever identity changes.
  // Admin skips this — their member row is created by admin.adminJoinTribe.
  useEffect(() => {
    if (!identity.nameChosen || isAdmin) return;
    joinTribeMutation({
      tribeId,
      userId: identity.userId,
      userName: identity.tribeName,
      avatarSeed: identity.avatarSeed,
    }).then(
      () => setNameError(null),
      (err: unknown) => {
        const msg =
          err && typeof err === "object" && "data" in err && typeof (err as { data: unknown }).data === "string"
            ? (err as { data: string }).data
            : err instanceof Error
              ? err.message
              : "Could not join — try a different name.";
        setNameError(msg);
        setShowNamePicker(true);
      }
    );
  }, [identity.nameChosen, identity.userId, identity.tribeName, identity.avatarSeed, tribeId, joinTribeMutation, isAdmin]);

  const currentMember = (members ?? []).find((m) => m.userId === identity.userId);
  const mutedUntil = currentMember?.kickedUntil;
  const isKicked = currentMember?.kicked === true;

  // Auto-dismiss the kicked overlay to landing after 4 seconds.
  useEffect(() => {
    if (!isKicked) return;
    const t = setTimeout(onLeave, 4000);
    return () => clearTimeout(t);
  }, [isKicked, onLeave]);

  // Nearby campfires (excluding current, within 50km)
  const nearbyOthers = useMemo(() => {
    if (!geo.coords) return [];
    return allTribes
      .filter((t) => (t._id as string) !== (tribeId as string))
      .filter((t) => haversineDistance(geo.coords!.lat, geo.coords!.lng, t.lat, t.lng) <= 50_000);
  }, [allTribes, tribeId, geo.coords]);

  const send = (text: string, storageId?: Id<"_storage">) =>
    sendMutation({
      tribeId,
      text,
      author: identity.tribeName,
      authorId: identity.userId,
      avatarSeed: identity.avatarSeed,
      ...(storageId ? { storageId } : {}),
    });

  const handleLike = (messageId: string) =>
    toggleLikeMutation({
      messageId: messageId as Id<"messages">,
      userId: identity.userId,
    });

  const handleDelete = (messageId: string) =>
    deleteMessageMutation({
      messageId: messageId as Id<"messages">,
      userId: identity.userId,
    });

  const handleJoinOther = (t: Tribe) => {
    setShowNearby(false);
    onJoinOther(t);
  };

  const activeMembers = (members ?? []).filter((m) => !m.kicked && !m.banned);

  return (
    <>
      <TribeHeader
        identity={identity}
        tribeName={tribe.name}
        tribeId={tribeId as string}
        onLeave={onLeave}
        nearbyCount={nearbyOthers.length}
        onShowNearby={nearbyOthers.length > 0 ? () => setShowNearby(true) : undefined}
        onEditName={() => setShowNamePicker(true)}
        onShowManifesto={() => setShowManifesto(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <MemberList members={activeMembers} currentUserId={identity.userId} />
        <ChatFeed
          messages={messages}
          currentUserId={identity.userId}
          currentUserName={identity.tribeName}
          onLike={handleLike}
          onThreadReply={(id) => setOpenThreadId(id)}
          onDeleteMessage={handleDelete}
        />
      </div>
      <TypingIndicator typers={typingUsers ?? []} />
      <MessageInput
        onSend={send}
        tribeName={identity.tribeName}
        tribeId={tribeId}
        userId={identity.userId}
        mutedUntil={mutedUntil}
      />

      {/* Kicked overlay */}
      <AnimatePresence>
        {isKicked && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm px-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-5xl mb-4"
              animate={{ x: [0, 10, -10, 6, -4, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              🚫🔥
            </motion.div>
            <h2 className="font-mono text-lg font-bold text-white mb-2">Kicked from the fire</h2>
            <p className="font-mono text-sm text-fire-char/60 mb-1">
              The bouncer showed you the door from{" "}
              <span className="text-fire-glow font-bold">{tribe.name}</span>.
            </p>
            <p className="font-mono text-xs text-fire-char/40 mb-6">Heading back to landing…</p>
            <motion.button
              onClick={onLeave}
              whileTap={{ scale: 0.96 }}
              className="px-6 py-3 rounded-xl border border-fire-char/30 font-mono text-sm text-fire-char/60 hover:border-fire-ember/40 hover:text-white transition-all"
            >
              ← Back now
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Username picker — shown for new users who haven't chosen a name yet */}
      <AnimatePresence>
        {showNamePicker && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              className="relative z-10 w-full max-w-sm bg-[#050f05] border border-fire-ember/30 rounded-2xl px-5 py-5"
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <p className="font-mono text-xs text-fire-char/50 mb-3 text-center uppercase tracking-widest">
                Choose your name for{" "}
                <span className="text-fire-glow font-bold">{tribe.name}</span>
              </p>
              {nameError && (
                <p className="font-mono text-[11px] text-fire-ember mb-2 text-center">
                  {nameError}
                </p>
              )}
              <CreateTribeForm
                onSubmit={(_tribeName, userName) => {
                  setNameError(null);
                  identity.setTribeName(userName);
                  setShowNamePicker(false);
                }}
                onCancel={identity.nameChosen && !nameError ? () => setShowNamePicker(false) : undefined}
                defaultUserName={identity.nameChosen ? identity.tribeName : ""}
                nameOnly
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thread panel */}
      <AnimatePresence>
        {openThreadMessage && (
          <ThreadPanel
            key={openThreadMessage._id}
            parentMessage={openThreadMessage}
            tribeId={tribeId}
            currentUserId={identity.userId}
            currentUserName={identity.tribeName}
            avatarSeed={identity.avatarSeed}
            onClose={() => setOpenThreadId(null)}
            onLike={handleLike}
          />
        )}
      </AnimatePresence>

      {/* Manifesto bottom sheet */}
      <AnimatePresence>
        {showManifesto && (
          <motion.div
            className="absolute inset-0 z-40 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowManifesto(false)}
            />
            <motion.div
              className="relative z-10 bg-[#050f05] border-t border-fire-ember/20 rounded-t-2xl px-4 pt-4 pb-6 max-h-[75vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-mono text-sm font-bold text-white flex-1">About this fire</h3>
                <button
                  onClick={() => setShowManifesto(false)}
                  className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-2 py-1 rounded-lg hover:bg-fire-ash/40"
                  aria-label="Close manifesto"
                >
                  ✕
                </button>
              </div>
              <TribeManifesto />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nearby fires bottom sheet */}
      <AnimatePresence>
        {showNearby && (
          <motion.div
            className="absolute inset-0 z-40 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowNearby(false)}
            />
            <motion.div
              className="relative z-10 bg-[#050f05] border-t border-fire-ember/20 rounded-t-2xl px-4 pt-4 pb-6 max-h-[65vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-mono text-sm font-bold text-white flex-1">
                  Nearby Fires
                </h3>
                <button
                  onClick={() => setShowNearby(false)}
                  className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-2 py-1 rounded-lg hover:bg-fire-ash/40"
                >
                  ✕
                </button>
              </div>
              <NearbyTribes
                tribes={nearbyOthers}
                userCoords={geo.coords!}
                onJoin={handleJoinOther}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Geofence gate screens ────────────────────────────────────────────────────

function GeoCheckingScreen() {
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-4xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        📍
      </motion.div>
      <p className="font-mono text-sm text-fire-char/60 uppercase tracking-widest animate-pulse">
        Locating you...
      </p>
    </motion.div>
  );
}

function TooFarScreen({ tribeName, dist, onBack }: { tribeName: string; dist: number; onBack: () => void }) {
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-5xl">🚫🔥</div>
      <h2 className="font-mono text-lg font-bold text-white">Too far from the fire</h2>
      <p className="font-mono text-sm text-fire-char/60">
        <span className="text-fire-glow font-bold">{tribeName}</span> is{" "}
        <span className="text-fire-ember">{formatDistance(dist)}</span> away.
      </p>
      <p className="font-mono text-xs text-fire-char/40">
        You need to be within {formatDistance(GEOFENCE_RADIUS_M)} to join this campfire.
      </p>
      <motion.button
        onClick={onBack}
        whileTap={{ scale: 0.96 }}
        className="mt-2 px-6 py-3 rounded-xl border border-fire-char/30 font-mono text-sm text-fire-char/60 hover:border-fire-ember/40 hover:text-white transition-all"
      >
        ← Back
      </motion.button>
    </motion.div>
  );
}

function KickedOutScreen({ tribeName, onDismiss }: { tribeName: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      data-testid="kicked-out-screen"
      className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-5xl"
        animate={{ x: [0, 8, -8, 6, -4, 0] }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        🚶🔥
      </motion.div>
      <h2 className="font-mono text-lg font-bold text-white">You've left the fire</h2>
      <p className="font-mono text-sm text-fire-char/60">
        You wandered too far from{" "}
        <span className="text-fire-glow font-bold">{tribeName}</span>.
      </p>
      <motion.button
        onClick={onDismiss}
        whileTap={{ scale: 0.96 }}
        className="mt-2 px-6 py-3 rounded-xl border border-fire-char/30 font-mono text-sm text-fire-char/60 hover:border-fire-ember/40 hover:text-white transition-all"
      >
        ← Back to landing
      </motion.button>
    </motion.div>
  );
}

function GeoRequiredScreen({ tribeName, onBack }: { tribeName: string; onBack: () => void }) {
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-5xl">📍</div>
      <h2 className="font-mono text-lg font-bold text-white">Location required</h2>
      <p className="font-mono text-sm text-fire-char/60">
        To join <span className="text-fire-glow font-bold">{tribeName}</span>, we need to verify
        you're nearby. Please enable location in your browser and try again.
      </p>
      <motion.button
        onClick={onBack}
        whileTap={{ scale: 0.96 }}
        className="mt-2 px-6 py-3 rounded-xl border border-fire-char/30 font-mono text-sm text-fire-char/60 hover:border-fire-ember/40 hover:text-white transition-all"
      >
        ← Back
      </motion.button>
    </motion.div>
  );
}

// ─── App shell ───────────────────────────────────────────────────────────────

type GeoGate =
  | { status: "ok" }
  | { status: "checking" }
  | { status: "blocked"; tribeName: string; dist: number }
  | { status: "denied"; tribeName: string };

function TribeShell() {
  const { isAdmin } = useAdmin();
  const { activeTribeId, setActiveTribeId, confirmedTribeId, setConfirmedTribeId } = useActiveTribe();
  const autoJoinedRef = useRef(false);
  const geo = useGeolocation();
  const tribesRaw = useQuery(
    api.tribes.listNearby,
    geo.coords ? { lat: geo.coords.lat, lng: geo.coords.lng } : "skip"
  );
  const tribes = useMemo(() => tribesRaw ?? [], [tribesRaw]);
  // Direct lookup for the active tribe — listNearby may miss tribes outside its 50km radius
  // (e.g. when accessing via a shared link from a distant location).
  const activeTribeFromDb = useQuery(
    api.tribes.getById,
    activeTribeId ? { id: activeTribeId as Id<"tribes"> } : "skip"
  );
  const activeTribe = activeTribeFromDb ?? null;

  // Derives gate status purely from current coords — no effect or extra state needed.
  // Re-evaluates on every watchPosition update, providing continuous monitoring for kicks too.
  const geoGate = useMemo<GeoGate>(() => {
    if (isAdmin) return { status: "ok" }; // admin bypasses geofence
    if (!activeTribeId || !activeTribe) return { status: "ok" };
    if (geo.status === "denied" || geo.status === "unsupported" || geo.status === "error") return { status: "denied", tribeName: activeTribe.name };
    if (geo.status !== "granted" || !geo.coords) return { status: "checking" };
    const dist = haversineDistance(geo.coords.lat, geo.coords.lng, activeTribe.lat, activeTribe.lng);
    if (dist > GEOFENCE_RADIUS_M) return { status: "blocked", tribeName: activeTribe.name, dist };
    return { status: "ok" };
  }, [isAdmin, activeTribeId, activeTribe, geo.status, geo.coords]);

  // Clear active tribe from state if it expired/disappeared.
  // activeTribeFromDb === null (not undefined) means the DB confirmed the tribe is gone.
  useEffect(() => {
    if (activeTribeId && !confirmedTribeId && activeTribeFromDb === null) {
      setActiveTribeId(null);
    }
  }, [activeTribeId, confirmedTribeId, activeTribeFromDb, setActiveTribeId]);

  // Sync activeTribeId → URL hash
  useEffect(() => {
    const currentHash = window.location.hash.slice(1);
    const desired = activeTribeId ?? "";
    if (currentHash !== desired) {
      window.history.pushState(
        null,
        "",
        activeTribeId ? `#${activeTribeId}` : window.location.pathname
      );
    }
  }, [activeTribeId]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const hash = window.location.hash.slice(1);
      setActiveTribeId(hash || null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveTribeId]);

  // Auto-join the most active tribe inside the geofence on first load.
  useEffect(() => {
    if (isAdmin || autoJoinedRef.current || activeTribeId || geo.status !== "granted" || !geo.coords) return;
    const { lat, lng } = geo.coords;
    const nearby = tribes
      .filter((t) => haversineDistance(lat, lng, t.lat, t.lng) <= GEOFENCE_RADIUS_M)
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
    if (nearby.length === 0) return;
    autoJoinedRef.current = true;
    const tribeId = nearby[0]._id as string;
    setActiveTribeId(tribeId);
    setConfirmedTribeId(tribeId);
  }, [isAdmin, geo.status, geo.coords, activeTribeId, tribes, setActiveTribeId, setConfirmedTribeId]);

  const handleJoin = (tribe: Tribe) => {
    const id = tribe._id as string;
    setActiveTribeId(id);
    setConfirmedTribeId(id);
  };
  const handleCreate = (tribeId: string) => {
    setActiveTribeId(tribeId);
    setConfirmedTribeId(tribeId);
  };
  const handleLeave = useCallback(() => {
    setActiveTribeId(null);
    setConfirmedTribeId(null);
    if (isAdmin) {
      window.history.pushState(null, "", "/admin");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [setActiveTribeId, setConfirmedTribeId, isAdmin]);
  const handleJoinOther = (tribe: Tribe) => {
    const id = tribe._id as string;
    setActiveTribeId(id);
    setConfirmedTribeId(id);
  };

  // True when the user was confirmed inside this tribe but has now drifted out.
  const hasDrifted =
    confirmedTribeId !== null &&
    confirmedTribeId === activeTribeId &&
    geoGate.status === "blocked";

  const screen = !activeTribe ? "landing" : geoGate.status === "ok" ? "inner" : "gate";

  return (
    <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
      <AnimatePresence mode="wait">
        {screen === "landing" ? (
          <TribeLanding
            key="landing"
            geo={geo}
            tribes={tribes}
            onJoin={handleJoin}
            onCreate={handleCreate}
          />
        ) : screen === "gate" ? (
          <motion.div
            key="gate"
            className="relative flex flex-col flex-1 min-h-[100dvh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {geoGate.status === "checking" && <GeoCheckingScreen />}
            {geoGate.status === "blocked" && hasDrifted && (
              <KickedOutScreen tribeName={geoGate.tribeName} onDismiss={handleLeave} />
            )}
            {geoGate.status === "blocked" && !hasDrifted && (
              <TooFarScreen tribeName={geoGate.tribeName} dist={geoGate.dist} onBack={handleLeave} />
            )}
            {geoGate.status === "denied" && (
              <GeoRequiredScreen tribeName={geoGate.tribeName} onBack={handleLeave} />
            )}
          </motion.div>
        ) : (
          <div
            key="inner"
            className="relative flex flex-col h-[100dvh]"
            data-testid="inner-circle"
          >
            <InnerCircle
              tribe={activeTribe!}
              allTribes={tribes}
              geo={geo}
              onLeave={handleLeave}
              onJoinOther={handleJoinOther}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </AnimatePresence>
      {screen === "landing" && <TribeManifesto showAd />}
    </div>
  );
}

// ─── App shell (route switcher) ──────────────────────────────────────────────

function AppShell() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const { isAdmin } = useAdmin();
  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (pathname === "/stats") {
    return isAdmin ? (
      <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
        <StatsPage />
      </div>
    ) : (
      <AdminLogin returnTo="/stats" />
    );
  }
  if (pathname === "/admin") {
    return isAdmin ? (
      <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
        <AdminPage />
      </div>
    ) : (
      <AdminLogin returnTo="/admin" />
    );
  }
  if (pathname === "/metrics") {
    return isAdmin ? (
      <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
        <MetricsPage />
      </div>
    ) : (
      <AdminLogin returnTo="/metrics" />
    );
  }
  if (pathname === "/" || pathname === "") return <TribeShell />;
  return <NotFound />;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <FireBackground />
      <AppShell />
    </>
  );
}
