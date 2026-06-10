import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { requireUserBySession } from "./model.js";
import type { TerminalSessionDoc } from "./model.js";

const heartbeatTimeoutMs = 25_000;

export const start = mutation({
  args: {
    sessionToken: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const now = Date.now();
    const terminalSessionId = await ctx.db.insert("terminalSessions", {
      userId: user._id,
      startedAt: now,
      lastSeenAt: now,
      status: "active"
    });

    return { terminalSessionId };
  }
});

export const heartbeat = mutation({
  args: {
    sessionToken: v.string(),
    terminalSessionId: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const terminalSession = await requireActiveTerminalSession(
      ctx,
      args.terminalSessionId as Id<"terminalSessions">,
      user._id
    );

    await ctx.db.patch(terminalSession._id, {
      lastSeenAt: Date.now()
    });

    return null;
  }
});

export const end = mutation({
  args: {
    sessionToken: v.string(),
    terminalSessionId: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken);
    const terminalSession = await requireActiveTerminalSession(
      ctx,
      args.terminalSessionId as Id<"terminalSessions">,
      user._id
    );

    await endTerminalSession(ctx, terminalSession, "ended", "terminal_closed");
    return null;
  }
});

export const expireInactive = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - heartbeatTimeoutMs;
    const expiredSessions = await ctx.db
      .query("terminalSessions")
      .withIndex("by_status_lastSeenAt", (q) =>
        q.eq("status", "active").lt("lastSeenAt", cutoff)
      )
      .collect();

    for (const terminalSession of expiredSessions) {
      await endTerminalSession(
        ctx,
        terminalSession,
        "expired",
        "session_expired"
      );
    }

    return null;
  }
});

async function requireActiveTerminalSession(
  ctx: MutationCtx,
  terminalSessionId: Id<"terminalSessions">,
  userId: Id<"users">
): Promise<TerminalSessionDoc> {
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

  return terminalSession;
}

async function endTerminalSession(
  ctx: MutationCtx,
  terminalSession: TerminalSessionDoc,
  status: "ended" | "expired",
  redactionReason: "terminal_closed" | "session_expired"
): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(terminalSession._id, {
    endedAt: now,
    status
  });

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_terminalSession_created", (q) =>
      q.eq("terminalSessionId", terminalSession._id)
    )
    .collect();

  for (const message of messages) {
    await ctx.db.patch(message._id, {
      body: undefined,
      redactedAt: now,
      redactionReason
    });
  }
}
