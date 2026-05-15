import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdmin } from "./lib/auth";

const SHARDS = 10;

export type CounterKey = "tribes_created" | "messages_sent" | "unique_users";

async function adjustShardedCounter(
  ctx: MutationCtx,
  key: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  const shard = Math.floor(Math.random() * SHARDS);
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_key_and_shard", (q) => q.eq("key", key).eq("shard", shard))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { count: existing.count + delta });
  } else {
    await ctx.db.insert("counters", { key, shard, count: delta });
  }
}

async function readShardedCounter(ctx: QueryCtx, key: string): Promise<number> {
  const shards = await ctx.db
    .query("counters")
    .withIndex("by_key_and_shard", (q) => q.eq("key", key))
    .take(SHARDS + 5);
  return shards.reduce((sum, s) => sum + s.count, 0);
}

export async function incrementCounter(ctx: MutationCtx, key: CounterKey): Promise<void> {
  await adjustShardedCounter(ctx, key, 1);
}

export async function readCounter(ctx: QueryCtx, key: CounterKey): Promise<number> {
  return readShardedCounter(ctx, key);
}

// Per-tribe active-member counter (active = !kicked && !banned). Sharded so
// concurrent joins don't contend. Used by tribes.listWithCountsNearby to
// avoid fetching up to 500 member rows per nearby tribe on every map update.
function tribeMemberKey(tribeId: Id<"tribes">): string {
  return `tribe_members:${tribeId}`;
}

export async function adjustTribeMemberCount(
  ctx: MutationCtx,
  tribeId: Id<"tribes">,
  delta: number
): Promise<void> {
  await adjustShardedCounter(ctx, tribeMemberKey(tribeId), delta);
}

export async function readTribeMemberCount(
  ctx: QueryCtx,
  tribeId: Id<"tribes">
): Promise<number> {
  return Math.max(0, await readShardedCounter(ctx, tribeMemberKey(tribeId)));
}

/** Delta to the active-member counter when a member doc transitions
 *  from `before` to `after`. Pass `null` for `before` on insert,
 *  `null` for `after` on delete. */
export function tribeMemberActiveDelta(
  before: { kicked?: boolean; banned?: boolean } | null,
  after: { kicked?: boolean; banned?: boolean } | null
): number {
  const wasActive = before ? !before.kicked && !before.banned : false;
  const isActive = after ? !after.kicked && !after.banned : false;
  return (isActive ? 1 : 0) - (wasActive ? 1 : 0);
}

export async function ensureUser(ctx: MutationCtx, userId: string): Promise<void> {
  if (!userId || userId.startsWith("bot-")) return;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (existing) return;
  await ctx.db.insert("users", { userId, firstSeenAt: Date.now() });
  await incrementCounter(ctx, "unique_users");
}

// ─── Per-tribe push-latency telemetry ────────────────────────────────────────
//
// Clients sample (send→onUpdate reflecting that send) and report the latency
// here. Aggregated into sum + count sharded counters per tribe so the stats
// page / admin can compute mean push-latency per fire and spot fires that are
// melting before users complain. Bucketed by 10-min wall-clock window so old
// samples expire naturally as the tribe's TTL elapses.
//
// Cheap, fire-and-forget — no rate limit on this mutation because clients
// only sample ~1 in every N sends.

function pushLatencyBucket(now: number): number {
  return Math.floor(now / (10 * 60 * 1000));
}

export const recordPushLatency = mutation({
  args: {
    tribeId: v.id("tribes"),
    latencyMs: v.number(),
  },
  handler: async (ctx, { tribeId, latencyMs }) => {
    if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 60_000) return;
    const bucket = pushLatencyBucket(Date.now());
    const sumKey = `push_lat_sum:${tribeId}:${bucket}`;
    const countKey = `push_lat_n:${tribeId}:${bucket}`;
    await adjustShardedCounter(ctx, sumKey, Math.round(latencyMs));
    await adjustShardedCounter(ctx, countKey, 1);
  },
});

/** Mean push-latency for a tribe over the most recent N 10-min buckets.
 *  Returns null if there are no samples in the window. */
export async function readTribePushLatencyMean(
  ctx: QueryCtx,
  tribeId: Id<"tribes">,
  buckets = 3
): Promise<{ meanMs: number; samples: number } | null> {
  const now = Date.now();
  let totalSum = 0;
  let totalN = 0;
  for (let i = 0; i < buckets; i++) {
    const bucket = pushLatencyBucket(now) - i;
    totalSum += await readShardedCounter(ctx, `push_lat_sum:${tribeId}:${bucket}`);
    totalN += await readShardedCounter(ctx, `push_lat_n:${tribeId}:${bucket}`);
  }
  if (totalN <= 0) return null;
  return { meanMs: Math.round(totalSum / totalN), samples: totalN };
}

export const getLifetimeMetrics = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    assertAdmin(token);
    const [tribesEver, messagesEver, uniqueUsers] = await Promise.all([
      readCounter(ctx, "tribes_created"),
      readCounter(ctx, "messages_sent"),
      readCounter(ctx, "unique_users"),
    ]);
    const oldest = await ctx.db.query("counters").order("asc").first();
    return {
      tribesEver,
      messagesEver,
      uniqueUsers,
      trackingSince: oldest?._creationTime ?? null,
    };
  },
});
