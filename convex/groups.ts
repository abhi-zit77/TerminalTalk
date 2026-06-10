import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { requireUserBySession } from "./model.js";
import type { GroupDoc } from "./model.js";
import { createJoinCode, hashToken } from "./security.js";

export const listMine = query({
  args: {
    sessionToken: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const membershipRecord = membership as unknown as {
          groupId: Id<"groups">;
          role: "admin" | "member";
        };
        const group = (await ctx.db.get(membershipRecord.groupId)) as unknown as GroupDoc | null;
        return group
          ? {
              id: group._id,
              name: group.name,
              role: membershipRecord.role
            }
          : null;
      })
    );

    return groups.filter((group): group is NonNullable<typeof group> => group !== null);
  }
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const name = args.name.trim();

    if (name.length < 1 || name.length > 80) {
      throw new Error("Group name must be 1-80 characters.");
    }

    const joinCode = createJoinCode();
    const groupId = await ctx.db.insert("groups", {
      name,
      creatorId: user._id,
      joinCodeHash: hashToken(joinCode.toUpperCase()),
      joinCodePrefix: joinCode.slice(0, 5),
      createdAt: Date.now()
    });

    await ctx.db.insert("groupMembers", {
      groupId,
      userId: user._id,
      role: "admin",
      joinedAt: Date.now()
    });

    return {
      id: groupId,
      name,
      role: "admin" as const,
      joinCode
    };
  }
});

export const join = mutation({
  args: {
    sessionToken: v.string(),
    code: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const joinCodeHash = hashToken(args.code.trim().toUpperCase());
    const group = (await ctx.db
      .query("groups")
      .withIndex("by_joinCodeHash", (q) => q.eq("joinCodeHash", joinCodeHash))
      .unique()) as unknown as GroupDoc | null;

    if (!group) {
      throw new Error("No group found for that join code.");
    }

    const existingMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", group._id))
      .collect();
    const existing = existingMemberships.find((record) => {
      const membership = record as unknown as { userId: Id<"users"> };
      return membership.userId === user._id;
    }) as { role: "admin" | "member" } | undefined;

    if (!existing) {
      await ctx.db.insert("groupMembers", {
        groupId: group._id,
        userId: user._id,
        role: "member",
        joinedAt: Date.now()
      });
    }

    return {
      id: group._id,
      name: group.name,
      role: existing?.role ?? ("member" as const)
    };
  }
});

export const leave = mutation({
  args: {
    sessionToken: v.string(),
    groupId: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const groupId = args.groupId as Id<"groups">;
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", user._id))
      .unique();

    if (!membership) {
      throw new Error("You are not a member of that group.");
    }

    const membershipRecord = membership as unknown as {
      _id: Id<"groupMembers">;
      role: "admin" | "member";
      joinedAt: number;
    };
    await ctx.db.delete(membershipRecord._id);

    const remainingMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    if (remainingMemberships.length === 0) {
      await ctx.db.delete(groupId);
      return null;
    }

    const hasAdmin = remainingMemberships.some((record) => {
      const remaining = record as unknown as { role: "admin" | "member" };
      return remaining.role === "admin";
    });

    if (!hasAdmin && membershipRecord.role === "admin") {
      const oldestMember = remainingMemberships
        .map(
          (record) =>
            record as unknown as {
              _id: Id<"groupMembers">;
              joinedAt: number;
            }
        )
        .sort((left, right) => left.joinedAt - right.joinedAt)[0];

      if (oldestMember) {
        await ctx.db.patch(oldestMember._id, { role: "admin" });
      }
    }

    return null;
  }
});
