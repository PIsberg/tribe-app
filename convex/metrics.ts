import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertAdmin } from "./lib/auth";

const SHARDS = 10;

export type CounterKey = "tribes_created" | "messages_sent" | "unique_users";

export async function incrementCounter(ctx: MutationCtx, key: CounterKey): Promise<void> {
  const shard = Math.floor(Math.random() * SHARDS);
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_key_and_shard", (q) => q.eq("key", key).eq("shard", shard))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else {
    await ctx.db.insert("counters", { key, shard, count: 1 });
  }
}

export async function readCounter(ctx: QueryCtx, key: CounterKey): Promise<number> {
  const shards = await ctx.db
    .query("counters")
    .withIndex("by_key_and_shard", (q) => q.eq("key", key))
    .take(SHARDS + 5);
  return shards.reduce((sum, s) => sum + s.count, 0);
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
