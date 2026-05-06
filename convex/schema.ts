import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tribes: defineTable({
    name: v.string(),
    creatorId: v.string(),
    lat: v.number(),
    lng: v.number(),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  }).index("by_createdAt", ["createdAt"]),

  typing: defineTable({
    tribeId: v.id("tribes"),
    userId: v.string(),
    userName: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tribeId", ["tribeId"])
    .index("by_tribeId_and_userId", ["tribeId", "userId"])
    .index("by_tribeId_and_updatedAt", ["tribeId", "updatedAt"]),

  messages: defineTable({
    tribeId: v.id("tribes"),
    text: v.string(),
    author: v.string(),
    authorId: v.string(),
    timestamp: v.number(),
    avatarSeed: v.string(),
    likes: v.array(v.string()),
    parentId: v.optional(v.id("messages")),
    replyCount: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_tribeId_and_timestamp", ["tribeId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_parentId_and_timestamp", ["parentId", "timestamp"]),

  tribeMembers: defineTable({
    tribeId: v.id("tribes"),
    userId: v.string(),
    userName: v.string(),
    avatarSeed: v.string(),
    joinedAt: v.number(),
    warnCount: v.optional(v.number()),
    kickCount: v.optional(v.number()),
    kickedUntil: v.optional(v.number()),
    kicked: v.optional(v.boolean()),
    banned: v.optional(v.boolean()),
  })
    .index("by_tribeId", ["tribeId"])
    .index("by_tribeId_and_userId", ["tribeId", "userId"]),
});
