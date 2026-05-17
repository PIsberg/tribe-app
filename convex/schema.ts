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
    geohash4: v.optional(v.string()),
    // For overflow tribes: id of the original tribe this is sharded from.
    // Null/undefined on the root tribe in the family.
    overflowOf: v.optional(v.id("tribes")),
    // Transit fires: follow a moving vehicle (bus/train)
    mode: v.optional(v.union(v.literal("static"), v.literal("transit"))),
    transitLat: v.optional(v.number()),
    transitLng: v.optional(v.number()),
    transitBearing: v.optional(v.number()),
    transitSpeedKmh: v.optional(v.number()),
    transitUpdatedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_geohash4", ["geohash4"])
    .index("by_overflowOf", ["overflowOf"])
    .index("by_mode_and_transitUpdatedAt", ["mode", "transitUpdatedAt"]),

  typing: defineTable({
    tribeId: v.id("tribes"),
    userId: v.string(),
    userName: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tribeId", ["tribeId"])
    .index("by_tribeId_and_userId", ["tribeId", "userId"])
    .index("by_tribeId_and_updatedAt", ["tribeId", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"]),

  messages: defineTable({
    tribeId: v.id("tribes"),
    text: v.string(),
    author: v.string(),
    authorId: v.string(),
    timestamp: v.number(),
    avatarSeed: v.string(),
    likes: v.optional(v.array(v.string())),
    parentId: v.optional(v.id("messages")),
    replyCount: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_tribeId_and_timestamp", ["tribeId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_parentId_and_timestamp", ["parentId", "timestamp"])
    .index("by_tribeId_and_authorId", ["tribeId", "authorId"]),

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
    .index("by_tribeId_and_userId", ["tribeId", "userId"])
    .index("by_tribeId_and_userName", ["tribeId", "userName"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    tribeId: v.optional(v.id("tribes")),
    userId: v.string(),
    kind: v.literal("like"),
    createdAt: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_messageId_and_userId", ["messageId", "userId"])
    .index("by_tribeId", ["tribeId"]),

  counters: defineTable({
    key: v.string(),
    shard: v.number(),
    count: v.number(),
  }).index("by_key_and_shard", ["key", "shard"]),

  users: defineTable({
    userId: v.string(),
    firstSeenAt: v.number(),
  }).index("by_userId", ["userId"]),

  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  })
    .index("by_key_and_window", ["key", "windowStart"])
    .index("by_windowStart", ["windowStart"]),
});
