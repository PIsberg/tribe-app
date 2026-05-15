import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ensureUser, adjustTribeMemberCount, readTribeMemberCount } from "./metrics";
import { assertFireHasCapacity, FIRE_CAPACITY } from "./lib/capacity";
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

    // First-time join: enforce the per-fire soft cap. Existing members
    // (above) bypass — they're already counted.
    await assertFireHasCapacity(ctx, tribeId, false);

    await ctx.db.insert("tribeMembers", {
      tribeId,
      userId,
      userName,
      avatarSeed,
      joinedAt: Date.now(),
    });
    await adjustTribeMemberCount(ctx, tribeId, 1);

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

/**
 * Capacity-aware join. Tries to join the target tribe; if it's full,
 * routes the user to an existing non-full overflow sibling, or creates a
 * new overflow tribe if none exists.
 *
 * Returns the tribeId the user actually ended up in — callers must
 * redirect when it differs from the requested one.
 *
 * Existing members of the target tribe always succeed there regardless
 * of capacity (the soft cap is on growth, not on people already in).
 */
export const joinOrOverflow = mutation({
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

    // Helper: try to insert the member into `targetId`. Returns true if the
    // member ended up there (existing or new), false if the target is full.
    const tryJoin = async (targetId: typeof tribeId): Promise<boolean> => {
      const targetMembers = await ctx.db
        .query("tribeMembers")
        .withIndex("by_tribeId", (q) => q.eq("tribeId", targetId))
        .take(500);
      const collision = targetMembers.find(
        (m) => m.userId !== userId && m.userName.trim().toLowerCase() === normalized
      );
      if (collision) throw new ConvexError("That name is already taken in this tribe.");
      const existing = targetMembers.find((m) => m.userId === userId) ?? null;
      if (existing) {
        if (existing.userName !== userName) await ctx.db.patch(existing._id, { userName });
        return true;
      }
      const count = await readTribeMemberCount(ctx, targetId);
      if (count >= FIRE_CAPACITY) return false;
      await ctx.db.insert("tribeMembers", {
        tribeId: targetId,
        userId,
        userName,
        avatarSeed,
        joinedAt: Date.now(),
      });
      await adjustTribeMemberCount(ctx, targetId, 1);
      const t = await ctx.db.get(targetId);
      if (t) {
        await ctx.scheduler.runAfter(5000, internal.bots.welcomeUser, {
          tribeId: targetId,
          userName,
          tribeName: t.name,
        });
      }
      return true;
    };

    await ensureUser(ctx, userId);

    // Try the target tribe first.
    if (await tryJoin(tribeId)) return { tribeId, redirected: false };

    // Target is full. Look for an existing overflow sibling with room.
    // Walk both directions: if target is itself an overflow, find its root.
    const target = await ctx.db.get(tribeId);
    if (!target) throw new ConvexError("Target tribe not found.");
    const rootId = target.overflowOf ?? tribeId;

    // Collect siblings: the root + everything that overflows from it.
    const siblings: Array<typeof target> = [];
    if (target.overflowOf) {
      const root = await ctx.db.get(rootId);
      if (root) siblings.push(root);
    }
    const overflows = await ctx.db
      .query("tribes")
      .withIndex("by_overflowOf", (q) => q.eq("overflowOf", rootId))
      .take(50);
    siblings.push(...overflows);

    for (const sib of siblings) {
      if (sib._id === tribeId) continue; // already tried
      if (await tryJoin(sib._id)) return { tribeId: sib._id, redirected: true };
    }

    // No room anywhere. Spin up a new overflow tribe in the same geohash cell.
    const overflowIndex = overflows.length + 1;
    const root = target.overflowOf ? await ctx.db.get(rootId) : target;
    const baseName = root?.name ?? target.name;
    const newTribeId = await ctx.db.insert("tribes", {
      name: `${baseName} ${overflowIndex + 1}`,
      creatorId: userId,
      lat: target.lat,
      lng: target.lng,
      createdAt: Date.now(),
      geohash4: target.geohash4,
      overflowOf: rootId,
    });
    // Greet + welcome via existing bot flow.
    await ctx.scheduler.runAfter(500, internal.bots.greetTribe, {
      tribeId: newTribeId,
      tribeName: `${baseName} ${overflowIndex + 1}`,
    });
    const ok = await tryJoin(newTribeId);
    // tryJoin can't fail on a brand-new tribe, but assert defensively.
    if (!ok) throw new ConvexError("FIRE_FULL");
    return { tribeId: newTribeId, redirected: true };
  },
});
