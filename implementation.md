# TerminalTalk Convex Backend Implementation Plan

## Approach

Build the Convex backend as the source of truth for accounts, auth sessions, friends, groups, nicknames, realtime messages, and terminal-session-based message disappearance. Keep the TUI as a thin client: it stores only the local auth token/config, sends commands to Convex, subscribes to realtime queries, and displays local system stats without persisting them.

The current repo already has the main Convex tables and functions for auth, groups, friends, nicknames, and basic messaging. The backend work now is to complete setup, harden the existing logic, add terminal session lifecycle functions, and make message redaction privacy-safe.

## Scope

- In:
  - Convex project setup and client connection through `.env`.
  - Account signup/login/profile update using hashed passwords and hashed session tokens.
  - Groups, join codes, group membership, friends, direct chats, and private nicknames.
  - Realtime group/direct message queries with Convex access checks.
  - Terminal session tracking, heartbeat, normal close cleanup, crash expiry, and body redaction.
  - Tests for backend logic and TUI gateway integration.

- Out:
  - End-to-end encryption for v1.
  - Email/password recovery.
  - Permanent message history after a terminal session ends.
  - Storing local RAM, CPU, disk, OS, or network stats in Convex.
  - Deleting other users' messages when one user leaves.

## Current Backend State

- `convex/schema.ts` already defines:
  - `users`
  - `sessions`
  - `friends`
  - `groups`
  - `groupMembers`
  - `messages`
  - `nicknames`
- `convex/auth.ts` already supports signup, login, and profile updates.
- `convex/groups.ts` already supports listing, creating, and joining groups.
- `convex/friends.ts` already supports listing friends, adding a friend, and setting nicknames.
- `convex/messages.ts` already supports listing and sending group/direct messages with membership/friend checks.
- `src/services/chatGateway.ts` already switches between demo mode and Convex mode using `TERMINALTALK_CONVEX_URL`.

## Target Data Model

Keep the existing tables and add/adjust these fields:

```ts
terminalSessions: {
  userId: Id<"users">,
  startedAt: number,
  lastSeenAt: number,
  endedAt?: number,
  status: "active" | "ended" | "expired"
}
```

Indexes:

- `terminalSessions.by_user_status`: `userId`, `status`
- `terminalSessions.by_status_lastSeenAt`: `status`, `lastSeenAt`

Update `messages`:

```ts
messages: {
  scope: "group" | "direct",
  groupId?: Id<"groups">,
  friendUserId?: Id<"users">,
  senderId: Id<"users">,
  terminalSessionId: Id<"terminalSessions">,
  body?: string,
  redactedAt?: number,
  redactionReason?: "terminal_closed" | "session_expired",
  createdAt: number
}
```

Additional message index:

- `messages.by_terminalSession_created`: `terminalSessionId`, `createdAt`

Key rule:

- If `body` exists, render the message normally.
- If `body` is missing and `redactedAt` exists, return only safe metadata and render: `<sender>'s message vanished`.

## Action Items

1. Configure Convex project setup:
   - Run Convex setup for the repo if not already linked.
   - Use the Convex development deployment first.
   - Confirm generated Convex files are current.
   - Keep real deployment values out of git and only document them in `.env.example`.

2. Extend the Convex schema:
   - Add `terminalSessions`.
   - Make `messages.body` optional.
   - Add `terminalSessionId`, `redactedAt`, and `redactionReason` to `messages`.
   - Add indexes needed for active session lookup and cleanup.

3. Add terminal session functions:
   - `terminalSessions:start(sessionToken)` creates an active terminal session for the logged-in user and returns `terminalSessionId`.
   - `terminalSessions:heartbeat(sessionToken, terminalSessionId)` updates `lastSeenAt` only if the session belongs to the current user and is active.
   - `terminalSessions:end(sessionToken, terminalSessionId)` marks the terminal session ended and redacts all messages from that terminal session.
   - `terminalSessions:expireInactive()` finds active sessions older than the heartbeat timeout, marks them expired, and redacts their messages.

4. Add cleanup scheduling:
   - Add a Convex cron/scheduled job that calls `expireInactive`.
   - Run cleanup every 30 seconds.
   - Expire terminal sessions after 60 seconds without heartbeat.
   - Keep the client heartbeat interval at 15 seconds.

5. Update message send logic:
   - Require `terminalSessionId` for every group/direct message.
   - Verify the terminal session belongs to the authenticated user and has `status: "active"`.
   - Reject sends if the terminal session is missing, ended, expired, or owned by another user.

6. Update message query logic:
   - Keep group access restricted to group members.
   - Keep direct access restricted to the two users in the conversation.
   - Return normal messages with `body`.
   - Return redacted messages without original `body`, with enough metadata for `<sender>'s message vanished`.
   - Preserve nickname/display-name hydration for both normal and redacted messages.

7. Harden relationship rules:
   - Require `friends.status === "accepted"` before direct messages are allowed.
   - Add an accept-friend mutation and update direct message checks to reject pending links.
   - Keep nickname records private to the owner user.

8. Update the TUI gateway contract:
   - Add `startTerminalSession`, `heartbeatTerminalSession`, and `endTerminalSession` to `ChatGateway`.
   - Store `terminalSessionId` in app runtime state, not as a permanent credential.
   - Send `terminalSessionId` with every message.
   - On normal app exit, call `endTerminalSession` before closing the Convex client.
   - Start a repeating heartbeat while the TUI is open.

9. Update shared types and rendering:
   - Change `ChatMessage.body` to optional or add an explicit redacted variant.
   - Add `redactedAt` and `redactionReason` to the message type.
   - Render redacted messages as `<sender>'s message vanished`.
   - Use muted/struck styling only if Ink renders it reliably; otherwise use gray text.

10. Keep demo mode behavior aligned:
   - Add an in-memory terminal-session concept to `DemoChatGateway`.
   - Redact demo messages on `close()` so local development matches Convex behavior.
   - Keep the demo system notice explaining how to connect `TERMINALTALK_CONVEX_URL`.

## Required From You

Add these values to your local `.env` when the backend is ready:

```env
# Required for real Convex mode.
TERMINALTALK_CONVEX_URL=https://your-project.convex.cloud

# Optional. Keep false when testing the real backend.
TERMINALTALK_DEMO_MODE=false
```

Also needed from your side:

- Create or give access to the Convex project for TerminalTalk.
- Provide the public Convex deployment URL for `TERMINALTALK_CONVEX_URL`.
- Use the Convex development deployment first.
- Direct messages require accepted friends only.
- Use the default heartbeat policy:
  - heartbeat every 15 seconds
  - cleanup every 30 seconds
  - expire after 60 seconds without heartbeat

Not needed in `.env` for v1:

- Password secret: current password hashing uses per-password salts.
- Session secret: current session tokens are random and stored hashed.
- Device stats keys: local stats must never be sent to Convex.
- Email provider keys: account recovery is out of scope for v1.

## Backend Logic To Implement

- Auth:
  - Normalize usernames to lowercase.
  - Enforce username, display name, and password validation.
  - Store `passwordHash`, never plaintext.
  - Store account session tokens as hashes.

- Groups:
  - Create group with admin membership.
  - Generate join code, store only a hash plus safe prefix.
  - Join by code and avoid duplicate membership.
  - List only groups the current user belongs to.

- Friends:
  - Add friend by username.
  - Prevent adding self.
  - Prevent duplicate relationship rows.
  - Add friend acceptance flow.
  - Allow direct messages only when the friendship is accepted.

- Nicknames:
  - Store nicknames as private owner-to-target metadata.
  - Use nickname first in message display, with real username still available.

- Messages:
  - Send group messages only when sender is a group member.
  - Send direct messages only when sender is allowed to message that user.
  - Attach every message to an active terminal session.
  - Return realtime query results through Convex subscriptions.

- Ephemeral privacy:
  - Start a terminal session after login/session restore.
  - Heartbeat every 15 seconds while the TUI is open.
  - End the terminal session on clean exit.
  - Expire inactive sessions after 60 seconds without heartbeat.
  - Redact only messages from the ended/expired terminal session.
  - Delete message body from Convex and keep only safe placeholder metadata.

## Validation

Run after implementation:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run pack:dry
```

Backend test scenarios:

- Signup rejects duplicate usernames and stores only password hashes.
- Login rejects invalid credentials and returns a session token for valid credentials.
- Group create returns a join code once, stores only the join-code hash, and adds creator as admin.
- Group join works by code and does not duplicate membership.
- Message send rejects missing or inactive `terminalSessionId`.
- Group messages require group membership.
- Direct messages require an accepted friendship.
- Ending one user's terminal session redacts only that user's messages.
- Other users' messages remain visible.
- Heartbeat expiry redacts messages after timeout.
- Redacted query responses never include the original body.
- Local system stats are never written to Convex.

Manual acceptance test:

1. Put `TERMINALTALK_CONVEX_URL` in `.env`.
2. Run `npm run dev` in two terminals with two users.
3. Create a group, join it from the second user, and send messages from both users.
4. Close user 1's terminal.
5. Confirm user 1's messages become `<sender>'s message vanished`.
6. Confirm user 2's messages remain readable.
7. Repeat the same test in direct chat.
8. Kill a terminal without clean exit and confirm heartbeat expiry redacts its messages.

## Assumptions

- Package stays `@abhi_zit/terminaltalk`; command stays `terminaltalk`.
- Public brand stays `TerminalTalk`.
- Convex is the realtime backend for v1.
- Demo mode remains available when no Convex URL is configured.
- The redaction placeholder includes the sender name: `<sender>'s message vanished`.
- Heartbeat policy is fixed for v1: 15-second client heartbeat, 30-second cleanup, 60-second expiry.
- The body deletion rule is strict: after redaction, Convex must not retain the vanished message text.
