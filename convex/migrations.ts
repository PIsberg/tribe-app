import { internalMutation } from "./_generated/server";
import { encode } from "./lib/geohash";

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
