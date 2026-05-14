import { internalMutation } from "./_generated/server";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function encode(lat: number, lng: number, precision = 4): string {
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

/** One-shot: backfills geohash4 on existing tribes that don't have it yet. */
export const backfillGeohashes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tribes = await ctx.db
      .query("tribes")
      .take(500);
    let updated = 0;
    for (const t of tribes) {
      if (!t.geohash4) {
        await ctx.db.patch(t._id, { geohash4: encode(t.lat, t.lng) });
        updated++;
      }
    }
    return { updated };
  },
});
