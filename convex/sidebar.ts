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
          .eq("userId", identity.subject)
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
      c.participantIds.includes(currentUserId)
    );

    const myReceipts = await ctx.db
      .query("readReceipts")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .collect();

    const sidebarItems = [];

    // Direct message users
    for (const user of otherUsers) {
      const conversation = myConversations.find(
        (c) => !c.isGroup && c.participantIds.includes(user.clerkId)
      );

      let lastMessage = null;
      let unreadCount = 0;

      if (conversation) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .collect();

        if (messages.length > 0) {
          lastMessage = messages[0];
          const receipt = myReceipts.find(
            (r) => r.conversationId === conversation._id
          );
          const lastReadTime = receipt ? receipt.lastReadTime : 0;
          unreadCount = messages.filter(
            (m) =>
              m.senderId !== currentUserId &&
              m._creationTime > lastReadTime &&
              !m.isDeleted
          ).length;
        }
      }

      sidebarItems.push({
        id: user._id,
        isGroup: false as const,
        conversationId: conversation?._id as string | undefined,
        otherUserId: user.clerkId,
        name: user.name,
        imageUrl: user.imageUrl,
        isOnline: user.isOnline,
        lastMessage: lastMessage
          ? {
              _creationTime: lastMessage._creationTime,
              text: lastMessage.isDeleted
                ? "Message deleted"
                : lastMessage.text,
              isDeleted: lastMessage.isDeleted ?? false,
            }
          : null,
        unreadCount,
        memberCount: undefined as number | undefined,
      });
    }

    // Group conversations
    const groupConversations = myConversations.filter((c) => c.isGroup);
    for (const group of groupConversations) {
      let lastMessage = null;
      let unreadCount = 0;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", group._id)
        )
        .order("desc")
        .collect();

      if (messages.length > 0) {
        lastMessage = messages[0];
        const receipt = myReceipts.find((r) => r.conversationId === group._id);
        const lastReadTime = receipt ? receipt.lastReadTime : 0;
        unreadCount = messages.filter(
          (m) =>
            m.senderId !== currentUserId &&
            m._creationTime > lastReadTime &&
            !m.isDeleted
        ).length;
      }

      sidebarItems.push({
        id: group._id,
        isGroup: true as const,
        conversationId: group._id as string,
        name: group.groupName ?? "Unnamed Group",
        imageUrl: undefined as string | undefined,
        isOnline: undefined as boolean | undefined,
        otherUserId: undefined as string | undefined,
        lastMessage: lastMessage
          ? {
              _creationTime: lastMessage._creationTime,
              text: lastMessage.isDeleted
                ? "Message deleted"
                : lastMessage.text,
              isDeleted: lastMessage.isDeleted ?? false,
            }
          : null,
        unreadCount,
        memberCount: group.participantIds.length,
      });
    }

    // Sort: conversations with messages first (by recency), then users without conversations
    return sidebarItems.sort((a, b) => {
      const timeA = a.lastMessage?._creationTime ?? 0;
      const timeB = b.lastMessage?._creationTime ?? 0;
      return timeB - timeA;
    });
  },
});