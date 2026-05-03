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
  })
    .index("by_tribeId_and_timestamp", ["tribeId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_parentId_and_timestamp", ["parentId", "timestamp"]),
});
