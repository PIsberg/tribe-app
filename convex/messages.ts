import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const THIRTY_MINUTES = 30 * 60 * 1000;

export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_timestamp", (q) =>
        q.eq("tribeId", args.tribeId).gt("timestamp", cutoff)
      )
      .order("asc")
      .take(200);
    return Promise.all(
      messages.map(async (m) => ({
        ...m,
        imageUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : null,
      }))
    );
  },
});

export const listThread = query({
  args: { parentId: v.id("messages") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_parentId_and_timestamp", (q) =>
        q.eq("parentId", args.parentId).gt("timestamp", cutoff)
      )
      .order("asc")
      .take(50);
    return Promise.all(
      messages.map(async (m) => ({
        ...m,
        imageUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : null,
      }))
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return ctx.storage.generateUploadUrl();
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
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { parentId, storageId, ...rest } = args;

    // Enforcement: check ban / temp-kick before inserting anything
    const member = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", args.tribeId).eq("userId", args.authorId)
      )
      .first();

    if (member?.banned) {
      throw new ConvexError("You have been permanently banned from this campfire. 🔨");
    }
    if (member?.kicked) {
      throw new ConvexError("You've been kicked from this campfire. 🚫");
    }
    if (member?.kickedUntil && member.kickedUntil > Date.now()) {
      const remaining = Math.ceil((member.kickedUntil - Date.now()) / 60_000);
      throw new ConvexError(
        `Muted. You can try again in ${remaining} minute${remaining !== 1 ? "s" : ""}. 🔇`
      );
    }

    const id = await ctx.db.insert("messages", {
      ...rest,
      timestamp: Date.now(),
      likes: [],
      ...(parentId ? { parentId } : {}),
      ...(storageId ? { storageId } : {}),
    });
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, { replyCount: (parent.replyCount ?? 0) + 1 });
      }
    }
    await ctx.db.patch(args.tribeId, { lastMessageAt: Date.now() });

    // Register member as fallback if joinTribe was never called
    if (!parentId) {
      if (!member) {
        await ctx.db.insert("tribeMembers", {
          tribeId: args.tribeId,
          userId: args.authorId,
          userName: args.author,
          avatarSeed: args.avatarSeed,
          joinedAt: Date.now(),
        });
      }

      // Schedule moderation check for every top-level message
      await ctx.scheduler.runAfter(0, internal.bots.moderateMessage, {
        tribeId: args.tribeId,
        authorId: args.authorId,
        authorName: args.author,
        text: args.text,
      });
    }

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

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.authorId !== args.userId) return;
    if (message.storageId) await ctx.storage.delete(message.storageId);
    if (message.parentId) {
      const parent = await ctx.db.get(message.parentId);
      if (parent) {
        await ctx.db.patch(message.parentId, {
          replyCount: Math.max(0, (parent.replyCount ?? 1) - 1),
        });
      }
    }
    await ctx.db.delete(args.messageId);
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
    await Promise.all(
      old.map(async (m) => {
        if (m.storageId) await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
      })
    );
    return old.length;
  },
});
