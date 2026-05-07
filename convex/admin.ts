import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const ADMIN_NAME = "@Tribe-admin";
const TRIBE_TTL = 24 * 60 * 60 * 1000;

function assertAdmin(token: string): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) throw new Error("Unauthorized");
}

export const verifyToken = query({
  args: { token: v.string() },
  handler: async (_ctx, { token }) => {
    const expected = process.env.ADMIN_TOKEN;
    return !!(expected && token === expected);
  },
});

export const listAllTribes = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    assertAdmin(token);
    const tribes = await ctx.db.query("tribes").take(1000);
    const now = Date.now();
    return Promise.all(
      tribes.map(async (t) => {
        const members = await ctx.db
          .query("tribeMembers")
          .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
          .take(200);
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_tribeId_and_timestamp", (q) => q.eq("tribeId", t._id))
          .take(500);
        const activeMembers = members.filter((m) => !m.kicked && !m.banned);
        const kickedBannedCount = members.filter((m) => m.kicked || m.banned).length;
        return {
          _id: t._id as string,
          name: t.name,
          lat: t.lat,
          lng: t.lng,
          createdAt: t.createdAt,
          lastActivity: t.lastMessageAt ?? t.createdAt,
          isActive: t.createdAt > now - TRIBE_TTL,
          memberCount: activeMembers.length,
          kickedBannedCount,
          messageCount: messages.length,
        };
      })
    );
  },
});

export const adminJoinTribe = mutation({
  args: {
    token: v.string(),
    tribeId: v.id("tribes"),
    userId: v.string(),
    avatarSeed: v.string(),
  },
  handler: async (ctx, { token, tribeId, userId, avatarSeed }) => {
    assertAdmin(token);
    const existing = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", tribeId).eq("userId", userId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userName: ADMIN_NAME,
        kicked: false,
        banned: false,
      });
      return;
    }
    await ctx.db.insert("tribeMembers", {
      tribeId,
      userId,
      userName: ADMIN_NAME,
      avatarSeed,
      joinedAt: Date.now(),
    });
  },
});

export const deleteTribe = mutation({
  args: { token: v.string(), tribeId: v.id("tribes") },
  handler: async (ctx, { token, tribeId }) => {
    assertAdmin(token);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_timestamp", (q) => q.eq("tribeId", tribeId))
      .take(5000);
    for (const m of messages) {
      if (m.storageId) await ctx.storage.delete(m.storageId);
      await ctx.db.delete(m._id);
    }
    const members = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    const typing = await ctx.db
      .query("typing")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .collect();
    for (const t of typing) await ctx.db.delete(t._id);
    await ctx.db.delete(tribeId);
  },
});

export const kickMember = mutation({
  args: { token: v.string(), memberId: v.id("tribeMembers") },
  handler: async (ctx, { token, memberId }) => {
    assertAdmin(token);
    await ctx.db.patch(memberId, { kicked: true });
  },
});

export const banMember = mutation({
  args: { token: v.string(), memberId: v.id("tribeMembers") },
  handler: async (ctx, { token, memberId }) => {
    assertAdmin(token);
    await ctx.db.patch(memberId, { banned: true });
  },
});

export const unkickMember = mutation({
  args: { token: v.string(), memberId: v.id("tribeMembers") },
  handler: async (ctx, { token, memberId }) => {
    assertAdmin(token);
    await ctx.db.patch(memberId, { kicked: false, banned: false });
  },
});
