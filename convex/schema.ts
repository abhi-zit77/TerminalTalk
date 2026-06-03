import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    displayName: v.string(),
    passwordHash: v.string(),
    createdAt: v.number()
  }).index("by_username", ["username"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  friends: defineTable({
    requesterId: v.id("users"),
    recipientId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted")),
    createdAt: v.number()
  })
    .index("by_requester", ["requesterId"])
    .index("by_recipient", ["recipientId"])
    .index("by_pair", ["requesterId", "recipientId"]),

  groups: defineTable({
    name: v.string(),
    creatorId: v.id("users"),
    joinCodeHash: v.string(),
    joinCodePrefix: v.string(),
    createdAt: v.number()
  })
    .index("by_creator", ["creatorId"])
    .index("by_joinCodeHash", ["joinCodeHash"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number()
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  messages: defineTable({
    scope: v.union(v.literal("group"), v.literal("direct")),
    groupId: v.optional(v.id("groups")),
    friendUserId: v.optional(v.id("users")),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number()
  })
    .index("by_group_created", ["groupId", "createdAt"])
    .index("by_sender_created", ["senderId", "createdAt"]),

  nicknames: defineTable({
    ownerId: v.id("users"),
    targetUserId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    nickname: v.string(),
    updatedAt: v.number()
  })
    .index("by_owner_target", ["ownerId", "targetUserId"])
    .index("by_owner_group_target", ["ownerId", "groupId", "targetUserId"])
});
