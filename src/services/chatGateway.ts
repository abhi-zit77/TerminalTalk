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
  addFriend(session: ChatSession, username: string): Promise<void>;
  setNickname(session: ChatSession, username: string, nickname: string): Promise<void>;
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
  addFriend: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string },
    null
  >("friends:add"),
  setNickname: makeFunctionReference<
    "mutation",
    { sessionToken: string; username: string; nickname: string },
    null
  >("friends:setNickname"),
  sendMessage: makeFunctionReference<
    "mutation",
    { sessionToken: string; body: string; groupId?: string; friendUserId?: string },
    null
  >("messages:send"),
  listMessages: makeFunctionReference<
    "query",
    { sessionToken: string; groupId?: string; friendUserId?: string },
    ChatMessage[]
  >("messages:list")
};

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

  async addFriend(session: ChatSession, username: string): Promise<void> {
    await this.client.mutation(refs.addFriend, {
      sessionToken: session.token,
      username
    });
  }

  async setNickname(
    session: ChatSession,
    username: string,
    nickname: string
  ): Promise<void> {
    await this.client.mutation(refs.setNickname, {
      sessionToken: session.token,
      username,
      nickname
    });
  }

  async sendMessage(session: ChatSession, input: SendMessageInput): Promise<void> {
    await this.client.mutation(refs.sendMessage, {
      sessionToken: session.token,
      body: input.body,
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
  private readonly friends = new Map<string, ChatFriend[]>();
  private readonly messages: ChatMessage[] = [];
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
    const existing = this.users.get(username);

    if (existing) {
      throw new Error("Username is already taken.");
    }

    const user = {
      id: nanoid(),
      username,
      displayName: input.displayName.trim()
    };
    this.users.set(username, user);
    this.passwordByUserId.set(user.id, input.password);
    return Promise.resolve({ sessionToken: `demo-${nanoid()}`, user });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const existing = this.users.get(username);

    if (!existing) {
      return await this.signup({
        username,
        displayName: username,
        password: input.password
      });
    }

    return { sessionToken: `demo-${nanoid()}`, user: existing };
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

  listGroups(): Promise<ChatGroup[]> {
    return Promise.resolve(Array.from(this.groups.values()));
  }

  listFriends(session: ChatSession): Promise<ChatFriend[]> {
    return Promise.resolve(this.friends.get(session.user.id) ?? []);
  }

  createGroup(_session: ChatSession, name: string): Promise<ChatGroup> {
    const group = {
      id: nanoid(),
      name,
      role: "admin" as const,
      joinCode: `TT-${nanoid(8).toUpperCase()}`
    };
    this.groups.set(group.id, group);
    this.emit();
    return Promise.resolve(group);
  }

  joinGroup(_session: ChatSession, code: string): Promise<ChatGroup> {
    const group = Array.from(this.groups.values()).find(
      (candidate) => candidate.joinCode?.toUpperCase() === code.toUpperCase()
    );

    if (!group) {
      throw new Error("No group found for that join code.");
    }

    return Promise.resolve({ ...group, role: "member" });
  }

  addFriend(session: ChatSession, username: string): Promise<void> {
    const list = this.friends.get(session.user.id) ?? [];
    list.push({
      id: nanoid(),
      username: normalizeUsername(username),
      displayName: username,
      status: "pending"
    });
    this.friends.set(session.user.id, list);
    return Promise.resolve();
  }

  setNickname(_session: ChatSession, username: string, nickname: string): Promise<void> {
    for (const message of this.messages) {
      if (message.sender.username === normalizeUsername(username)) {
        message.sender.nickname = nickname;
      }
    }
    this.emit();
    return Promise.resolve();
  }

  sendMessage(session: ChatSession, input: SendMessageInput): Promise<void> {
    this.messages.push({
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
    });
    this.emit();
    return Promise.resolve();
  }

  subscribeMessages(
    _session: ChatSession,
    _input: MessageSubscriptionInput,
    onMessages: (messages: ChatMessage[]) => void
  ): () => void {
    this.listeners.add(onMessages);
    onMessages([...this.messages]);

    return () => {
      this.listeners.delete(onMessages);
    };
  }

  close(): Promise<void> {
    this.listeners.clear();
    return Promise.resolve();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener([...this.messages]);
    }
  }
}

export function createChatGateway(options: {
  convexUrl?: string | undefined;
  demoMode: boolean;
}): ChatGateway {
  if (options.convexUrl && !options.demoMode) {
    return new ConvexChatGateway(options.convexUrl);
  }

  return new DemoChatGateway();
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

  if (input.newPassword && input.newPassword.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }
}
