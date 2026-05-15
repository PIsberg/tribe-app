import { ConvexError } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export async function checkRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key_and_window", (q) =>
      q.eq("key", key).eq("windowStart", windowStart)
    )
    .unique();
  if (existing) {
    if (existing.count >= limit) {
      throw new ConvexError("Too many requests. Please slow down.");
    }
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else {
    await ctx.db.insert("rateLimits", { key, windowStart, count: 1 });
  }
}

// All current callers use a 60s window. 5 minutes gives generous headroom
// in case a longer-window limit is added later, while keeping the table
// O(active_users) instead of O(active_users × time).
const STALE_AFTER_MS = 5 * 60 * 1000;

/** Cron-driven cleanup. Self-reschedules if the batch was full. */
export const purgeStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    // No index on windowStart — full scan is fine because we cap at 500/run
    // and the cron rate × 500 keeps up with rate-limit row growth at the
    // scales we're targeting. If the table ever outpaces this, add an index.
    const stale = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("windowStart"), cutoff))
      .take(500);
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
    if (stale.length === 500) {
      await ctx.scheduler.runAfter(0, internal.lib.rateLimit.purgeStale, {});
    }
    return stale.length;
  },
});
