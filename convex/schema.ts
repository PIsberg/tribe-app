import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    text: v.string(),
    author: v.string(),
    authorId: v.string(),
    timestamp: v.number(),
    avatarSeed: v.string(),
  }).index("by_timestamp", ["timestamp"]),
});
