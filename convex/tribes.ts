import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { incrementCounter, ensureUser } from "./metrics";
import { encode, cellsForRadius } from "./lib/geohash";

const TRIBE_TTL = 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_M = 50_000;

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
      tribes.map(async (t) => {
        const members = await ctx.db
          .query("tribeMembers")
          .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
          .take(500);
        return { ...t, memberCount: members.filter((m) => !m.kicked && !m.banned).length };
      })
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
      tribes.map(async (t) => {
        const members = await ctx.db
          .query("tribeMembers")
          .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
          .take(500);
        return { ...t, memberCount: members.filter((m) => !m.kicked && !m.banned).length };
      })
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
