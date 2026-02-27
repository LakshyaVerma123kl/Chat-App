import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_conversation_and_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", identity.subject),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastReadTime: now });
    } else {
      await ctx.db.insert("readReceipts", {
        userId: identity.subject,
        conversationId: args.conversationId,
        lastReadTime: now,
      });
    }
  },
});

export const getSidebarData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUserId = identity.subject;

    const allUsers = await ctx.db.query("users").collect();
    const otherUsers = allUsers.filter((u) => u.clerkId !== currentUserId);

    const conversations = await ctx.db.query("conversations").collect();
    const myConversations = conversations.filter((c) =>
      c.participantIds.includes(currentUserId),
    );

    const myReceipts = await ctx.db
      .query("readReceipts")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .collect();

    const sidebarItems = [];

    for (const user of otherUsers) {
      const conversation = myConversations.find(
        (c) => !c.isGroup && c.participantIds.includes(user.clerkId),
      );

      let lastMessage = null;
      let unreadCount = 0;

      if (conversation) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .order("desc")
          .collect();

        if (messages.length > 0) {
          lastMessage = messages[0];
          const receipt = myReceipts.find(
            (r) => r.conversationId === conversation._id,
          );
          const lastReadTime = receipt ? receipt.lastReadTime : 0;
          unreadCount = messages.filter(
            (m) =>
              m.senderId !== currentUserId && m._creationTime > lastReadTime,
          ).length;
        }
      }

      sidebarItems.push({
        id: user._id,
        isGroup: false,
        conversationId: conversation?._id,
        otherUserId: user.clerkId,
        name: user.name,
        imageUrl: user.imageUrl,
        isOnline: user.isOnline,
        lastMessage,
        unreadCount,
      });
    }

    const groupConversations = myConversations.filter((c) => c.isGroup);
    for (const group of groupConversations) {
      let lastMessage = null;
      let unreadCount = 0;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", group._id),
        )
        .order("desc")
        .collect();

      if (messages.length > 0) {
        lastMessage = messages[0];
        const receipt = myReceipts.find((r) => r.conversationId === group._id);
        const lastReadTime = receipt ? receipt.lastReadTime : 0;
        unreadCount = messages.filter(
          (m) => m.senderId !== currentUserId && m._creationTime > lastReadTime,
        ).length;
      }

      sidebarItems.push({
        id: group._id,
        isGroup: true,
        conversationId: group._id,
        name: group.groupName || "Unnamed Group",
        memberCount: group.participantIds.length,
        lastMessage,
        unreadCount,
      });
    }

    return sidebarItems.sort((a, b) => {
      const timeA = a.lastMessage?._creationTime || 0;
      const timeB = b.lastMessage?._creationTime || 0;
      return timeB - timeA;
    });
  },
});
