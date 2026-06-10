import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { nanoid } from "nanoid";
import type {
  AuthenticatedUser,
  ChatFriend,
  ChatGroup,
  ChatMessage,
  ChatSession
} from "../domain/types.js";

export type SignupInput = {
  username: string;
  displayName: string;
  password: string;
} & Record<string, unknown>;

export type LoginInput = {
  username: string;
  password: string;
} & Record<string, unknown>;

export type ProfileUpdateInput = {
  displayName: string;
  username: string;
  currentPassword?: string | undefined;
  newPassword?: string | undefined;
} & Record<string, unknown>;

export interface AuthResult {
  sessionToken: string;
  user: AuthenticatedUser;
}

export interface ChatGateway {
  readonly mode: "convex" | "demo";
  signup(input: SignupInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  updateProfile(session: ChatSession, input: ProfileUpdateInput): Promise<AuthenticatedUser>;
  listGroups(session: ChatSession): Promise<ChatGroup[]>;
  listFriends(session: ChatSession): Promise<ChatFriend[]>;
  createGroup(session: ChatSession, name: string): Promise<ChatGroup>;
  joinGroup(session: ChatSession, code: string): Promise<ChatGroup>;
  leaveGroup(session: ChatSession, groupId: string): Promise<void>;
  addFriend(session: ChatSession, username: string): Promise<void>;
  acceptFriendRequest(session: ChatSession, username: string): Promise<void>;
  denyFriendRequest(session: ChatSession, username: string): Promise<void>;
  cancelFriendRequest(session: ChatSession, username: string): Promise<void>;
  blockFriend(session: ChatSession, username: string): Promise<void>;
  unblockFriend(session: ChatSession, username: string): Promise<void>;
  startTerminalSession(session: ChatSession): Promise<string>;
  heartbeatTerminalSession(session: ChatSession, terminalSessionId: string): Promise<void>;
  endTerminalSession(session: ChatSession, terminalSessionId: string): Promise<void>;
  sendMessage(session: ChatSession, input: SendMessageInput): Promise<void>;
  subscribeMessages(
    session: ChatSession,
    input: MessageSubscriptionInput,
    onMessages: (messages: ChatMessage[]) => void,
    onError: (error: Error) => void
  ): () => void;
  close(): Promise<void>;
}

export interface SendMessageInput {
  body: string;
  groupId?: string | undefined;
  friendUserId?: string | undefined;
  terminalSessionId?: string | undefined;
}

export interface MessageSubscriptionInput {
  groupId?: string | undefined;
  friendUserId?: string | undefined;
}

const refs = {
  signup: makeFunctionReference<"mutation", SignupInput, AuthResult>("auth:signup"),
  login: makeFunctionReference<"mutation", LoginInput, AuthResult>("auth:login"),
  updateProfile: makeFunctionReference<
    "mutation",
    ProfileUpdateInput & { sessionToken: string },
    AuthenticatedUser
  >("auth:updateProfile"),
  listGroups: makeFunctionReference<"query", { sessionToken: string }, ChatGroup[]>(
    "groups:listMine"
  ),
  listFriends: makeFunctionReference<"query", { sessionToken: string }, ChatFriend[]>(
    "friends:listMine"
  ),
  createGroup: makeFunctionReference<
    "mutation",
    { sessionToken: string; name: string },
    ChatGroup
  >("groups:create"),
  joinGroup: makeFunctionReference<
    "mutation",
    { sessionToken: string; code: string },
    ChatGroup
  >("groups:join"),
  leaveGroup: makeFunctionReference<
    "mutation",
    { sessionToken: string; groupId: string },
    null
  >("groups:leave"),
  addFriend: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:add"),
  acceptFriendRequest: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:accept"),
  denyFriendRequest: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:deny"),
  cancelFriendRequest: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:cancel"),
  blockFriend: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:block"),
  unblockFriend: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:unblock"),
  startTerminalSession: makeFunctionReference<
    "mutation",
    { sessionToken: string },
    { terminalSessionId: string }
  >("terminalSessions:start"),
  heartbeatTerminalSession: makeFunctionReference<
    "mutation",
    { sessionToken: string; terminalSessionId: string },
    null
  >("terminalSessions:heartbeat"),
  endTerminalSession: makeFunctionReference<
    "mutation",
    { sessionToken: string; terminalSessionId: string },
    null
  >("terminalSessions:end"),
  sendMessage: makeFunctionReference<
    "mutation",
    {
      sessionToken: string;
      body: string;
      terminalSessionId: string;
      groupId?: string;
      friendUserId?: string;
    },
    null
  >("messages:send"),
  listMessages: makeFunctionReference<
    "query",
    { sessionToken: string; groupId?: string; friendUserId?: string },
    ChatMessage[]
  >("messages:list")
};

const redactedMessageRetentionMs = 24 * 60 * 60 * 1000;

export class ConvexChatGateway implements ChatGateway {
  readonly mode = "convex" as const;

  private readonly client: ConvexClient;

  constructor(convexUrl: string) {
    this.client = new ConvexClient(convexUrl);
  }

  async signup(input: SignupInput): Promise<AuthResult> {
    return await this.client.mutation(refs.signup, input);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    return await this.client.mutation(refs.login, input);
  }

  async updateProfile(
    session: ChatSession,
    input: ProfileUpdateInput
  ): Promise<AuthenticatedUser> {
    return await this.client.mutation(refs.updateProfile, {
      sessionToken: session.token,
      displayName: input.displayName,
      username: input.username,
      ...(input.currentPassword ? { currentPassword: input.currentPassword } : {}),
      ...(input.newPassword ? { newPassword: input.newPassword } : {})
    });
  }

  async listGroups(session: ChatSession): Promise<ChatGroup[]> {
    return await this.client.query(refs.listGroups, { sessionToken: session.token });
  }

  async listFriends(session: ChatSession): Promise<ChatFriend[]> {
    return await this.client.query(refs.listFriends, { sessionToken: session.token });
  }

  async createGroup(session: ChatSession, name: string): Promise<ChatGroup> {
    return await this.client.mutation(refs.createGroup, {
      sessionToken: session.token,
      name
    });
  }

  async joinGroup(session: ChatSession, code: string): Promise<ChatGroup> {
    return await this.client.mutation(refs.joinGroup, {
      sessionToken: session.token,
      code
    });
  }

  async leaveGroup(session: ChatSession, groupId: string): Promise<void> {
    await this.client.mutation(refs.leaveGroup, {
      sessionToken: session.token,
      groupId
    });
  }

  async addFriend(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.addFriend, {
      sessionToken: session.token,
      username
    });
  }

  async acceptFriendRequest(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.acceptFriendRequest, {
      sessionToken: session.token,
      username
    });
  }

  async denyFriendRequest(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.denyFriendRequest, {
      sessionToken: session.token,
      username
    });
  }

  async cancelFriendRequest(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.cancelFriendRequest, {
      sessionToken: session.token,
      username
    });
  }

  async blockFriend(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.blockFriend, {
      sessionToken: session.token,
      username
    });
  }

  async unblockFriend(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.unblockFriend, {
      sessionToken: session.token,
      username
    });
  }

  async startTerminalSession(session: ChatSession): Promise<string> {
    const result = await this.client.mutation(refs.startTerminalSession, {
      sessionToken: session.token
    });
    return result.terminalSessionId;
  }

  async heartbeatTerminalSession(
    session: ChatSession,
    terminalSessionId: string
  ): Promise<void> {
    await this.client.mutation(refs.heartbeatTerminalSession, {
      sessionToken: session.token,
      terminalSessionId
    });
  }

  async endTerminalSession(session: ChatSession, terminalSessionId: string): Promise<void> {
    await this.client.mutation(refs.endTerminalSession, {
      sessionToken: session.token,
      terminalSessionId
    });
  }

  async sendMessage(session: ChatSession, input: SendMessageInput): Promise<void> {
    if (!input.terminalSessionId) {
      throw new Error("Terminal session is not active yet.");
    }

    await this.client.mutation(refs.sendMessage, {
      sessionToken: session.token,
      body: input.body,
      terminalSessionId: input.terminalSessionId,
      ...(input.groupId ? { groupId: input.groupId } : {}),
      ...(input.friendUserId ? { friendUserId: input.friendUserId } : {})
    });
  }

  subscribeMessages(
    session: ChatSession,
    input: MessageSubscriptionInput,
    onMessages: (messages: ChatMessage[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const unsubscribe = this.client.onUpdate(
      refs.listMessages,
      {
        sessionToken: session.token,
        ...(input.groupId ? { groupId: input.groupId } : {}),
        ...(input.friendUserId ? { friendUserId: input.friendUserId } : {})
      },
      onMessages,
      onError
    );

    return () => {
      unsubscribe();
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export class DemoChatGateway implements ChatGateway {
  readonly mode = "demo" as const;

  private readonly users = new Map<string, AuthenticatedUser>();
  private readonly passwordByUserId = new Map<string, string>();
  private readonly groups = new Map<string, ChatGroup>();
  private readonly groupMembers = new Map<string, Set<string>>();
  private readonly friends = new Map<string, ChatFriend[]>();
  private readonly blockedFriendUserIds = new Map<string, Set<string>>();
  private readonly messages: ChatMessage[] = [];
  private readonly messageTerminalSessionIds = new Map<string, string>();
  private readonly terminalSessions = new Map<
    string,
    { userId: string; status: "active" | "ended" | "expired"; lastSeenAt: number }
  >();
  private readonly listeners = new Set<(messages: ChatMessage[]) => void>();

  constructor() {
    const generalGroup: ChatGroup = {
      id: "demo-general",
      name: "general",
      role: "admin",
      joinCode: "TT-DEMO"
    };
    this.groups.set(generalGroup.id, generalGroup);
    this.messages.push({
      id: nanoid(),
      scope: "system",
      sender: { username: "terminaltalk", displayName: "TerminalTalk" },
      body: "Demo mode is active. Connect TERMINALTALK_CONVEX_URL for realtime cloud chat.",
      createdAt: Date.now()
    });
  }

  signup(input: SignupInput): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const displayName = input.displayName.trim();
    const existing = this.users.get(username);

    validateProfileInput({ displayName, username, newPassword: input.password });

    if (existing) {
      throw new Error("Username is already taken.");
    }

    const user = {
      id: nanoid(),
      username,
      displayName
    };
    this.users.set(username, user);
    this.passwordByUserId.set(user.id, input.password);
    return Promise.resolve({ sessionToken: `demo-${nanoid()}`, user });
  }

  login(input: LoginInput): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const existing = this.users.get(username);

    if (!existing) {
      return Promise.reject(new Error("Invalid username or password."));
    }

    if (this.passwordByUserId.get(existing.id) !== input.password) {
      return Promise.reject(new Error("Invalid username or password."));
    }

    return Promise.resolve({ sessionToken: `demo-${nanoid()}`, user: existing });
  }

  updateProfile(
    session: ChatSession,
    input: ProfileUpdateInput
  ): Promise<AuthenticatedUser> {
    return Promise.resolve().then(() => {
      const username = normalizeUsername(input.username);
      const displayName = input.displayName.trim();

      validateProfileInput({ displayName, username, newPassword: input.newPassword });

      const existing = this.users.get(username);
      if (existing && existing.id !== session.user.id) {
        throw new Error("Username is already taken.");
      }

      const currentUser = this.users.get(session.user.username) ?? session.user;
      if (currentUser.id !== session.user.id) {
        throw new Error("Session user does not exist.");
      }

      if (input.newPassword) {
        const currentPassword = this.passwordByUserId.get(session.user.id);
        if (!input.currentPassword || input.currentPassword !== currentPassword) {
          throw new Error("Current password is incorrect.");
        }

        this.passwordByUserId.set(session.user.id, input.newPassword);
      }

      const updatedUser = {
        id: currentUser.id,
        username,
        displayName
      };
      this.users.delete(currentUser.username);
      this.users.set(username, updatedUser);

      return updatedUser;
    });
  }

  listGroups(session: ChatSession): Promise<ChatGroup[]> {
    return Promise.resolve(
      Array.from(this.groups.values()).filter(
        (group) =>
          group.id === "demo-general" ||
          this.groupMembers.get(group.id)?.has(session.user.id)
      )
    );
  }

  listFriends(session: ChatSession): Promise<ChatFriend[]> {
    return Promise.resolve(this.friends.get(session.user.id) ?? []);
  }

  createGroup(session: ChatSession, name: string): Promise<ChatGroup> {
    const group = {
      id: nanoid(),
      name,
      role: "admin" as const,
      joinCode: `TT-${nanoid(8).toUpperCase()}`
    };
    this.groups.set(group.id, group);
    this.groupMembers.set(group.id, new Set([session.user.id]));
    this.emit();
    return Promise.resolve(group);
  }

  joinGroup(session: ChatSession, code: string): Promise<ChatGroup> {
    const group = Array.from(this.groups.values()).find(
      (candidate) => candidate.joinCode?.toUpperCase() === code.toUpperCase()
    );

    if (!group) {
      throw new Error("No group found for that join code.");
    }

    const members = this.groupMembers.get(group.id) ?? new Set<string>();
    members.add(session.user.id);
    this.groupMembers.set(group.id, members);

    return Promise.resolve({ ...group, role: "member" });
  }

  leaveGroup(session: ChatSession, groupId: string): Promise<void> {
    return Promise.resolve().then(() => {
      if (groupId === "demo-general") {
        throw new Error("The demo general group cannot be left.");
      }

      const members = this.groupMembers.get(groupId);
      if (!members?.has(session.user.id)) {
        throw new Error("You are not a member of that group.");
      }

      members.delete(session.user.id);
      if (members.size === 0) {
        this.groupMembers.delete(groupId);
        this.groups.delete(groupId);
      } else {
        this.groupMembers.set(groupId, members);
      }
      this.emit();
    });
  }

  addFriend(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const normalizedUsername = normalizeUsername(username);
      const recipient = this.users.get(normalizedUsername);

      if (!recipient) {
        throw new Error("That username does not exist.");
      }

      if (recipient.id === session.user.id) {
        throw new Error("You cannot add yourself as a friend.");
      }

      if (this.isBlockedEitherWay(session.user.id, recipient.id)) {
        throw new Error("Friend requests are blocked for that user.");
      }

      const list = this.friends.get(session.user.id) ?? [];
      if (list.some((friend) => friend.userId === recipient.id)) {
        return;
      }

      list.push({
        id: nanoid(),
        userId: recipient.id,
        username: recipient.username,
        displayName: recipient.displayName,
        status: "pending",
        direction: "outgoing"
      });
      this.friends.set(session.user.id, list);

      const incoming = this.friends.get(recipient.id) ?? [];
      if (!incoming.some((friend) => friend.userId === session.user.id)) {
        incoming.push({
          id: nanoid(),
          userId: session.user.id,
          username: session.user.username,
          displayName: session.user.displayName,
          status: "pending",
          direction: "incoming"
        });
        this.friends.set(recipient.id, incoming);
      }
    });
  }

  acceptFriendRequest(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const requester = this.users.get(normalizeUsername(username));
      if (!requester) {
        throw new Error("That username does not exist.");
      }

      if (this.isBlockedEitherWay(session.user.id, requester.id)) {
        throw new Error("Friend requests are blocked for that user.");
      }

      this.patchFriend(session.user.id, requester.id, {
        direction: undefined,
        status: "accepted"
      });
      this.patchFriend(requester.id, session.user.id, {
        direction: undefined,
        status: "accepted"
      });
    });
  }

  denyFriendRequest(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const requester = this.users.get(normalizeUsername(username));
      if (!requester) {
        throw new Error("That username does not exist.");
      }

      this.removeFriendLink(session.user.id, requester.id);
      this.removeFriendLink(requester.id, session.user.id);
    });
  }

  cancelFriendRequest(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const recipient = this.users.get(normalizeUsername(username));
      if (!recipient) {
        throw new Error("That username does not exist.");
      }

      this.removeFriendLink(session.user.id, recipient.id);
      this.removeFriendLink(recipient.id, session.user.id);
    });
  }

  blockFriend(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const target = this.users.get(normalizeUsername(username));
      if (!target) {
        throw new Error("That username does not exist.");
      }

      const blocks = this.blockedFriendUserIds.get(session.user.id) ?? new Set<string>();
      blocks.add(target.id);
      this.blockedFriendUserIds.set(session.user.id, blocks);
      this.removeFriendLink(session.user.id, target.id);
      this.removeFriendLink(target.id, session.user.id);
      this.upsertFriend(session.user.id, {
        id: `block-${session.user.id}-${target.id}`,
        userId: target.id,
        username: target.username,
        displayName: target.displayName,
        status: "blocked"
      });
    });
  }

  unblockFriend(session: ChatSession, username: string): Promise<void> {
    return Promise.resolve().then(() => {
      const target = this.users.get(normalizeUsername(username));
      if (!target) {
        throw new Error("That username does not exist.");
      }

      this.blockedFriendUserIds.get(session.user.id)?.delete(target.id);
      this.removeFriendLink(session.user.id, target.id);
    });
  }

  startTerminalSession(session: ChatSession): Promise<string> {
    const terminalSessionId = `demo-terminal-${nanoid()}`;
    this.terminalSessions.set(terminalSessionId, {
      userId: session.user.id,
      status: "active",
      lastSeenAt: Date.now()
    });
    return Promise.resolve(terminalSessionId);
  }

  heartbeatTerminalSession(session: ChatSession, terminalSessionId: string): Promise<void> {
    return Promise.resolve().then(() => {
      const terminalSession = this.requireActiveTerminalSession(
        session,
        terminalSessionId
      );
      terminalSession.lastSeenAt = Date.now();
    });
  }

  endTerminalSession(session: ChatSession, terminalSessionId: string): Promise<void> {
    return Promise.resolve().then(() => {
      const terminalSession = this.requireActiveTerminalSession(
        session,
        terminalSessionId
      );
      terminalSession.status = "ended";
      this.redactTerminalSessionMessages(terminalSessionId, "terminal_closed");
      this.emit();
    });
  }

  sendMessage(session: ChatSession, input: SendMessageInput): Promise<void> {
    return Promise.resolve().then(() => {
      if (!input.terminalSessionId) {
        throw new Error("Terminal session is not active yet.");
      }

      this.requireActiveTerminalSession(session, input.terminalSessionId);

      if (
        input.friendUserId &&
        !this.hasAcceptedFriendship(session.user.id, input.friendUserId)
      ) {
        throw new Error("Direct messages require an accepted friend.");
      }

      const message: ChatMessage = {
        id: nanoid(),
        scope: input.groupId ? "group" : input.friendUserId ? "direct" : "system",
        groupId: input.groupId,
        friendUserId: input.friendUserId,
        sender: {
          username: session.user.username,
          displayName: session.user.displayName
        },
        body: input.body,
        createdAt: Date.now()
      };
      this.messages.push(message);
      this.messageTerminalSessionIds.set(message.id, input.terminalSessionId);
      this.emit();
    });
  }

  subscribeMessages(
    session: ChatSession,
    input: MessageSubscriptionInput,
    onMessages: (messages: ChatMessage[]) => void
  ): () => void {
    this.pruneExpiredRedactedMessages();

    const listener = (messages: ChatMessage[]): void => {
      onMessages(filterMessagesForSubscription(messages, session, input, this.users));
    };

    this.listeners.add(listener);
    listener([...this.messages]);

    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): Promise<void> {
    this.listeners.clear();
    return Promise.resolve();
  }

  private patchFriend(
    ownerUserId: string,
    targetUserId: string,
    patch: Pick<ChatFriend, "status"> & { direction?: ChatFriend["direction"] }
  ): void {
    const list = this.friends.get(ownerUserId) ?? [];
    const friend = list.find((candidate) => candidate.userId === targetUserId);
    if (!friend) {
      throw new Error("No pending friend request from that user.");
    }

    friend.status = patch.status;
    friend.direction = patch.direction;
    this.friends.set(ownerUserId, list);
  }

  private upsertFriend(ownerUserId: string, friend: ChatFriend): void {
    const list = this.friends.get(ownerUserId) ?? [];
    this.friends.set(ownerUserId, [
      ...list.filter((candidate) => candidate.userId !== friend.userId),
      friend
    ]);
  }

  private removeFriendLink(ownerUserId: string, targetUserId: string): void {
    const list = this.friends.get(ownerUserId) ?? [];
    this.friends.set(
      ownerUserId,
      list.filter((friend) => friend.userId !== targetUserId)
    );
  }

  private hasAcceptedFriendship(userId: string, friendUserId: string): boolean {
    if (this.isBlockedEitherWay(userId, friendUserId)) {
      return false;
    }

    const list = this.friends.get(userId) ?? [];
    return list.some(
      (friend) => friend.userId === friendUserId && friend.status === "accepted"
    );
  }

  private isBlockedEitherWay(userId: string, friendUserId: string): boolean {
    return (
      this.blockedFriendUserIds.get(userId)?.has(friendUserId) === true ||
      this.blockedFriendUserIds.get(friendUserId)?.has(userId) === true
    );
  }

  private requireActiveTerminalSession(
    session: ChatSession,
    terminalSessionId: string
  ): { userId: string; status: "active" | "ended" | "expired"; lastSeenAt: number } {
    const terminalSession = this.terminalSessions.get(terminalSessionId);
    if (
      !terminalSession ||
      terminalSession.userId !== session.user.id ||
      terminalSession.status !== "active"
    ) {
      throw new Error("Terminal session is not active yet.");
    }

    return terminalSession;
  }

  private redactTerminalSessionMessages(
    terminalSessionId: string,
    reason: NonNullable<ChatMessage["redactionReason"]>
  ): void {
    const redactedAt = Date.now();
    for (const message of this.messages) {
      if (this.messageTerminalSessionIds.get(message.id) === terminalSessionId) {
        message.body = undefined;
        message.redactedAt = redactedAt;
        message.redactionReason = reason;
      }
    }
  }

  private pruneExpiredRedactedMessages(now = Date.now()): void {
    const cutoff = now - redactedMessageRetentionMs;

    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
      if (message?.redactedAt !== undefined && message.redactedAt <= cutoff) {
        this.messages.splice(index, 1);
        this.messageTerminalSessionIds.delete(message.id);
      }
    }
  }

  private emit(): void {
    this.pruneExpiredRedactedMessages();

    for (const listener of this.listeners) {
      listener([...this.messages]);
    }
  }
}

function filterMessagesForSubscription(
  messages: ChatMessage[],
  session: ChatSession,
  input: MessageSubscriptionInput,
  users: Map<string, AuthenticatedUser>
): ChatMessage[] {
  if (input.groupId) {
    return messages.filter(
      (message) => message.scope === "system" || message.groupId === input.groupId
    );
  }

  if (input.friendUserId) {
    const friend = Array.from(users.values()).find(
      (candidate) => candidate.id === input.friendUserId
    );
    return messages.filter(
      (message) =>
        message.scope === "direct" &&
        ((message.sender.username === session.user.username &&
          message.friendUserId === input.friendUserId) ||
          (message.sender.username === friend?.username &&
            message.friendUserId === session.user.id))
    );
  }

  return messages.filter((message) => message.scope === "system");
}

export function createChatGateway(options: {
  convexUrl?: string | undefined;
  demoMode: boolean;
}): ChatGateway {
  if (options.demoMode) {
    return new DemoChatGateway();
  }

  if (options.convexUrl) {
    return new ConvexChatGateway(options.convexUrl);
  }

  throw new Error("TERMINALTALK_CONVEX_URL is required unless TERMINALTALK_DEMO_MODE=true.");
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function validateProfileInput(input: {
  displayName: string;
  username: string;
  newPassword?: string | undefined;
}): void {
  if (!/^[a-z0-9_]{3,24}$/.test(input.username)) {
    throw new Error("Username must be 3-24 chars: lowercase letters, numbers, underscore.");
  }

  if (input.displayName.length < 1 || input.displayName.length > 60) {
    throw new Error("Name must be 1-60 characters.");
  }

  if (input.newPassword && input.newPassword.length < 3) {
    throw new Error("Password must be at least 3 characters.");
  }
}
