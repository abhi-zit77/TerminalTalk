import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
  DEFAULT_THEME_ID,
  isThemeId,
  type ThemeId
} from "../config/themes.js";
import type { ChatFriend, ChatGroup, ChatSession } from "../domain/types.js";

const sessionSchema = z.object({
  token: z.string().min(1),
  convexUrl: z.string().url().optional(),
  user: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    displayName: z.string().min(1)
  })
});

const localFriendSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  status: z.union([z.literal("pending"), z.literal("accepted"), z.literal("blocked")]),
  direction: z.union([z.literal("incoming"), z.literal("outgoing")]).optional()
});

const localGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.union([z.literal("admin"), z.literal("member")]),
  joinCode: z.string().optional()
});

const localDirectorySchema = z.object({
  friends: z.array(localFriendSchema).default([]),
  groups: z.array(localGroupSchema).default([]),
  nicknames: z.record(z.string()).default({})
});

const appConfigSchema = z.object({
  localDirectoryByUserId: z.record(localDirectorySchema).optional(),
  session: sessionSchema.optional(),
  themeId: z.string().optional()
}).strict();

export interface LocalDirectory {
  friends: ChatFriend[];
  groups: ChatGroup[];
  nicknames: Record<string, string>;
}

interface StoredConfig {
  localDirectoryByUserId?: Record<string, LocalDirectory> | undefined;
  session?: ChatSession | undefined;
  themeId?: ThemeId | undefined;
}

export function getConfigFilePath(): string {
  const appDirectory = "terminaltalk";

  if (platform() === "win32") {
    const appData = process.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming");
    return join(appData, appDirectory, "config.json");
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", appDirectory, "config.json");
  }

  const xdgConfig = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");
  return join(xdgConfig, appDirectory, "config.json");
}

export function loadStoredSession(): ChatSession | null {
  return readStoredConfig().session ?? null;
}

export function saveStoredSession(session: ChatSession): void {
  writeStoredConfig({ ...readStoredConfig(), session });
}

export function clearStoredSession(): void {
  const path = getConfigFilePath();
  const { localDirectoryByUserId, themeId } = readStoredConfig();

  if (themeId || localDirectoryByUserId) {
    writeStoredConfig({ localDirectoryByUserId, themeId });
    return;
  }

  if (existsSync(path)) {
    rmSync(path);
  }
}

export function loadStoredThemeId(): ThemeId {
  return readStoredConfig().themeId ?? DEFAULT_THEME_ID;
}

export function saveStoredThemeId(themeId: ThemeId): void {
  writeStoredConfig({ ...readStoredConfig(), themeId });
}

export function loadLocalDirectory(userId: string): LocalDirectory {
  return normalizeLocalDirectory(readStoredConfig().localDirectoryByUserId?.[userId]);
}

export function saveLocalDirectory(userId: string, directory: LocalDirectory): void {
  const config = readStoredConfig();
  writeStoredConfig({
    ...config,
    localDirectoryByUserId: {
      ...(config.localDirectoryByUserId ?? {}),
      [userId]: normalizeLocalDirectory(directory)
    }
  });
}

export function upsertLocalFriend(userId: string, friend: ChatFriend): void {
  const directory = loadLocalDirectory(userId);
  saveLocalDirectory(userId, {
    ...directory,
    friends: upsertBy(directory.friends, friend, (candidate) => candidate.userId)
  });
}

export function removeLocalFriend(userId: string, friendUserId: string): void {
  const directory = loadLocalDirectory(userId);
  saveLocalDirectory(userId, {
    ...directory,
    friends: directory.friends.filter((friend) => friend.userId !== friendUserId)
  });
}

export function upsertLocalGroup(userId: string, group: ChatGroup): void {
  const directory = loadLocalDirectory(userId);
  saveLocalDirectory(userId, {
    ...directory,
    groups: upsertBy(directory.groups, group, (candidate) => candidate.id)
  });
}

export function removeLocalGroup(userId: string, groupId: string): void {
  const directory = loadLocalDirectory(userId);
  saveLocalDirectory(userId, {
    ...directory,
    groups: directory.groups.filter((group) => group.id !== groupId)
  });
}

export function setLocalNickname(
  userId: string,
  username: string,
  nickname: string
): void {
  const directory = loadLocalDirectory(userId);
  const normalizedUsername = username.trim().toLowerCase();
  const trimmedNickname = nickname.trim();
  const nicknames = { ...directory.nicknames };

  if (trimmedNickname.length === 0) {
    delete nicknames[normalizedUsername];
  } else {
    nicknames[normalizedUsername] = trimmedNickname;
  }

  saveLocalDirectory(userId, {
    ...directory,
    nicknames
  });
}

function readStoredConfig(): StoredConfig {
  const path = getConfigFilePath();

  if (!existsSync(path)) {
    return {};
  }

  const rawConfig: unknown = JSON.parse(readFileSync(path, "utf8"));
  const parsedAppConfig = appConfigSchema.safeParse(rawConfig);

  if (parsedAppConfig.success) {
    return {
      localDirectoryByUserId: parsedAppConfig.data.localDirectoryByUserId,
      session: parsedAppConfig.data.session,
      themeId: isThemeId(parsedAppConfig.data.themeId)
        ? parsedAppConfig.data.themeId
        : undefined
    };
  }

  const parsedLegacySession = sessionSchema.safeParse(rawConfig);
  return parsedLegacySession.success ? { session: parsedLegacySession.data } : {};
}

function writeStoredConfig(config: StoredConfig): void {
  const path = getConfigFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function normalizeLocalDirectory(directory?: LocalDirectory): LocalDirectory {
  return {
    friends: directory?.friends ?? [],
    groups: directory?.groups ?? [],
    nicknames: directory?.nicknames ?? {}
  };
}

function upsertBy<T>(
  items: readonly T[],
  nextItem: T,
  getKey: (item: T) => string
): T[] {
  const nextKey = getKey(nextItem);
  const nextItems = items.filter((item) => getKey(item) !== nextKey);
  return [...nextItems, nextItem];
}
