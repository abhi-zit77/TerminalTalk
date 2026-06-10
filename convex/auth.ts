import { v } from "convex/values";
import { mutation } from "./_generated/server.js";
import {
  createPasswordHash,
  createSessionToken,
  hashToken,
  normalizeUsername,
  verifyPassword
} from "./security.js";
import { findUserByUsername, requireUserBySession } from "./model.js";

const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

export const signup = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username);
    const displayName = args.displayName.trim();

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new Error("Username must be 3-24 chars: lowercase letters, numbers, underscore.");
    }

    if (displayName.length < 1 || displayName.length > 60) {
      throw new Error("Name must be 1-60 characters.");
    }

    if (args.password.length < 3) {
      throw new Error("Password must be at least 3 characters.");
    }

    const existing = await findUserByUsername(ctx, username);
    if (existing) {
      throw new Error("Username is already taken.");
    }

    const userId = await ctx.db.insert("users", {
      username,
      displayName,
      passwordHash: createPasswordHash(args.password),
      createdAt: Date.now()
    });
    const sessionToken = createSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: Date.now() + sessionTtlMs,
      createdAt: Date.now()
    });

    return {
      sessionToken,
      user: {
        id: userId,
        username,
        displayName
      }
    };
  }
});

export const login = mutation({
  args: {
    username: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username);
    const user = await findUserByUsername(ctx, username);

    if (!user || !verifyPassword(args.password, user.passwordHash)) {
      throw new Error("Invalid username or password.");
    }

    const sessionToken = createSessionToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      tokenHash: hashToken(sessionToken),
      expiresAt: Date.now() + sessionTtlMs,
      createdAt: Date.now()
    });

    return {
      sessionToken,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName
      }
    };
  }
});

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    username: v.string(),
    displayName: v.string(),
    currentPassword: v.optional(v.string()),
    newPassword: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const username = normalizeUsername(args.username);
    const displayName = args.displayName.trim();

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new Error("Username must be 3-24 chars: lowercase letters, numbers, underscore.");
    }

    if (displayName.length < 1 || displayName.length > 60) {
      throw new Error("Name must be 1-60 characters.");
    }

    const existing = await findUserByUsername(ctx, username);
    if (existing && existing._id !== user._id) {
      throw new Error("Username is already taken.");
    }

    const patch: {
      username: string;
      displayName: string;
      passwordHash?: string;
    } = { username, displayName };

    if (args.newPassword !== undefined && args.newPassword.length > 0) {
      if (args.newPassword.length < 3) {
        throw new Error("Password must be at least 3 characters.");
      }

      if (!args.currentPassword || !verifyPassword(args.currentPassword, user.passwordHash)) {
        throw new Error("Current password is incorrect.");
      }

      patch.passwordHash = createPasswordHash(args.newPassword);
    }

    await ctx.db.patch(user._id, patch);

    return {
      id: user._id,
      username,
      displayName
    };
  }
});
