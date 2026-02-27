import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    return messages;
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: identity.subject,
      text: args.text,
    });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId !== identity.subject) {
      throw new Error("You can only delete your own messages");
    }

    await ctx.db.patch(args.messageId, { isDeleted: true });
  },
});
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const userId = identity.subject;
    const currentReactions = message.reactions ?? [];

    const existingIndex = currentReactions.findIndex(
      (r) => r.emoji === args.emoji && r.userId === userId,
    );

    let newReactions;
    if (existingIndex !== -1) {
      newReactions = [...currentReactions];
      newReactions.splice(existingIndex, 1);
    } else {
      newReactions = [...currentReactions, { emoji: args.emoji, userId }];
    }

    await ctx.db.patch(args.messageId, { reactions: newReactions });
  },
});
