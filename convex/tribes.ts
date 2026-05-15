import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { incrementCounter, ensureUser, readTribeMemberCount } from "./metrics";

const TRIBE_TTL = 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_M = 50_000;

// ─── Geohash utilities (inlined to avoid a separate lib module) ───────────────

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

function cellsForRadius(lat: number, lng: number, radiusM: number, precision = 4): string[] {
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

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TRIBE_TTL;
    return ctx.db
      .query("tribes")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", cutoff))
      .order("asc")
      .take(100);
  },
});

/** Spatially-indexed variant: returns active tribes within NEARBY_RADIUS_M of the user. */
export const listNearby = query({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, { lat, lng }) => {
    const cutoff = Date.now() - TRIBE_TTL;
    const cells = cellsForRadius(lat, lng, NEARBY_RADIUS_M);
    const results = await Promise.all(
      cells.map((cell) =>
        ctx.db
          .query("tribes")
          .withIndex("by_geohash4", (q) => q.eq("geohash4", cell))
          .take(200)
      )
    );
    const seen = new Set<string>();
    return results
      .flat()
      .filter((t) => {
        if (seen.has(t._id as string)) return false;
        seen.add(t._id as string);
        return t.createdAt > cutoff;
      });
  },
});

/** Spatially-indexed variant with member counts for the map view. */
export const listWithCountsNearby = query({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, { lat, lng }) => {
    const cutoff = Date.now() - TRIBE_TTL;
    const cells = cellsForRadius(lat, lng, NEARBY_RADIUS_M);
    const results = await Promise.all(
      cells.map((cell) =>
        ctx.db
          .query("tribes")
          .withIndex("by_geohash4", (q) => q.eq("geohash4", cell))
          .take(200)
      )
    );
    const seen = new Set<string>();
    const tribes = results
      .flat()
      .filter((t) => {
        if (seen.has(t._id as string)) return false;
        seen.add(t._id as string);
        return t.createdAt > cutoff;
      });
    return Promise.all(
      tribes.map(async (t) => ({
        ...t,
        memberCount: await readTribeMemberCount(ctx, t._id),
      }))
    );
  },
});

export const listWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TRIBE_TTL;
    const tribes = await ctx.db
      .query("tribes")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", cutoff))
      .order("asc")
      .take(100);
    return Promise.all(
      tribes.map(async (t) => ({
        ...t,
        memberCount: await readTribeMemberCount(ctx, t._id),
      }))
    );
  },
});

/** Fetch a single tribe by ID — used by TribeShell to resolve a tribe from the URL hash
 *  regardless of the caller's location (listNearby would miss far-away tribes). */
export const getById = query({
  args: { id: v.id("tribes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    name: v.string(),
    creatorId: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    await incrementCounter(ctx, "tribes_created");
    await ensureUser(ctx, args.creatorId);
    const tribeId = await ctx.db.insert("tribes", {
      ...args,
      createdAt: Date.now(),
      geohash4: encode(args.lat, args.lng),
    });
    await ctx.scheduler.runAfter(500, internal.bots.greetTribe, {
      tribeId,
      tribeName: args.name,
    });
    return tribeId;
  },
});

// Self-rescheduling batched cleanup. Each run handles up to 10 old tribes;
// per-tribe member deletes are capped at 200 per tx to avoid blowing the
// document budget on very large tribes.
export const deleteOldTribes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TRIBE_TTL;
    const old = await ctx.db
      .query("tribes")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(10);
    for (const t of old) {
      const members = await ctx.db
        .query("tribeMembers")
        .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
        .take(200);
      await Promise.all(members.map((m) => ctx.db.delete(m._id)));
      // Only delete the tribe doc once all member rows are gone.
      if (members.length < 200) {
        await ctx.db.delete(t._id);
      }
    }
    if (old.length === 10) {
      await ctx.scheduler.runAfter(0, internal.tribes.deleteOldTribes, {});
    }
    return old.length;
  },
});
