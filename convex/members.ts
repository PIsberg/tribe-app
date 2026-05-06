import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, { tribeId }) => {
    return ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .collect();
  },
});

export const joinTribe = mutation({
  args: {
    tribeId: v.id("tribes"),
    userId: v.string(),
    userName: v.string(),
    avatarSeed: v.string(),
  },
  handler: async (ctx, { tribeId, userId, userName, avatarSeed }) => {
    const existing = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", tribeId).eq("userId", userId)
      )
      .first();
    if (existing) return;

    await ctx.db.insert("tribeMembers", {
      tribeId,
      userId,
      userName,
      avatarSeed,
      joinedAt: Date.now(),
    });

    const tribe = await ctx.db.get(tribeId);
    if (tribe) {
      await ctx.scheduler.runAfter(1000, internal.bots.welcomeUser, {
        tribeId,
        userName,
        tribeName: tribe.name,
      });
    }
  },
});
