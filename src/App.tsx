import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
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
import { MockConvexProvider, useMockConvex, type MockTribe } from "./lib/MockConvexProvider";
import type { Message } from "./components/MessageBubble";

// ─── Inner circle view (inside the geofence) ────────────────────────────────

interface InnerCircleProps {
  tribe: MockTribe;
  onLeave: () => void;
}

function InnerCircle({ tribe, onLeave }: InnerCircleProps) {
  const identity = useTribeIdentity();
  const { getMessages, sendMessage } = useMockConvex();
  const messages = getMessages(tribe._id) as Message[];

  const send = (text: string) =>
    sendMessage(tribe._id, text, identity.tribeName, identity.userId, identity.avatarSeed);

  return (
    <>
      <TribeHeader identity={identity} tribeName={tribe.name} onLeave={onLeave} />
      <ChatFeed messages={messages} currentUserId={identity.userId} tribeName={tribe.name} />
      <MessageInput onSend={send} tribeName={identity.tribeName} />
    </>
  );
}

// ─── App shell with state machine ───────────────────────────────────────────

function AppShell() {
  const { activeTribeId, setActiveTribeId } = useActiveTribe();
  const { tribes } = useMockConvex();

  // Resolve the active tribe object (may be null if expired / not found yet)
  const activeTribe = activeTribeId ? tribes.find((t) => t._id === activeTribeId) ?? null : null;

  // If an ID is stored but no matching tribe exists, clear it immediately.
  // tribes now persists to localStorage so this catches genuinely expired / deleted tribes.
  useEffect(() => {
    if (activeTribeId && !activeTribe) {
      setActiveTribeId(null);
    }
  }, [activeTribeId, activeTribe, setActiveTribeId]);

  const geo = useGeolocation();

  const handleJoinOrCreate = (tribe: MockTribe) => setActiveTribeId(tribe._id);
  const handleLeave = () => setActiveTribeId(null);

  // ── Derive render state ────────────────────────────────────────────────────
  const screen = !activeTribe ? "landing" : "inner";

  return (
    <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
      <AnimatePresence mode="wait">
        {screen === "landing" ? (
          <TribeLanding
            key="landing"
            geo={geo}
            onJoin={handleJoinOrCreate}
            onCreate={handleJoinOrCreate}
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
    <MockConvexProvider>
      <AdSenseProvider />
      <FireBackground />
      <AppShell />
    </MockConvexProvider>
  );
}
