import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { incrementCounter, ensureUser, adjustTribeMemberCount } from "./metrics";
import { assertFireHasCapacity } from "./lib/capacity";
import { checkRateLimit } from "./lib/rateLimit";
import { assertInRadius } from "./lib/geofence";
import { touchTribeActivity } from "./lib/tribeActivity";
import type { Doc } from "./_generated/dataModel";

const THIRTY_MINUTES = 30 * 60 * 1000;

function assertCanPost(member: Doc<"tribeMembers"> | null): void {
  if (!member) return;
  if (member.banned) {
    throw new ConvexError("You have been permanently banned from this campfire. 🔨");
  }
  if (member.kicked) {
    throw new ConvexError("You've been kicked from this campfire. 🚫");
  }
  if (member.kickedUntil && member.kickedUntil > Date.now()) {
    const remaining = Math.ceil((member.kickedUntil - Date.now()) / 60_000);
    throw new ConvexError(
      `Muted. You can try again in ${remaining} minute${remaining !== 1 ? "s" : ""}. 🔇`
    );
  }
}

// Likes are fetched via a separate subscription (api.reactions.likesForTribe).
// Splitting them off means a like no longer invalidates this query for every
// subscriber, and a message no longer triggers a 10k-reaction scan.
export const list = query({
  args: { tribeId: v.id("tribes") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    // Newest-first so the 200-message cap always includes the latest messages.
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_timestamp", (q) =>
        q.eq("tribeId", args.tribeId).gt("timestamp", cutoff)
      )
      .order("desc")
      .take(200);
    messages.reverse(); // chronological order for the frontend

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
  args: {
    userId: v.string(),
    tribeId: v.id("tribes"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", args.tribeId).eq("userId", args.userId)
      )
      .first();
    if (!member) throw new ConvexError("You must be a tribe member to upload images.");
    assertCanPost(member);
    await checkRateLimit(ctx, `upload:${args.userId}`, 5, 60_000);
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
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { parentId, storageId, lat, lng, ...rest } = args;

    const tribe = await ctx.db.get(args.tribeId);
    if (!tribe) throw new ConvexError("Campfire not found.");
    assertInRadius(tribe, lat, lng);

    await checkRateLimit(ctx, `send:${args.authorId}:${args.tribeId}`, 30, 60_000);

    const member = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", args.tribeId).eq("userId", args.authorId)
      )
      .first();

    if (
      args.author.trim().toLowerCase().startsWith("@tribe-admin") &&
      member?.userName !== "@Tribe-admin"
    ) {
      throw new ConvexError("Reserved name.");
    }

    assertCanPost(member);
    if (storageId && !member) {
      throw new ConvexError("You must be a tribe member to attach images.");
    }

    await incrementCounter(ctx, "messages_sent");
    await ensureUser(ctx, args.authorId);

    const id = await ctx.db.insert("messages", {
      ...rest,
      timestamp: Date.now(),
      ...(parentId ? { parentId } : {}),
      ...(storageId ? { storageId } : {}),
    });
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, { replyCount: (parent.replyCount ?? 0) + 1 });
      }
    }
    await touchTribeActivity(ctx, args.tribeId, tribe);

    if (!parentId) {
      if (!member) {
        // Auto-create-on-first-message path also respects the soft cap.
        await assertFireHasCapacity(ctx, args.tribeId, false);
        await ctx.db.insert("tribeMembers", {
          tribeId: args.tribeId,
          userId: args.authorId,
          userName: args.author,
          avatarSeed: args.avatarSeed,
          joinedAt: Date.now(),
        });
        await adjustTribeMemberCount(ctx, args.tribeId, 1);
      }

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
    await checkRateLimit(ctx, `like:${args.userId}`, 60, 60_000);
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        tribeId: message.tribeId,
        userId: args.userId,
        kind: "like",
        createdAt: Date.now(),
      });
    }
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
    // Clean up any reactions on this message before deleting it.
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .take(500);
    await Promise.all(reactions.map((r) => ctx.db.delete(r._id)));
    await ctx.db.delete(args.messageId);
  },
});

// Self-rescheduling: if there are ≥500 expired messages, schedules another run immediately
// so the backlog drains without waiting for the next cron tick.
export const deleteOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_MINUTES;
    const old = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(500);
    await Promise.all(
      old.map(async (m) => {
        if (m.storageId) await ctx.storage.delete(m.storageId);
        // Clean up reactions for this message.
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_messageId", (q) => q.eq("messageId", m._id))
          .take(500);
        await Promise.all(reactions.map((r) => ctx.db.delete(r._id)));
        await ctx.db.delete(m._id);
      })
    );
    if (old.length === 500) {
      await ctx.scheduler.runAfter(0, internal.messages.deleteOldMessages, {});
    }
    return old.length;
  },
});

// Deletes all messages in a tribe by a specific author, in batches. Self-rescheduling.
export const deleteByAuthor = internalMutation({
  args: { tribeId: v.id("tribes"), authorId: v.string() },
  handler: async (ctx, { tribeId, authorId }) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_authorId", (q) =>
        q.eq("tribeId", tribeId).eq("authorId", authorId)
      )
      .take(200);
    await Promise.all(
      msgs.map(async (m) => {
        if (m.storageId) await ctx.storage.delete(m.storageId);
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_messageId", (q) => q.eq("messageId", m._id))
          .take(500);
        await Promise.all(reactions.map((r) => ctx.db.delete(r._id)));
        await ctx.db.delete(m._id);
      })
    );
    if (msgs.length === 200) {
      await ctx.scheduler.runAfter(0, internal.messages.deleteByAuthor, { tribeId, authorId });
    }
  },
});
