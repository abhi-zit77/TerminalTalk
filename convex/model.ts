import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { hashToken } from "./security.js";

export interface UserDoc {
  _id: Id<"users">;
  username: string;
  displayName: string;
  passwordHash: string;
}

export interface GroupDoc {
  _id: Id<"groups">;
  name: string;
  creatorId: Id<"users">;
  joinCodeHash: string;
  joinCodePrefix: string;
}

export interface MessageDoc {
  _id: Id<"messages">;
  scope: "group" | "direct";
  groupId?: Id<"groups"> | undefined;
  friendUserId?: Id<"users"> | undefined;
  senderId: Id<"users">;
  body: string;
  createdAt: number;
}

export async function requireUserBySession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
): Promise<UserDoc> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hashToken(sessionToken)))
    .unique();

  const now = Date.now();
  const sessionRecord = session as
    | { userId: Id<"users">; expiresAt: number; revokedAt?: number | undefined }
    | null;

  if (!sessionRecord || sessionRecord.expiresAt <= now || sessionRecord.revokedAt) {
    throw new Error("Session is invalid or expired.");
  }

  const user = await ctx.db.get(sessionRecord.userId);

  if (!user) {
    throw new Error("Session user does not exist.");
  }

  return user as unknown as UserDoc;
}

export async function findUserByUsername(
  ctx: QueryCtx | MutationCtx,
  username: string
): Promise<UserDoc | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();

  return user ? (user as unknown as UserDoc) : null;
}
