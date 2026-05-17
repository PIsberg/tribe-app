import { ConvexError } from "convex/values";

const RADIUS_M = 1500;
const TRANSIT_RADIUS_M = 150;
const TRANSIT_STALE_MS = 5 * 60 * 1000;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TransitTribe = {
  lat: number;
  lng: number;
  mode?: string;
  transitLat?: number;
  transitLng?: number;
  transitUpdatedAt?: number;
};

export function assertInRadius(
  tribe: TransitTribe,
  lat: number | undefined | null,
  lng: number | undefined | null
): void {
  if (lat == null || lng == null) return;
  const isTransit = tribe.mode === "transit";
  const isFresh = isTransit && tribe.transitUpdatedAt != null &&
    Date.now() - tribe.transitUpdatedAt < TRANSIT_STALE_MS;
  const centerLat = isFresh ? (tribe.transitLat ?? tribe.lat) : tribe.lat;
  const centerLng = isFresh ? (tribe.transitLng ?? tribe.lng) : tribe.lng;
  const radius = isFresh ? TRANSIT_RADIUS_M : RADIUS_M;
  if (haversine(lat, lng, centerLat, centerLng) > radius) {
    throw new ConvexError("OUT_OF_RANGE");
  }
}
