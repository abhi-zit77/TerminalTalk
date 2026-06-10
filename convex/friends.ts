import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { findUserByUsername, requireUserBySession } from "./model.js";
import { normalizeUsername } from "./security.js";

type FriendStatus = "pending" | "accepted";
type FriendRecord = {
  _id: Id<"friends">;
  requesterId: Id<"users">;
  recipientId: Id<"users">;
  status: FriendStatus;
};

export const listMine = query({
  args: {
    sessionToken: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const [outgoing, incoming, blocks, blocksTargetingUser] = await Promise.all([
      ctx.db
        .query("friends")
        .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
        .collect(),
      ctx.db
        .query("friends")
        .withIndex("by_recipient", (q) => q.eq("recipientId", user._id))
        .collect(),
      ctx.db
        .query("friendBlocks")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      ctx.db
        .query("friendBlocks")
        .withIndex("by_target", (q) => q.eq("targetUserId", user._id))
        .collect()
    ]);

    const blockedUserIds = new Set(
      [
        ...blocks.map((block) => {
          const record = block as unknown as { targetUserId: Id<"users"> };
          return record.targetUserId;
        }),
        ...blocksTargetingUser.map((block) => {
          const record = block as unknown as { ownerId: Id<"users"> };
          return record.ownerId;
        })
      ]
    );
    const relationships = [...outgoing, ...incoming] as unknown as FriendRecord[];
    const friends = await Promise.all(
      relationships
        .filter((record) => {
          const otherUserId =
            record.requesterId === user._id ? record.recipientId : record.requesterId;
          return !blockedUserIds.has(otherUserId);
        })
        .map(async (record) => {
          const isOutgoing = record.requesterId === user._id;
          const otherUserId = isOutgoing ? record.recipientId : record.requesterId;
          const otherUser = await ctx.db.get(otherUserId);
          const otherUserRecord = otherUser as
            | { username: string; displayName: string }
            | null;

          return otherUserRecord
            ? {
                id: record._id,
                userId: otherUserId,
                username: otherUserRecord.username,
                displayName: otherUserRecord.displayName,
                status: record.status,
                ...(record.status === "pending"
                  ? { direction: isOutgoing ? "outgoing" : "incoming" }
                  : {})
              }
            : null;
        })
    );
    const blockedFriends = await Promise.all(
      blocks.map(async (block) => {
        const blockRecord = block as unknown as {
          _id: Id<"friendBlocks">;
          targetUserId: Id<"users">;
        };
        const target = await ctx.db.get(blockRecord.targetUserId);
        const targetRecord = target as { username: string; displayName: string } | null;

        return targetRecord
          ? {
              id: blockRecord._id,
              userId: blockRecord.targetUserId,
              username: targetRecord.username,
              displayName: targetRecord.displayName,
              status: "blocked" as const
            }
          : null;
      })
    );

    return [...friends, ...blockedFriends].filter(
      (friend): friend is NonNullable<typeof friend> => friend !== null
    );
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

    if (await hasBlockBetween(ctx, requester._id, recipient._id)) {
      throw new Error("Friend requests are blocked for that user.");
    }

    const existing = await findRelationship(ctx, requester._id, recipient._id);
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

export const accept = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string()
  },
  handler: async (ctx, args) => {
    const recipient = await requireUserBySession(ctx, args.sessionToken);
    const requester = await findUserByUsername(ctx, normalizeUsername(args.username));

    if (!requester) {
      throw new Error("That username does not exist.");
    }

    if (await hasBlockBetween(ctx, recipient._id, requester._id)) {
      throw new Error("Friend requests are blocked for that user.");
    }

    const request = await findDirectedRelationship(ctx, requester._id, recipient._id);
    if (!request) {
      throw new Error("No pending friend request from that user.");
    }

    if (request.status === "accepted") {
      return null;
    }

    await ctx.db.patch(request._id, {
      status: "accepted"
    });

    return null;
  }
});

export const deny = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string()
  },
  handler: async (ctx, args) => {
    const recipient = await requireUserBySession(ctx, args.sessionToken);
    const requester = await findUserByUsername(ctx, normalizeUsername(args.username));

    if (!requester) {
      throw new Error("That username does not exist.");
    }

    const request = await findDirectedRelationship(ctx, requester._id, recipient._id);
    if (request && request.status === "pending") {
      await ctx.db.delete(request._id);
    }

    return null;
  }
});

export const cancel = mutation({
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

    const request = await findDirectedRelationship(ctx, requester._id, recipient._id);
    if (request && request.status === "pending") {
      await ctx.db.delete(request._id);
    }

    return null;
  }
});

export const block = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string()
  },
  handler: async (ctx, args) => {
    const owner = await requireUserBySession(ctx, args.sessionToken);
    const target = await findUserByUsername(ctx, normalizeUsername(args.username));

    if (!target) {
      throw new Error("That username does not exist.");
    }

    if (target._id === owner._id) {
      throw new Error("You cannot block yourself.");
    }

    await deleteRelationshipBetween(ctx, owner._id, target._id);

    const existingBlock = await ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", owner._id).eq("targetUserId", target._id)
      )
      .unique();

    if (!existingBlock) {
      await ctx.db.insert("friendBlocks", {
        ownerId: owner._id,
        targetUserId: target._id,
        createdAt: Date.now()
      });
    }

    return null;
  }
});

export const unblock = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string()
  },
  handler: async (ctx, args) => {
    const owner = await requireUserBySession(ctx, args.sessionToken);
    const target = await findUserByUsername(ctx, normalizeUsername(args.username));

    if (!target) {
      throw new Error("That username does not exist.");
    }

    const blockRecord = await ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", owner._id).eq("targetUserId", target._id)
      )
      .unique();

    if (blockRecord) {
      await ctx.db.delete(blockRecord._id);
    }

    return null;
  }
});

async function findRelationship(
  ctx: QueryCtx | MutationCtx,
  leftUserId: Id<"users">,
  rightUserId: Id<"users">
): Promise<FriendRecord | null> {
  return (
    (await findDirectedRelationship(ctx, leftUserId, rightUserId)) ??
    (await findDirectedRelationship(ctx, rightUserId, leftUserId))
  );
}

async function findDirectedRelationship(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<"users">,
  recipientId: Id<"users">
): Promise<FriendRecord | null> {
  return await ctx.db
    .query("friends")
    .withIndex("by_pair", (q) =>
      q.eq("requesterId", requesterId).eq("recipientId", recipientId)
    )
    .unique();
}

async function deleteRelationshipBetween(
  ctx: MutationCtx,
  leftUserId: Id<"users">,
  rightUserId: Id<"users">
): Promise<void> {
  const [leftToRight, rightToLeft] = await Promise.all([
    findDirectedRelationship(ctx, leftUserId, rightUserId),
    findDirectedRelationship(ctx, rightUserId, leftUserId)
  ]);

  for (const relationship of [leftToRight, rightToLeft]) {
    if (relationship) {
      await ctx.db.delete(relationship._id);
    }
  }
}

async function hasBlockBetween(
  ctx: QueryCtx | MutationCtx,
  leftUserId: Id<"users">,
  rightUserId: Id<"users">
): Promise<boolean> {
  const [leftBlock, rightBlock] = await Promise.all([
    ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", leftUserId).eq("targetUserId", rightUserId)
      )
      .unique(),
    ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", rightUserId).eq("targetUserId", leftUserId)
      )
      .unique()
  ]);

  return Boolean(leftBlock || rightBlock);
}
