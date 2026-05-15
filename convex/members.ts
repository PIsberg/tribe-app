import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ensureUser } from "./metrics";
import { checkRateLimit } from "./lib/rateLimit";

// Bounded at 500 so a long-lived tribe with churn (24h TTL, joiners come and go,
// kicked/banned rows are kept) can't blow the per-tx read budget. The sidebar
// only renders active members anyway; the join-collision path already uses
// take(500) on the same index.
export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, { tribeId }) => {
    return ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .take(500);
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
    await checkRateLimit(ctx, `join:${userId}`, 10, 60_000);
    if (userName.trim().toLowerCase().startsWith("@tribe-admin")) {
      throw new ConvexError("Reserved name");
    }
    const normalized = userName.trim().toLowerCase();

    // Bounded case-insensitive name collision check. Using take(500) instead of
    // collect() prevents tx-budget blowup in large tribes while preserving the
    // original case-insensitive semantics (userNames are stored in original case).
    const members = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .take(500);
    const collision = members.find(
      (m) => m.userId !== userId && m.userName.trim().toLowerCase() === normalized
    );
    if (collision) {
      throw new ConvexError("That name is already taken in this tribe.");
    }

    await ensureUser(ctx, userId);

    const existing = members.find((m) => m.userId === userId) ?? null;
    if (existing) {
      if (existing.userName !== userName) {
        await ctx.db.patch(existing._id, { userName });
      }
      return;
    }

    await ctx.db.insert("tribeMembers", {
      tribeId,
      userId,
      userName,
      avatarSeed,
      joinedAt: Date.now(),
    });

    const tribe = await ctx.db.get(tribeId);
    if (tribe) {
      await ctx.scheduler.runAfter(5000, internal.bots.welcomeUser, {
        tribeId,
        userName,
        tribeName: tribe.name,
      });
    }
  },
});
