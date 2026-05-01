import { motion } from "framer-motion";
import { haversineDistance, formatDistance, GEOFENCE_RADIUS_M } from "../utils/geo";
import type { MockTribe } from "../lib/MockConvexProvider";
import type { Coords } from "../hooks/useGeolocation";

interface Props {
  tribes: MockTribe[];
  userCoords: Coords;
  onJoin: (tribe: MockTribe) => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function NearbyTribes({ tribes, userCoords, onJoin }: Props) {
  const nearby = tribes
    .map((t) => ({
      tribe: t,
      distance: haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng),
    }))
    .filter(({ distance }) => distance <= 2000) // show tribes within 2km
    .sort((a, b) => a.distance - b.distance);

  if (nearby.length === 0) return null;

  return (
    <div className="w-full mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-fire-char/20" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-fire-char/50">
          Nearby Fires
        </span>
        <div className="h-px flex-1 bg-fire-char/20" />
      </div>

      <div className="space-y-2">
        {nearby.map(({ tribe, distance }, i) => {
          const isInsideNow = distance <= GEOFENCE_RADIUS_M;
          return (
            <motion.button
              key={tribe._id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => onJoin(tribe)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-fire-ash/40 border border-fire-char/20 hover:border-fire-ember/40 hover:bg-fire-ash/60 text-left transition-all group"
              data-testid="nearby-tribe"
            >
              {/* Fire icon with intensity based on distance */}
              <div className="text-xl flex-shrink-0">
                {isInsideNow ? "🔥" : distance < 500 ? "🌋" : "🕯️"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold text-white truncate group-hover:text-fire-glow transition-colors">
                  {tribe.name}
                </div>
                <div className="font-mono text-[10px] text-fire-char/50 mt-0.5">
                  {timeAgo(tribe.createdAt)}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div
                  className={`font-mono text-xs font-bold ${isInsideNow ? "text-fire-ember" : "text-fire-char/60"}`}
                >
                  {formatDistance(distance)}
                </div>
                {isInsideNow && (
                  <div className="font-mono text-[9px] text-fire-ember/70 uppercase tracking-wide">
                    Inside
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
