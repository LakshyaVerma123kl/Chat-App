import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    isOnline: v.boolean(),
  }).index("by_clerkId", ["clerkId"]),

  conversations: defineTable({
    participantIds: v.array(v.string()),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    text: v.string(),
    isDeleted: v.optional(v.boolean()),
    reactions: v.optional(
      v.array(
        v.object({
          emoji: v.string(),
          userId: v.string(),
        }),
      ),
    ),
  }).index("by_conversationId", ["conversationId"]),
  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
  })
    .index("by_conversation_and_user", ["conversationId", "userId"])
    .index("by_conversation", ["conversationId"]),

  readReceipts: defineTable({
    userId: v.string(),
    conversationId: v.id("conversations"),
    lastReadTime: v.number(),
  })
    .index("by_conversation_and_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),
});
