import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, { tribeId }) => {
    return ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId", (q) => q.eq("tribeId", tribeId))
      .collect();
  },
});
