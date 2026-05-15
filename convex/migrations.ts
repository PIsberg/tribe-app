import { internalMutation } from "./_generated/server";
import { adjustTribeMemberCount } from "./metrics";

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

/**
 * One-shot: initializes the sharded `tribe_members:<id>` counter for every
 * existing tribe by summing active members. Idempotent: re-running adds the
 * same delta again, so only run this once per deploy of the counter feature.
 * After this, the per-tribe member fetch is no longer needed in
 * listWithCounts(Nearby).
 */
export const backfillTribeMemberCounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tribes = await ctx.db.query("tribes").take(2000);
    let updated = 0;
    for (const t of tribes) {
      const members = await ctx.db
        .query("tribeMembers")
        .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
        .take(500);
      const active = members.filter((m) => !m.kicked && !m.banned).length;
      if (active > 0) {
        await adjustTribeMemberCount(ctx, t._id, active);
        updated++;
      }
    }
    return { tribesScanned: tribes.length, tribesSeeded: updated };
  },
});
