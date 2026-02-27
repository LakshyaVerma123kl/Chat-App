import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const currentUserId = identity.subject;

    const existingConversations = await ctx.db.query("conversations").collect();
    const existingConversation = existingConversations.find(
      (conv) =>
        !conv.isGroup &&
        conv.participantIds.includes(currentUserId) &&
        conv.participantIds.includes(args.otherUserId),
    );

    if (existingConversation) return existingConversation._id;

    return await ctx.db.insert("conversations", {
      participantIds: [currentUserId, args.otherUserId],
      isGroup: false,
    });
  },
});

export const createGroup = mutation({
  args: {
    participantIds: v.array(v.string()),
    groupName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const allParticipants = [
      ...new Set([...args.participantIds, identity.subject]),
    ];

    return await ctx.db.insert("conversations", {
      participantIds: allParticipants,
      isGroup: true,
      groupName: args.groupName,
    });
  },
});
