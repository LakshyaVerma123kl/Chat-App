import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user !== null) {
      if (
        user.name !== identity.name ||
        user.imageUrl !== identity.pictureUrl
      ) {
        await ctx.db.patch(user._id, {
          name: identity.name ?? "Anonymous",
          imageUrl: identity.pictureUrl,
        });
      }
      return user._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name ?? "Anonymous",
      email: identity.email ?? "",
      imageUrl: identity.pictureUrl,
      isOnline: true,
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u.clerkId !== identity.subject);
  },
});
export const updateStatus = mutation({
  args: { isOnline: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { isOnline: args.isOnline });
    }
  },
});
