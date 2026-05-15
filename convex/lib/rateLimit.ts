import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

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
