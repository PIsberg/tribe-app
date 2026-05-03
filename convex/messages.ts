import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

const THIRTY_MINUTES = 30 * 60 * 1000;

export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    return ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_timestamp", (q) =>
        q.eq("tribeId", args.tribeId).gt("timestamp", cutoff)
      )
      .order("asc")
      .take(200);
  },
});

export const listThread = query({
  args: { parentId: v.id("messages") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    return ctx.db
      .query("messages")
      .withIndex("by_parentId_and_timestamp", (q) =>
        q.eq("parentId", args.parentId).gt("timestamp", cutoff)
      )
      .order("asc")
      .take(50);
  },
});

export const send = mutation({
  args: {
    tribeId: v.id("tribes"),
    text: v.string(),
    author: v.string(),
    authorId: v.string(),
    avatarSeed: v.string(),
    parentId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const { parentId, ...rest } = args;
    const id = await ctx.db.insert("messages", {
      ...rest,
      timestamp: Date.now(),
      likes: [],
      ...(parentId ? { parentId } : {}),
    });
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, { replyCount: (parent.replyCount ?? 0) + 1 });
      }
    }
    await ctx.db.patch(args.tribeId, { lastMessageAt: Date.now() });
    return id;
  },
});

export const toggleLike = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    const liked = message.likes.includes(args.userId);
    await ctx.db.patch(args.messageId, {
      likes: liked
        ? message.likes.filter((id) => id !== args.userId)
        : [...message.likes, args.userId],
    });
  },
});

export const deleteOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const old = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(100);
    await Promise.all(old.map((m) => ctx.db.delete(m._id)));
    return old.length;
  },
});
