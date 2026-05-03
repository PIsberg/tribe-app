import { useEffect, useRef, useMemo, useState } from "react";
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
import { AdSenseProvider } from "./components/AdSenseProvider";
import { ThreadPanel } from "./components/ThreadPanel";
import { NearbyTribes } from "./components/NearbyTribes";
import { useGeolocation } from "./hooks/useGeolocation";
import { useTribeIdentity } from "./hooks/useTribeIdentity";
import { useActiveTribe } from "./hooks/useActiveTribe";
import { haversineDistance } from "./utils/geo";
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
}

function InnerCircle({ tribe, allTribes, geo, onLeave, onJoinOther }: InnerCircleProps) {
  const identity = useTribeIdentity();
  const tribeId = tribe._id;
  const rawMessages = useQuery(api.messages.list, { tribeId });
  const sendMutation = useMutation(api.messages.send);
  const toggleLikeMutation = useMutation(api.messages.toggleLike);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [showNearby, setShowNearby] = useState(false);

  const messages = (rawMessages ?? []) as unknown as Message[];
  const openThreadMessage = openThreadId
    ? messages.find((m) => m._id === openThreadId) ?? null
    : null;

  // Nearby campfires (excluding current, within 50km)
  const nearbyOthers = useMemo(() => {
    if (!geo.coords) return [];
    return allTribes
      .filter((t) => (t._id as string) !== (tribeId as string))
      .filter((t) => haversineDistance(geo.coords!.lat, geo.coords!.lng, t.lat, t.lng) <= 50_000);
  }, [allTribes, tribeId, geo.coords]);

  const send = (text: string) =>
    sendMutation({
      tribeId,
      text,
      author: identity.tribeName,
      authorId: identity.userId,
      avatarSeed: identity.avatarSeed,
    });

  const handleLike = (messageId: string) =>
    toggleLikeMutation({
      messageId: messageId as Id<"messages">,
      userId: identity.userId,
    });

  const handleJoinOther = (t: Tribe) => {
    setShowNearby(false);
    onJoinOther(t);
  };

  return (
    <>
      <TribeHeader
        identity={identity}
        tribeName={tribe.name}
        tribeId={tribeId as string}
        onLeave={onLeave}
        nearbyCount={nearbyOthers.length}
        onShowNearby={nearbyOthers.length > 0 ? () => setShowNearby(true) : undefined}
      />
      <ChatFeed
        messages={messages}
        currentUserId={identity.userId}
        onLike={handleLike}
        onThreadReply={(id) => setOpenThreadId(id)}
      />
      <MessageInput onSend={send} tribeName={identity.tribeName} />

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

// ─── App shell ───────────────────────────────────────────────────────────────

function AppShell() {
  const { activeTribeId, setActiveTribeId } = useActiveTribe();
  const tribesRaw = useQuery(api.tribes.list);
  const tribes = useMemo(() => tribesRaw ?? [], [tribesRaw]);
  const identity = useTribeIdentity();
  const autoJoinedRef = useRef(false);
  const geo = useGeolocation();

  const activeTribe = activeTribeId
    ? tribes.find((t) => (t._id as string) === activeTribeId) ?? null
    : null;

  // Clear active tribe from state if it expired/disappeared
  useEffect(() => {
    if (activeTribeId && tribes.length > 0 && !activeTribe) setActiveTribeId(null);
  }, [activeTribeId, activeTribe, tribes.length, setActiveTribeId]);

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
    if (autoJoinedRef.current || activeTribeId || geo.status !== "granted" || !geo.coords) return;
    const { lat, lng } = geo.coords;
    const nearby = tribes
      .filter((t) => haversineDistance(lat, lng, t.lat, t.lng) <= 5000)
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
    if (nearby.length === 0) return;
    autoJoinedRef.current = true;
    identity.setTribeName(identity.tribeName);
    setActiveTribeId(nearby[0]._id as string);
  }, [geo.status, geo.coords, activeTribeId, tribes, identity, setActiveTribeId]);

  const handleJoin = (tribe: Tribe) => setActiveTribeId(tribe._id as string);
  const handleCreate = (tribeId: string) => setActiveTribeId(tribeId);
  const handleLeave = () => setActiveTribeId(null);
  const handleJoinOther = (tribe: Tribe) => setActiveTribeId(tribe._id as string);

  const screen = !activeTribe ? "landing" : "inner";

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
        ) : (
          <div
            key="inner"
            className="relative flex flex-col flex-1 min-h-[100dvh]"
            data-testid="inner-circle"
          >
            <InnerCircle
              tribe={activeTribe!}
              allTribes={tribes}
              geo={geo}
              onLeave={handleLeave}
              onJoinOther={handleJoinOther}
            />
          </div>
        )}
      </AnimatePresence>
      <TribeManifesto />
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <AdSenseProvider />
      <FireBackground />
      <AppShell />
    </>
  );
}
