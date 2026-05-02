import { useEffect, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
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
import { useGeolocation } from "./hooks/useGeolocation";
import { useTribeIdentity } from "./hooks/useTribeIdentity";
import { useActiveTribe } from "./hooks/useActiveTribe";
import { haversineDistance, GEOFENCE_RADIUS_M } from "./utils/geo";
import type { Message } from "./components/MessageBubble";

type Tribe = Doc<"tribes">;

// ─── Inner circle view ───────────────────────────────────────────────────────

interface InnerCircleProps {
  tribe: Tribe;
  onLeave: () => void;
}

function InnerCircle({ tribe, onLeave }: InnerCircleProps) {
  const identity = useTribeIdentity();
  const tribeId = tribe._id;
  const rawMessages = useQuery(api.messages.list, { tribeId });
  const sendMutation = useMutation(api.messages.send);
  const toggleLikeMutation = useMutation(api.messages.toggleLike);

  const messages = (rawMessages ?? []) as unknown as Message[];

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

  return (
    <>
      <TribeHeader identity={identity} tribeName={tribe.name} onLeave={onLeave} />
      <ChatFeed messages={messages} currentUserId={identity.userId} onLike={handleLike} />
      <MessageInput onSend={send} tribeName={identity.tribeName} />
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

  useEffect(() => {
    if (activeTribeId && !activeTribe) setActiveTribeId(null);
  }, [activeTribeId, activeTribe, setActiveTribeId]);

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
            className="flex flex-col flex-1 min-h-[100dvh]"
            data-testid="inner-circle"
          >
            <InnerCircle tribe={activeTribe!} onLeave={handleLeave} />
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
