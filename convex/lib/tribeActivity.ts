import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const TOUCH_THROTTLE_MS = 30_000;

/**
 * Updates tribe.lastMessageAt — but only if the last update was more than
 * TOUCH_THROTTLE_MS ago.
 *
 * Patching the tribe doc on every message would invalidate every subscription
 * that reads the doc (listNearby, listWithCounts, getById, the in-fire
 * geofence gate). Throttling to once per 30s cuts that fan-out ~30× on busy
 * fires while keeping the "hottest" / "active" sort fresh enough for UI.
 *
 * Callers may pass a pre-fetched tribe doc to save a read.
 */
export async function touchTribeActivity(
  ctx: MutationCtx,
  tribeId: Id<"tribes">,
  prefetched?: Doc<"tribes"> | null
): Promise<void> {
  const tribe = prefetched ?? (await ctx.db.get(tribeId));
  if (!tribe) return;
  const now = Date.now();
  if ((tribe.lastMessageAt ?? 0) + TOUCH_THROTTLE_MS <= now) {
    await ctx.db.patch(tribeId, { lastMessageAt: now });
  }
}
