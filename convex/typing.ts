import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

const TYPING_TTL_MS = 4000;

export const setTyping = mutation({
  args: {
    tribeId: v.id("tribes"),
    userId: v.string(),
    userName: v.string(),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", args.tribeId).eq("userId", args.userId)
      )
      .unique();

    if (!args.isTyping) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now(), userName: args.userName });
    } else {
      await ctx.db.insert("typing", {
        tribeId: args.tribeId,
        userId: args.userId,
        userName: args.userName,
        updatedAt: Date.now(),
      });
    }
  },
});

// Runs every 2 min via cron to evict rows from disconnected clients that never
// called setTyping(isTyping: false).
export const purgeStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30_000; // stale after 30 s
    const stale = await ctx.db
      .query("typing")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", cutoff))
      .take(500);
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
    return stale.length;
  },
});

export const listTyping = query({
  args: { tribeId: v.id("tribes"), excludeUserId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - TYPING_TTL_MS;
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_tribeId_and_updatedAt", (q) =>
        q.eq("tribeId", args.tribeId).gt("updatedAt", cutoff)
      )
      .take(20);
    return rows
      .filter((r) => r.userId !== args.excludeUserId)
      .map((r) => r.userName);
  },
});
