const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Encodes lat/lng to a geohash string of the given precision. */
export function encode(lat: number, lng: number, precision = 4): string {
  let idx = 0, bit = 0, isEven = true, hash = "";
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { idx = (idx << 1) | 1; minLng = mid; }
      else { idx <<= 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { idx = (idx << 1) | 1; minLat = mid; }
      else { idx <<= 1; maxLat = mid; }
    }
    isEven = !isEven;
    if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

/**
 * Returns the unique set of geohash cells (at `precision`) that cover the
 * bounding box of [lat, lng] ± radiusM.  Querying all returned cells and
 * then filtering by haversine guarantees no false negatives.
 */
export function cellsForRadius(lat: number, lng: number, radiusM: number, precision = 4): string[] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const cells = new Set<string>();
  for (const dlat of [-1, 0, 1]) {
    for (const dlng of [-1, 0, 1]) {
      cells.add(encode(
        Math.min(90, Math.max(-90, lat + dlat * dLat)),
        Math.min(180, Math.max(-180, lng + dlng * dLng)),
        precision,
      ));
    }
  }
  return [...cells];
}
