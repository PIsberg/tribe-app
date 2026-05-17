import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertAdmin, constantTimeEqual, getAdminToken, normalize } from "./lib/auth";
import { ensureUser, adjustTribeMemberCount, tribeMemberActiveDelta } from "./metrics";

declare const process: { env: Record<string, string | undefined> };

const ADMIN_NAME = "@Tribe-admin";
const TRIBE_TTL = 24 * 60 * 60 * 1000;

export const verifyToken = mutation({
  args: { token: v.string() },
  handler: async (_ctx, { token }) => {
    const expected = getAdminToken();
    return !!(expected && constantTimeEqual(normalize(token), expected));
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
    await ensureUser(ctx, userId);
    const existing = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", tribeId).eq("userId", userId)
      )
      .first();
    if (existing) {
      const patch = { userName: ADMIN_NAME, kicked: false, banned: false };
      await ctx.db.patch(existing._id, patch);
      await adjustTribeMemberCount(
        ctx,
        tribeId,
        tribeMemberActiveDelta(existing, { ...existing, ...patch })
      );
      return;
    }
    await ctx.db.insert("tribeMembers", {
      tribeId,
      userId,
      userName: ADMIN_NAME,
      avatarSeed,
      joinedAt: Date.now(),
    });
    await adjustTribeMemberCount(ctx, tribeId, 1);
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
    const before = await ctx.db.get(memberId);
    if (!before) return;
    const patch = { kicked: true };
    await ctx.db.patch(memberId, patch);
    await adjustTribeMemberCount(
      ctx,
      before.tribeId,
      tribeMemberActiveDelta(before, { ...before, ...patch })
    );
  },
});

export const banMember = mutation({
  args: { token: v.string(), memberId: v.id("tribeMembers") },
  handler: async (ctx, { token, memberId }) => {
    assertAdmin(token);
    const before = await ctx.db.get(memberId);
    if (!before) return;
    const patch = { banned: true };
    await ctx.db.patch(memberId, patch);
    await adjustTribeMemberCount(
      ctx,
      before.tribeId,
      tribeMemberActiveDelta(before, { ...before, ...patch })
    );
  },
});

export const unkickMember = mutation({
  args: { token: v.string(), memberId: v.id("tribeMembers") },
  handler: async (ctx, { token, memberId }) => {
    assertAdmin(token);
    const before = await ctx.db.get(memberId);
    if (!before) return;
    const patch = { kicked: false, banned: false };
    await ctx.db.patch(memberId, patch);
    await adjustTribeMemberCount(
      ctx,
      before.tribeId,
      tribeMemberActiveDelta(before, { ...before, ...patch })
    );
  },
});
