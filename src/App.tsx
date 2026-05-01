import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FireBackground } from "./components/FireBackground";
import { LockedState } from "./components/LockedState";
import { LostSignal } from "./components/LostSignal";
import { TribeHeader } from "./components/TribeHeader";
import { ChatFeed } from "./components/ChatFeed";
import { MessageInput } from "./components/MessageInput";
import { TribeManifesto } from "./components/TribeManifesto";
import { AdSenseProvider } from "./components/AdSenseProvider";
import { useGeolocation } from "./hooks/useGeolocation";
import { useTribeIdentity } from "./hooks/useTribeIdentity";
import { MockConvexProvider, useMockConvex } from "./lib/MockConvexProvider";
import type { Message } from "./components/MessageBubble";

function InnerCircle() {
  const identity = useTribeIdentity();
  const { messages, sendMessage } = useMockConvex();

  const send = (text: string) => {
    sendMessage(text, identity.tribeName, identity.userId, identity.avatarSeed);
  };

  return (
    <>
      <TribeHeader identity={identity} />
      <ChatFeed messages={messages as Message[]} currentUserId={identity.userId} />
      <MessageInput onSend={send} tribeName={identity.tribeName} />
    </>
  );
}

export default function App() {
  const geo = useGeolocation();
  const wasInsideRef = useRef(false);
  const [showLostSignal, setShowLostSignal] = useState(false);

  const isLoading = geo.status === "idle" || geo.status === "requesting";
  const isInside = geo.inside;
  const isDenied = geo.status === "denied" || geo.status === "unsupported";

  useEffect(() => {
    if (isInside) {
      wasInsideRef.current = true;
      setShowLostSignal(false);
    } else if (wasInsideRef.current && geo.status === "granted") {
      setShowLostSignal(true);
      const t = setTimeout(() => setShowLostSignal(false), 4000);
      return () => clearTimeout(t);
    }
  }, [isInside, geo.status]);

  const showLocked = !isInside && (isLoading || isDenied || geo.status === "granted");

  return (
    <MockConvexProvider>
      <AdSenseProvider />
      <FireBackground />

      <div className="relative flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {showLostSignal ? (
            <LostSignal key="lost" />
          ) : showLocked ? (
            <LockedState key="locked" geo={geo} />
          ) : (
            <div
              key="inner"
              className="flex flex-col flex-1 min-h-[100dvh]"
              data-testid="inner-circle"
            >
              <InnerCircle />
            </div>
          )}
        </AnimatePresence>

        <TribeManifesto />
      </div>
    </MockConvexProvider>
  );
}
