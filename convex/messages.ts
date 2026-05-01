import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

const THIRTY_MINUTES = 30 * 60 * 1000;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    return ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", cutoff))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    text: v.string(),
    author: v.string(),
    authorId: v.string(),
    avatarSeed: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("messages", { ...args, timestamp: Date.now() });
  },
});

export const deleteOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const old = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .collect();
    await Promise.all(old.map((m) => ctx.db.delete(m._id)));
    return old.length;
  },
});
