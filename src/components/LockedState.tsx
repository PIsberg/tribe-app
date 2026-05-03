import { motion } from "framer-motion";
import { formatDistance, GEOFENCE_RADIUS_M } from "../utils/geo";
import type { GeoState } from "../hooks/useGeolocation";

interface Props {
  geo: GeoState;
}

export function LockedState({ geo }: Props) {
  const isRequesting = geo.status === "requesting" || geo.status === "idle";
  const isDenied = geo.status === "denied" || geo.status === "unsupported";

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Blurred chat ghost */}
      <div className="absolute inset-0 flex flex-col justify-end pb-24 px-4 pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="mb-3 blur-[6px] opacity-30 flex gap-3 items-start"
            style={{ alignSelf: i % 2 === 0 ? "flex-start" : "flex-end" }}
          >
            <div className="w-8 h-8 rounded-lg bg-fire-char flex-shrink-0" />
            <div className="bg-fire-ash rounded-xl px-4 py-2 max-w-[200px]">
              <div className="h-2.5 bg-fire-char rounded w-24 mb-1.5" />
              <div className="h-2 bg-fire-char rounded w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Locked card */}
      <motion.div
        className="relative z-10 text-center max-w-sm w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Fire icon */}
        <motion.div
          className="text-6xl mb-6 select-none"
          animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.div>

        {isDenied ? (
          <>
            <h1 className="font-mono text-2xl font-bold text-fire-ember mb-3">
              SIGNAL BLOCKED
            </h1>
            <p className="text-fire-char text-sm leading-relaxed">
              Location access denied. Enable it in your browser settings and refresh to find the tribe.
            </p>
          </>
        ) : isRequesting ? (
          <>
            <h1 className="font-mono text-2xl font-bold text-fire-glow mb-3 animate-pulse">
              LOCATING SIGNAL...
            </h1>
            <p className="text-fire-char text-sm">Reading your coordinates...</p>
          </>
        ) : (
          <>
            <h1 className="font-mono text-2xl font-bold text-fire-glow mb-2">
              WALKING TO THE TRIBE
            </h1>
            <motion.div
              className="font-mono text-5xl font-bold text-fire-ember my-6 tabular-nums"
              key={geo.distance}
              animate={{ scale: [1.05, 1] }}
              transition={{ duration: 0.2 }}
            >
              {geo.distance != null ? formatDistance(geo.distance) : "—"}
            </motion.div>
            <p className="text-fire-char text-sm">
              The inner circle is within{" "}
              <span className="text-fire-glow font-mono">{formatDistance(GEOFENCE_RADIUS_M)}</span>. Keep moving.
            </p>

            {/* Distance bar */}
            <div className="mt-6 h-1.5 bg-fire-ash rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-fire-ember to-fire-glow rounded-full"
                animate={{
                  width: geo.distance != null
                    ? `${Math.max(0, Math.min(100, 100 - (geo.distance / GEOFENCE_RADIUS_M) * 100))}%`
                    : "0%",
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
