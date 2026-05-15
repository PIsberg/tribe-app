import { ConvexError } from "convex/values";

const RADIUS_M = 1500;

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

export function assertInRadius(
  tribe: { lat: number; lng: number },
  lat: number | undefined | null,
  lng: number | undefined | null
): void {
  if (lat == null || lng == null) return;
  if (haversine(lat, lng, tribe.lat, tribe.lng) > RADIUS_M) {
    throw new ConvexError("OUT_OF_RANGE");
  }
}
