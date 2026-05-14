import { v } from "convex/values";
import { query } from "./_generated/server";

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
