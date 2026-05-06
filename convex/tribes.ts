import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const TRIBE_TTL = 24 * 60 * 60 * 1000;

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

export const create = mutation({
  args: {
    name: v.string(),
    creatorId: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const tribeId = await ctx.db.insert("tribes", { ...args, createdAt: Date.now() });
    await ctx.scheduler.runAfter(500, internal.bots.greetTribe, {
      tribeId,
      tribeName: args.name,
    });
    return tribeId;
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
          .collect();
        return { ...t, memberCount: members.length };
      })
    );
  },
});

export const deleteOldTribes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TRIBE_TTL;
    const old = await ctx.db
      .query("tribes")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(50);
    await Promise.all(
      old.map(async (t) => {
        const members = await ctx.db
          .query("tribeMembers")
          .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
          .collect();
        await Promise.all(members.map((m) => ctx.db.delete(m._id)));
        await ctx.db.delete(t._id);
      })
    );
    return old.length;
  },
});
