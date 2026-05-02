import { motion } from "framer-motion";
import { haversineDistance, formatDistance, GEOFENCE_RADIUS_M } from "../utils/geo";
import type { Doc } from "../../convex/_generated/dataModel";
import type { Coords } from "../hooks/useGeolocation";

type Tribe = Doc<"tribes">;

interface Props {
  tribes: Tribe[];
  userCoords: Coords;
  onJoin: (tribe: Tribe) => void;
}

function isRecentlyActive(lastMessageAt: number | undefined, thresholdMs: number): boolean {
  if (lastMessageAt == null) return false;
  return Date.now() - lastMessageAt < thresholdMs;
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
    .filter(({ distance }) => distance <= 2000)
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
          const isActive = isRecentlyActive(tribe.lastMessageAt, 5 * 60 * 1000);
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
              <div className="text-xl flex-shrink-0">
                {isInsideNow ? "🔥" : distance < 500 ? "🌋" : "🕯️"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold text-white truncate group-hover:text-fire-glow transition-colors">
                  {tribe.name}
                </div>
                <div className="font-mono text-[10px] text-fire-char/50 mt-0.5">
                  {isActive ? (
                    <span className="text-fire-ember/70">🔥 active</span>
                  ) : tribe.lastMessageAt != null ? (
                    <span>last message {timeAgo(tribe.lastMessageAt)}</span>
                  ) : (
                    <span>lit {timeAgo(tribe.createdAt)}</span>
                  )}
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
