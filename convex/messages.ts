import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { requireUserBySession } from "./model.js";
import type { MessageDoc, TerminalSessionDoc, UserDoc } from "./model.js";

const redactedMessageRetentionMs = 24 * 60 * 60 * 1000;

export const list = query({
  args: {
    sessionToken: v.string(),
    groupId: v.optional(v.string()),
    friendUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);

    if (args.groupId) {
      await requireGroupMembership(ctx, args.groupId as Id<"groups">, user._id);
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_group_created", (q) =>
          q.eq("groupId", args.groupId as Id<"groups">)
        )
        .order("desc")
        .take(50);

      return await hydrateMessages(
        ctx,
        user._id,
        filterVisibleMessages(messages, Date.now())
      );
    }

    if (args.friendUserId) {
      const friendUserId = args.friendUserId as Id<"users">;
      const canReadDirectMessages = await hasAcceptedFriendLink(
        ctx,
        user._id,
        friendUserId
      );

      if (!canReadDirectMessages) {
        return [];
      }

      const [sentMessages, receivedMessages] = await Promise.all([
        ctx.db
          .query("messages")
          .withIndex("by_sender_created", (q) => q.eq("senderId", user._id))
          .filter((q) => q.eq(q.field("friendUserId"), friendUserId))
          .order("desc")
          .take(50),
        ctx.db
          .query("messages")
          .withIndex("by_friend_created", (q) => q.eq("friendUserId", user._id))
          .filter((q) => q.eq(q.field("senderId"), friendUserId))
          .order("desc")
          .take(50)
      ]);
      const messages = [...sentMessages, ...receivedMessages]
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
        .slice(0, 50);

      return await hydrateMessages(
        ctx,
        user._id,
        filterVisibleMessages(messages, Date.now())
      );
    }

    return [];
  }
});

export const deleteExpiredRedacted = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - redactedMessageRetentionMs;
    const expiredMessages = await ctx.db
      .query("messages")
      .withIndex("by_redactedAt", (q) => q.lt("redactedAt", cutoff))
      .collect();

    for (const message of expiredMessages) {
      if (isExpiredRedactedMessage(message, cutoff)) {
        await ctx.db.delete(message._id);
      }
    }

    return null;
  }
});

export const send = mutation({
  args: {
    sessionToken: v.string(),
    body: v.string(),
    terminalSessionId: v.string(),
    groupId: v.optional(v.string()),
    friendUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const body = args.body.trim();

    if (body.length < 1 || body.length > 2000) {
      throw new Error("Message must be 1-2000 characters.");
    }

    const terminalSessionId = args.terminalSessionId as Id<"terminalSessions">;
    await requireActiveTerminalSession(ctx, terminalSessionId, user._id);

    if (args.groupId) {
      const groupId = args.groupId as Id<"groups">;
      await requireGroupMembership(ctx, groupId, user._id);
      await ctx.db.insert("messages", {
        scope: "group",
        groupId,
        senderId: user._id,
        terminalSessionId,
        body,
        createdAt: Date.now()
      });
      return null;
    }

    if (args.friendUserId) {
      const friendUserId = args.friendUserId as Id<"users">;
      await requireAcceptedFriendLink(ctx, user._id, friendUserId);
      await ctx.db.insert("messages", {
        scope: "direct",
        friendUserId,
        senderId: user._id,
        terminalSessionId,
        body,
        createdAt: Date.now()
      });
      return null;
    }

    throw new Error("Choose a group before sending a message.");
  }
});

function filterVisibleMessages(messages: MessageDoc[], now: number): MessageDoc[] {
  const cutoff = now - redactedMessageRetentionMs;
  return messages.filter((message) => !isExpiredRedactedMessage(message, cutoff));
}

function isExpiredRedactedMessage(message: MessageDoc, cutoff: number): boolean {
  return message.redactedAt !== undefined && message.redactedAt <= cutoff;
}

async function requireGroupMembership(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
): Promise<void> {
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();

  if (!membership) {
    throw new Error("You are not a member of that group.");
  }
}

async function requireAcceptedFriendLink(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  friendUserId: Id<"users">
): Promise<void> {
  if (userId === friendUserId) {
    throw new Error("Choose a friend before sending a direct message.");
  }

  if (!(await hasAcceptedFriendLink(ctx, userId, friendUserId))) {
    throw new Error("Direct messages require an accepted friend.");
  }
}

async function hasAcceptedFriendLink(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  friendUserId: Id<"users">
): Promise<boolean> {
  if (userId === friendUserId) {
    return false;
  }

  const [userBlock, friendBlock] = await Promise.all([
    ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", userId).eq("targetUserId", friendUserId)
      )
      .unique(),
    ctx.db
      .query("friendBlocks")
      .withIndex("by_owner_target", (q) =>
        q.eq("ownerId", friendUserId).eq("targetUserId", userId)
      )
      .unique()
  ]);

  if (userBlock || friendBlock) {
    return false;
  }

  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("friends")
      .withIndex("by_pair", (q) => q.eq("requesterId", userId))
      .collect(),
    ctx.db
      .query("friends")
      .withIndex("by_pair", (q) => q.eq("requesterId", friendUserId))
      .collect()
  ]);
  const hasOutgoingLink = outgoing.some((record) => {
    const friend = record as unknown as {
      recipientId: Id<"users">;
      status: "pending" | "accepted";
    };
    return friend.recipientId === friendUserId && friend.status === "accepted";
  });
  const hasIncomingLink = incoming.some((record) => {
    const friend = record as unknown as {
      recipientId: Id<"users">;
      status: "pending" | "accepted";
    };
    return friend.recipientId === userId && friend.status === "accepted";
  });

  return hasOutgoingLink || hasIncomingLink;
}

async function requireActiveTerminalSession(
  ctx: MutationCtx,
  terminalSessionId: Id<"terminalSessions">,
  userId: Id<"users">
): Promise<void> {
  const terminalSession = (await ctx.db.get(
    terminalSessionId
  )) as unknown as TerminalSessionDoc | null;

  if (
    !terminalSession ||
    terminalSession.userId !== userId ||
    terminalSession.status !== "active"
  ) {
    throw new Error("Terminal session is not active yet.");
  }
}

async function hydrateMessages(
  ctx: QueryCtx | MutationCtx,
  _ownerId: Id<"users">,
  messages: MessageDoc[]
): Promise<
  Array<{
    id: Id<"messages">;
    scope: "group" | "direct";
    groupId?: Id<"groups"> | undefined;
    friendUserId?: Id<"users"> | undefined;
    sender: {
      username: string;
      displayName: string;
      nickname?: string | undefined;
    };
    body?: string | undefined;
    redactedAt?: number | undefined;
    redactionReason?: "terminal_closed" | "session_expired" | undefined;
    createdAt: number;
  }>
> {
  const hydrated = await Promise.all(
    messages.reverse().map(async (message) => {
      const sender = (await ctx.db.get(message.senderId)) as unknown as UserDoc | null;

      return sender
        ? {
            id: message._id,
            scope: message.scope,
            groupId: message.groupId,
            friendUserId: message.friendUserId,
            sender: {
              username: sender.username,
              displayName: sender.displayName
            },
            body: message.body,
            redactedAt: message.redactedAt,
            redactionReason: message.redactionReason,
            createdAt: message.createdAt
          }
        : null;
    })
  );

  return hydrated.filter((message): message is NonNullable<typeof message> => message !== null);
}
