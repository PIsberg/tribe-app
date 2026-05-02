import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

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
    return ctx.db.insert("tribes", { ...args, createdAt: Date.now() });
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
    await Promise.all(old.map((t) => ctx.db.delete(t._id)));
    return old.length;
  },
});
