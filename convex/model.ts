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
  terminalSessionId: Id<"terminalSessions">;
  body?: string | undefined;
  redactedAt?: number | undefined;
  redactionReason?: "terminal_closed" | "session_expired" | undefined;
  createdAt: number;
}

export interface TerminalSessionDoc {
  _id: Id<"terminalSessions">;
  userId: Id<"users">;
  startedAt: number;
  lastSeenAt: number;
  endedAt?: number | undefined;
  status: "active" | "ended" | "expired";
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

  return user;
}

export async function findUserByUsername(
  ctx: QueryCtx | MutationCtx,
  username: string
): Promise<UserDoc | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();

  return user;
}
