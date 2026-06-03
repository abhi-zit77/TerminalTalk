import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { requireUserBySession } from "./model.js";
import type { MessageDoc, UserDoc } from "./model.js";

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

      return await hydrateMessages(ctx, user._id, messages as unknown as MessageDoc[]);
    }

    return [];
  }
});

export const send = mutation({
  args: {
    sessionToken: v.string(),
    body: v.string(),
    groupId: v.optional(v.string()),
    friendUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const body = args.body.trim();

    if (body.length < 1 || body.length > 2000) {
      throw new Error("Message must be 1-2000 characters.");
    }

    if (args.groupId) {
      const groupId = args.groupId as Id<"groups">;
      await requireGroupMembership(ctx, groupId, user._id);
      await ctx.db.insert("messages", {
        scope: "group",
        groupId,
        senderId: user._id,
        body,
        createdAt: Date.now()
      });
      return null;
    }

    throw new Error("Choose a group before sending a message.");
  }
});

async function requireGroupMembership(
  ctx: Parameters<typeof requireUserBySession>[0],
  groupId: Id<"groups">,
  userId: Id<"users">
): Promise<void> {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId))
    .collect();
  const membership = memberships.find((record) => {
    const membershipRecord = record as unknown as { userId: Id<"users"> };
    return membershipRecord.userId === userId;
  });

  if (!membership) {
    throw new Error("You are not a member of that group.");
  }
}

async function hydrateMessages(
  ctx: Parameters<typeof requireUserBySession>[0],
  ownerId: Id<"users">,
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
    body: string;
    createdAt: number;
  }>
> {
  const hydrated = await Promise.all(
    messages.reverse().map(async (message) => {
      const sender = (await ctx.db.get(message.senderId)) as unknown as UserDoc | null;
      const nicknames = await ctx.db
        .query("nicknames")
        .withIndex("by_owner_target", (q) => q.eq("ownerId", ownerId))
        .collect();
      const nicknameRecord = nicknames.find((record) => {
        const nickname = record as unknown as {
          targetUserId: Id<"users">;
          nickname: string;
        };
        return nickname.targetUserId === message.senderId;
      }) as { nickname: string } | undefined;

      return sender
        ? {
            id: message._id,
            scope: message.scope,
            groupId: message.groupId,
            friendUserId: message.friendUserId,
            sender: {
              username: sender.username,
              displayName: sender.displayName,
              nickname: nicknameRecord?.nickname
            },
            body: message.body,
            createdAt: message.createdAt
          }
        : null;
    })
  );

  return hydrated.filter((message): message is NonNullable<typeof message> => message !== null);
}
