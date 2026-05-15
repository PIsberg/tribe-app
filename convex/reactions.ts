import { v } from "convex/values";
import { query } from "./_generated/server";

const THIRTY_MINUTES = 30 * 60 * 1000;

/** Returns the user IDs of everyone who liked a message. */
export const likesForMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
      .take(500);
    return rows.filter((r) => r.kind === "like").map((r) => r.userId);
  },
});

/**
 * Returns a {messageId: userIds[]} map for all live likes in a tribe.
 *
 * Subscribed alongside messages.list so that liking a message no longer
 * invalidates the message-list subscription for every connected client.
 * Bounded by the 30-min message TTL — reactions are deleted with their
 * parent message, so the table size tracks active messages.
 */
export const likesForTribe = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, { tribeId }) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .take(5000);
    const out: Record<string, string[]> = {};
    for (const r of rows) {
      if (r.kind !== "like") continue;
      if (r.createdAt < cutoff) continue;
      (out[r.messageId as string] ??= []).push(r.userId);
    }
    return out;
  },
});
