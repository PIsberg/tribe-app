import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreateTribeForm } from "./CreateTribeForm";
import { NearbyTribes } from "./NearbyTribes";
import { useMockConvex, type MockTribe } from "../lib/MockConvexProvider";
import { useTribeIdentity } from "../hooks/useTribeIdentity";
import type { GeoState } from "../hooks/useGeolocation";

interface Props {
  geo: GeoState;
  onJoin: (tribe: MockTribe) => void;
  onCreate: (tribe: MockTribe) => void;
}

export function TribeLanding({ geo, onJoin, onCreate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<MockTribe | null>(null);
  const { tribes, createTribe } = useMockConvex();
  const identity = useTribeIdentity();

  const isLocating = geo.status === "idle" || geo.status === "requesting";
  const isDenied = geo.status === "denied" || geo.status === "unsupported";
  const hasLocation = geo.status === "granted" && geo.coords != null;

  const handleCreate = async (tribeName: string, userName: string) => {
    identity.setTribeName(userName);
    setCreating(true);
    await new Promise((r) => setTimeout(r, 400));
    const coords = geo.coords ?? { lat: 0, lng: 0 };
    const tribe = createTribe(tribeName, identity.userId, coords.lat, coords.lng);
    setCreating(false);
    onCreate(tribe);
  };

  const handleJoin = (tribe: MockTribe) => {
    if (!identity.nameChosen) {
      setPendingJoin(tribe);
    } else {
      onJoin(tribe);
    }
  };

  const handleJoinWithName = (_tribeName: string, userName: string) => {
    identity.setTribeName(userName);
    if (pendingJoin) {
      onJoin(pendingJoin);
      setPendingJoin(null);
    }
  };

  return (
    <motion.div
      key="landing"
      className="flex flex-col items-center justify-center min-h-[100dvh] px-6 pb-16 pt-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      data-testid="tribe-landing"
    >
      {/* Logo / hero */}
      <motion.div
        className="text-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="text-6xl mb-3 select-none"
          animate={{ scale: [1, 1.07, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.div>
        <h1 className="font-mono text-3xl font-bold text-white tracking-tight">
          tribe
        </h1>
        <p className="font-mono text-[9px] text-fire-char/30 mt-0">v2</p>
        <p className="font-mono text-xs text-fire-char/60 mt-1 uppercase tracking-widest">
          Hyper-local · Ephemeral · Yours
        </p>
      </motion.div>

      {/* Main action area */}
      <motion.div
        className="w-full max-w-sm"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <AnimatePresence mode="wait">
          {isLocating ? (
            <motion.div
              key="locating"
              className="text-center py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="font-mono text-sm text-fire-char/60 animate-pulse uppercase tracking-widest">
                Reading your signal...
              </p>
            </motion.div>
          ) : isDenied ? (
            <motion.div
              key="denied"
              className="text-center py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="font-mono text-sm text-fire-ember/80 mb-1">Location access denied.</p>
              <p className="font-mono text-xs text-fire-char/50">
                Enable location in browser settings and refresh.
              </p>
            </motion.div>
          ) : pendingJoin ? (
            <motion.div key="join-name" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="font-mono text-xs text-fire-char/50 mb-3 text-center uppercase tracking-widest">
                Joining <span className="text-fire-glow font-bold">{pendingJoin.name}</span>
              </p>
              <CreateTribeForm
                onSubmit={handleJoinWithName}
                onCancel={() => setPendingJoin(null)}
                defaultUserName={identity.tribeName}
                nameOnly
              />
            </motion.div>
          ) : showForm ? (
            <CreateTribeForm
              key="form"
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              disabled={creating}
              defaultUserName={identity.nameChosen ? identity.tribeName : ""}
            />
          ) : (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Primary CTA */}
              <motion.button
                onClick={() => setShowForm(true)}
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.02 }}
                className="w-full py-4 rounded-2xl bg-fire-ember font-mono text-sm font-bold text-white uppercase tracking-widest glow-ember"
                data-testid="create-tribe-btn"
                style={{ boxShadow: "0 0 24px rgba(255,69,0,0.4)" }}
              >
                🔥 Create a Campfire Here
              </motion.button>
              <p className="font-mono text-[10px] text-fire-char/40 text-center mt-2">
                Name your tribe and light the fire
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nearby tribes */}
        {hasLocation && !showForm && geo.coords && (
          <NearbyTribes tribes={tribes} userCoords={geo.coords} onJoin={handleJoin} />
        )}
      </motion.div>
    </motion.div>
  );
}
