import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const set = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation_and_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", identity.subject),
      )
      .unique();

    if (args.isTyping && !existing) {
      await ctx.db.insert("typing", {
        conversationId: args.conversationId,
        userId: identity.subject,
      });
    } else if (!args.isTyping && existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getActive = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const typers = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const otherTypers = typers.filter((t) => t.userId !== identity.subject);

    const activeUsers = await Promise.all(
      otherTypers.map(async (t) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", t.userId))
          .unique();
        return user?.name || "Someone";
      }),
    );

    return activeUsers;
  },
});
