import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { findUserByUsername, requireUserBySession } from "./model.js";
import { normalizeUsername } from "./security.js";

export const listMine = query({
  args: {
    sessionToken: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const outgoing = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
      .collect();

    const friends = await Promise.all(
      outgoing.map(async (record) => {
        const friendRecord = record as unknown as {
          _id: Id<"friends">;
          recipientId: Id<"users">;
          status: "pending" | "accepted";
        };
        const recipient = await ctx.db.get(friendRecord.recipientId);
        const recipientRecord = recipient as
          | { username: string; displayName: string }
          | null;

        return recipientRecord
          ? {
              id: friendRecord._id,
              username: recipientRecord.username,
              displayName: recipientRecord.displayName,
              status: friendRecord.status
            }
          : null;
      })
    );

    return friends.filter((friend): friend is NonNullable<typeof friend> => friend !== null);
  }
});

export const add = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string()
  },
  handler: async (ctx, args) => {
    const requester = await requireUserBySession(ctx, args.sessionToken);
    const recipient = await findUserByUsername(ctx, normalizeUsername(args.username));

    if (!recipient) {
      throw new Error("That username does not exist.");
    }

    if (recipient._id === requester._id) {
      throw new Error("You cannot add yourself as a friend.");
    }

    const existingFriends = await ctx.db
      .query("friends")
      .withIndex("by_pair", (q) => q.eq("requesterId", requester._id))
      .collect();
    const existing = existingFriends.find((record) => {
      const friend = record as unknown as { recipientId: Id<"users"> };
      return friend.recipientId === recipient._id;
    });

    if (existing) {
      return null;
    }

    await ctx.db.insert("friends", {
      requesterId: requester._id,
      recipientId: recipient._id,
      status: "pending",
      createdAt: Date.now()
    });

    return null;
  }
});

export const setNickname = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string(),
    nickname: v.string()
  },
  handler: async (ctx, args) => {
    const owner = await requireUserBySession(ctx, args.sessionToken);
    const target = await findUserByUsername(ctx, normalizeUsername(args.username));
    const nickname = args.nickname.trim();

    if (!target) {
      throw new Error("That username does not exist.");
    }

    if (nickname.length < 1 || nickname.length > 40) {
      throw new Error("Nickname must be 1-40 characters.");
    }

    const existingNicknames = await ctx.db
      .query("nicknames")
      .withIndex("by_owner_target", (q) => q.eq("ownerId", owner._id))
      .collect();
    const existing = existingNicknames.find((record) => {
      const nicknameRecord = record as unknown as { targetUserId: Id<"users"> };
      return nicknameRecord.targetUserId === target._id;
    }) as { _id: Id<"nicknames"> } | undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        nickname,
        updatedAt: Date.now()
      });
      return null;
    }

    await ctx.db.insert("nicknames", {
      ownerId: owner._id,
      targetUserId: target._id,
      nickname,
      updatedAt: Date.now()
    });

    return null;
  }
});
