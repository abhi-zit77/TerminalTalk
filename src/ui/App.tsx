import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { loadRuntimeConfig } from "../config/env.js";
import {
  getTheme,
  themeIds,
  type TerminalTheme,
  type ThemeId
} from "../config/themes.js";
import type {
  AppNotice,
  ChatFriend,
  ChatGroup,
  ChatMessage,
  ChatSession,
  SystemStats
} from "../domain/types.js";
import { parseCommand, quickCommandHelp } from "../features/commands/commandParser.js";
import { formatSenderLabel } from "../features/identity/formatSenderLabel.js";
import { createChatGateway } from "../services/chatGateway.js";
import type { ChatGateway } from "../services/chatGateway.js";
import {
  clearStoredSession,
  getConfigFilePath,
  loadLocalDirectory,
  loadStoredSession,
  loadStoredThemeId,
  removeLocalFriend,
  removeLocalGroup,
  saveLocalDirectory,
  saveStoredThemeId,
  saveStoredSession,
  setLocalNickname,
  upsertLocalFriend,
  upsertLocalGroup
} from "../services/sessionStore.js";
import { isInvalidStoredSessionError } from "../services/sessionErrors.js";
import { readLocalSystemStats } from "../services/systemStats.js";
import {
  APP_SHELL_LAYOUT,
  buildChatMessageDisplayLines,
  buildComposerDisplayLines,
  buildSidebarChatEntries,
  buildFocusedComposerLine,
  canOpenDirectChat,
  clamp,
  deleteComposerCharacter,
  fitComposerInput,
  getChatViewport,
  getMainScreenLayout,
  getMouseWheelScrollDelta,
  getSidebarSelectionIndex,
  isTerminalMouseSequence,
  moveSidebarSelectionIndex
} from "./tuiLayout.js";
import { isRawInputSupported } from "./inputSupport.js";
import type { SidebarChatEntry, SidebarChatTarget } from "./tuiLayout.js";
type AuthMode = "login" | "signup";
type AuthField = "username" | "displayName" | "password";
type MainView =
  | "chat"
  | "friend-actions"
  | "group-actions"
  | "nickname"
  | "settings"
  | "theme";
type SettingsField = "displayName" | "username" | "currentPassword" | "newPassword";
type ActionTarget = SidebarChatTarget;
type ChatDisplayRow =
  | { key: string; kind: "message-first"; message: ChatMessage; prefix: string; text: string }
  | { key: string; kind: "message-continuation"; text: string }
  | { key: string; kind: "plain"; color: string; text: string };

const COMPOSER_LIMIT_NOTICE = "You reached the chatbox limit. Send this message, then type again.";

const settingsFields: SettingsField[] = [
  "displayName",
  "username",
  "currentPassword",
  "newPassword"
];

const authFields: Record<AuthMode, AuthField[]> = {
  login: ["username", "password"],
  signup: ["username", "displayName", "password"]
};

export function App(): React.ReactElement {
  const runtimeConfig = useMemo(() => loadRuntimeConfig(), []);
  const gatewayState = useMemo<
    { gateway: ChatGateway; error?: undefined } | { gateway?: undefined; error: Error }
  >(() => {
    try {
      return { gateway: createChatGateway(runtimeConfig) };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("TerminalTalk could not start.")
      };
    }
  }, [runtimeConfig]);
  const [session, setSession] = useState<ChatSession | null>(() => loadStoredSession());
  const [themeId, setThemeId] = useState<ThemeId>(() => loadStoredThemeId());
  const theme = getTheme(themeId);
  const [notice, setNotice] = useState<AppNotice>({
    tone: runtimeConfig.convexUrl || runtimeConfig.demoMode ? "info" : "error",
    message: runtimeConfig.convexUrl
      ? "Convex mode ready."
      : runtimeConfig.demoMode
        ? "Demo mode active."
        : "Convex URL is required."
  });

  useEffect(() => {
    return () => {
      void gatewayState.gateway?.close();
    };
  }, [gatewayState.gateway]);

  const gateway = gatewayState.gateway;

  const handleAuth = useCallback(
    (nextSession: ChatSession) => {
      saveStoredSession(nextSession);
      setSession(nextSession);
      setNotice({ tone: "success", message: `Signed in as @${nextSession.user.username}.` });
    },
    [setSession]
  );

  const handleLogout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setNotice({ tone: "info", message: "Local session cleared." });
  }, []);

  const handleSessionUpdate = useCallback((nextSession: ChatSession) => {
    saveStoredSession(nextSession);
    setSession(nextSession);
  }, []);

  const handleThemeChange = useCallback((nextThemeId: ThemeId) => {
    saveStoredThemeId(nextThemeId);
    setThemeId(nextThemeId);
    setNotice({
      tone: "success",
      message: `Theme changed to ${getTheme(nextThemeId).name}.`
    });
  }, []);

  if (gatewayState.error || !gateway) {
    return (
      <SetupErrorScreen
        error={gatewayState.error ?? new Error("TerminalTalk could not start.")}
        theme={theme}
      />
    );
  }

  if (!session) {
    return (
      <AuthScreen
        convexUrl={runtimeConfig.convexUrl}
        gateway={gateway}
        notice={notice}
        onAuth={handleAuth}
        onNotice={setNotice}
        theme={theme}
      />
    );
  }

  return (
    <MainScreen
      gateway={gateway}
      notice={notice}
      onLogout={handleLogout}
      onNotice={setNotice}
      onSessionUpdate={handleSessionUpdate}
      onThemeChange={handleThemeChange}
      session={session}
      theme={theme}
      themeId={themeId}
    />
  );
}

interface AuthScreenProps {
  convexUrl?: string | undefined;
  gateway: ChatGateway;
  notice: AppNotice;
  onAuth: (session: ChatSession) => void;
  onNotice: (notice: AppNotice) => void;
  theme: TerminalTheme;
}

function SetupErrorScreen({
  error,
  theme
}: {
  error: Error;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Header gatewayMode="demo" theme={theme} />
      <Box
        borderStyle="single"
        borderColor={theme.notice.error}
        flexDirection="column"
        paddingX={1}
      >
        <Text color={theme.notice.error}>[ SETUP REQUIRED ]</Text>
        <Text color={theme.auth.inputText}>{error.message}</Text>
        <Text color={theme.auth.hints}>
          Set TERMINALTALK_CONVEX_URL, or set TERMINALTALK_DEMO_MODE=true for local demo mode.
        </Text>
      </Box>
    </Box>
  );
}

function AuthScreen({
  convexUrl,
  gateway,
  notice,
  onAuth,
  onNotice,
  theme
}: AuthScreenProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalRows = stdout.rows ?? process.stdout.rows;
  const layout = useMemo(() => getMainScreenLayout(terminalRows), [terminalRows]);
  const inputSupported = isRawInputSupported(process.stdin);
  const [mode, setMode] = useState<AuthMode>("login");
  const [fieldIndex, setFieldIndex] = useState(0);
  const [draft, setDraft] = useState<Record<AuthField, string>>({
    username: "",
    displayName: "",
    password: ""
  });
  const fields = authFields[mode];
  const currentField = fields[fieldIndex] ?? fields[0] ?? "username";

  const submitAuth = useCallback(async (): Promise<void> => {
    try {
      const result =
        mode === "signup"
          ? await gateway.signup({
              username: draft.username,
              displayName: draft.displayName,
              password: draft.password
            })
          : await gateway.login({
              username: draft.username,
              password: draft.password
            });

      onAuth({
        token: result.sessionToken,
        user: result.user,
        convexUrl
      });
    } catch (error) {
      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Authentication failed."
      });
    }
  }, [convexUrl, draft, gateway, mode, onAuth, onNotice]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (isTerminalMouseSequence(input) || input.includes("\u001B")) {
      return;
    }

    if (key.tab) {
      setMode((current) => (current === "login" ? "signup" : "login"));
      setFieldIndex(0);
      return;
    }

    if (key.return) {
      if (fieldIndex < fields.length - 1) {
        setFieldIndex((current) => current + 1);
        return;
      }

      void submitAuth();
      return;
    }

    if (key.backspace || key.delete) {
      setDraft((current) => ({
        ...current,
        [currentField]: current[currentField].slice(0, -1)
      }));
      return;
    }

    if (input.length > 0) {
      setDraft((current) => ({
        ...current,
        [currentField]: `${current[currentField]}${input}`
      }));
    }
  }, { isActive: inputSupported });

  return (
    <Box flexDirection="column" height={layout.terminalRows} paddingX={1}>
      <Header gatewayMode={gateway.mode} theme={theme} />
      <Box
        borderStyle="single"
        borderColor={theme.auth.activeBorder}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color={theme.auth.title}>[ AUTH ]</Text>
        <Text>
          Mode: <Text color={theme.auth.subtitle}>{mode.toUpperCase()}</Text>  TAB switches mode
        </Text>
        <Text color={theme.notice.warning}>No recovery is available in the first release.</Text>
        <Box marginTop={1} flexDirection="column">
          {fields.map((field) => (
            <Text
              key={field}
              color={field === currentField ? theme.auth.activeLabel : theme.auth.inactiveLabel}
            >
              {field === currentField ? ">" : " "} {labelForAuthField(field)}:{" "}
              {field === "password" ? "*".repeat(draft[field].length) : draft[field]}
            </Text>
          ))}
        </Box>
        <Text color={theme.auth.hints}>ENTER advances fields. CTRL+C exits.</Text>
      </Box>
      <NoticeLine notice={notice} theme={theme} />
      {!inputSupported ? <InputUnsupportedNotice theme={theme} /> : null}
    </Box>
  );
}

interface MainScreenProps {
  gateway: ChatGateway;
  notice: AppNotice;
  onLogout: () => void;
  onNotice: (notice: AppNotice) => void;
  onSessionUpdate: (session: ChatSession) => void;
  onThemeChange: (themeId: ThemeId) => void;
  session: ChatSession;
  theme: TerminalTheme;
  themeId: ThemeId;
}

function MainScreen({
  gateway,
  notice,
  onLogout,
  onNotice,
  onSessionUpdate,
  onThemeChange,
  session,
  theme,
  themeId
}: MainScreenProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalRows = stdout.rows ?? process.stdout.rows;
  const terminalColumns = stdout.columns ?? process.stdout.columns ?? 100;
  const composerColumns = Math.max(
    10,
    terminalColumns - APP_SHELL_LAYOUT.sidebarWidth - 6
  );
  const layout = useMemo(() => getMainScreenLayout(terminalRows), [terminalRows]);
  const composerInputRows = getComposerInputRows(layout.composerHeight);
  const inputSupported = isRawInputSupported(process.stdin);
  const initialLocalDirectory = useMemo(
    () => loadLocalDirectory(session.user.id),
    [session.user.id]
  );
  const [input, setInput] = useState("");
  const [groups, setGroups] = useState<ChatGroup[]>(() => initialLocalDirectory.groups);
  const [friends, setFriends] = useState<ChatFriend[]>(() => initialLocalDirectory.friends);
  const [nicknames, setNicknames] = useState<Record<string, string>>(
    () => initialLocalDirectory.nicknames
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(null);
  const [activeChatTarget, setActiveChatTarget] = useState<
    SidebarChatTarget | undefined
  >();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [chatScrollOffset, setChatScrollOffset] = useState(0);
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
  const [sidebarSelectionIndex, setSidebarSelectionIndex] = useState(0);
  const [view, setView] = useState<MainView>("chat");
  const [actionSelectionIndex, setActionSelectionIndex] = useState(0);
  const [actionTarget, setActionTarget] = useState<ActionTarget | undefined>();
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [settingsFieldIndex, setSettingsFieldIndex] = useState(0);
  const [themeSelectionIndex, setThemeSelectionIndex] = useState(() =>
    getThemeSelectionIndex(themeId)
  );
  const [settingsDraft, setSettingsDraft] = useState<Record<SettingsField, string>>(() =>
    createSettingsDraft(session)
  );

  const sidebarEntries = useMemo(
    () => buildSidebarChatEntries(groups, friends),
    [friends, groups]
  );
  const activeGroup =
    activeChatTarget?.kind === "group"
      ? groups.find((group) => group.id === activeChatTarget.id)
      : undefined;
  const activeFriend =
    activeChatTarget?.kind === "friend"
      ? friends.find((friend) => friend.userId === activeChatTarget.id)
      : undefined;
  const activeDirectFriend = canOpenDirectChat(activeFriend) ? activeFriend : undefined;
  const actionGroup =
    actionTarget?.kind === "group"
      ? groups.find((group) => group.id === actionTarget.id)
      : undefined;
  const actionFriend =
    actionTarget?.kind === "friend"
      ? friends.find((friend) => friend.userId === actionTarget.id)
      : undefined;
  const actionFriendNickname = actionFriend
    ? nicknames[actionFriend.username.toLowerCase()] ?? ""
    : "";
  const friendActions = useMemo(
    () => (actionFriend ? getFriendActions(actionFriend) : []),
    [actionFriend]
  );
  const groupActions = useMemo(
    () => (actionGroup ? getGroupActions() : []),
    [actionGroup]
  );
  const displayMessages = useMemo(
    () => applyLocalNicknames(messages, nicknames),
    [messages, nicknames]
  );
  const displayRows = useMemo(
    () => buildChatDisplayRows(displayMessages, theme, composerColumns),
    [composerColumns, displayMessages, theme]
  );
  const maxChatScrollOffset = Math.max(
    0,
    displayRows.length - layout.chatViewportHeight
  );

  const scrollChatBy = useCallback(
    (delta: number) => {
      setChatScrollOffset((current) =>
        clamp(current + delta, 0, maxChatScrollOffset)
      );
    },
    [maxChatScrollOffset]
  );

  const recoverInvalidStoredSession = useCallback(
    (error: unknown): boolean => {
      if (!isInvalidStoredSessionError(error)) {
        return false;
      }

      onLogout();
      onNotice({
        tone: "warning",
        message: "Saved session expired. Please sign in again."
      });
      return true;
    },
    [onLogout, onNotice]
  );

  const refreshDirectory = useCallback(async (): Promise<void> => {
    const [nextGroups, nextFriends] = await Promise.all([
      gateway.listGroups(session),
      gateway.listFriends(session)
    ]);
    setGroups(nextGroups);
    setFriends(nextFriends);
    saveLocalDirectory(session.user.id, {
      friends: nextFriends,
      groups: nextGroups,
      nicknames
    });
    setActiveChatTarget((current) =>
      current ?? (nextGroups[0] ? { kind: "group", id: nextGroups[0].id } : undefined)
    );
  }, [gateway, nicknames, session]);

  useEffect(() => {
    const directory = loadLocalDirectory(session.user.id);
    setGroups(directory.groups);
    setFriends(directory.friends);
    setNicknames(directory.nicknames);
  }, [session.user.id]);

  useEffect(() => {
    setSettingsDraft(createSettingsDraft(session));
    setSettingsFieldIndex(0);
  }, [session.user.displayName, session.user.username]);

  useEffect(() => {
    setThemeSelectionIndex(getThemeSelectionIndex(themeId));
  }, [themeId]);

  useEffect(() => {
    if (view === "nickname") {
      setNicknameDraft(actionFriendNickname);
    }
  }, [actionFriendNickname, view]);

  useEffect(() => {
    void refreshDirectory().catch((error: unknown) => {
      if (recoverInvalidStoredSession(error)) {
        return;
      }

      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load directory."
      });
    });
  }, [onNotice, recoverInvalidStoredSession, refreshDirectory]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshDirectory().catch((error: unknown) => {
        if (recoverInvalidStoredSession(error)) {
          return;
        }

        onNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to refresh directory."
        });
      });
    }, 3000);

    return () => {
      clearInterval(timer);
    };
  }, [onNotice, recoverInvalidStoredSession, refreshDirectory]);

  useEffect(() => {
    let cancelled = false;
    let activeTerminalSessionId: string | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const startTerminalSession = async (): Promise<void> => {
      try {
        const nextTerminalSessionId = await gateway.startTerminalSession(session);
        if (cancelled) {
          await gateway
            .endTerminalSession(session, nextTerminalSessionId)
            .catch(() => undefined);
          return;
        }

        activeTerminalSessionId = nextTerminalSessionId;
        setTerminalSessionId(nextTerminalSessionId);
        heartbeatTimer = setInterval(() => {
          void gateway
            .heartbeatTerminalSession(session, nextTerminalSessionId)
            .catch((error: unknown) => {
              if (recoverInvalidStoredSession(error)) {
                return;
              }

              onNotice({
                tone: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Terminal heartbeat failed."
              });
            });
        }, 10_000);
      } catch (error) {
        if (recoverInvalidStoredSession(error)) {
          return;
        }

        onNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to start terminal session."
        });
      }
    };

    void startTerminalSession();

    return () => {
      cancelled = true;
      setTerminalSessionId(null);
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }

      if (activeTerminalSessionId) {
        void gateway
          .endTerminalSession(session, activeTerminalSessionId)
          .catch(() => undefined);
      }
    };
  }, [gateway, onNotice, recoverInvalidStoredSession, session]);

  useEffect(() => {
    setActiveChatTarget((current) => {
      if (
        current &&
        sidebarEntries.some((entry) => entry.kind === current.kind && entry.id === current.id)
      ) {
        return current;
      }

      const firstEntry = sidebarEntries[0];
      return firstEntry ? { kind: firstEntry.kind, id: firstEntry.id } : undefined;
    });
  }, [sidebarEntries]);

  useEffect(() => {
    setSidebarSelectionIndex((current) =>
      sidebarEntries.length > 0
        ? clamp(current, 0, sidebarEntries.length - 1)
        : 0
    );
  }, [sidebarEntries.length]);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async (): Promise<void> => {
      const nextStats = await readLocalSystemStats();
      if (!cancelled) {
        setStats(nextStats);
      }
    };

    void loadStats();
    const timer = setInterval(() => {
      void loadStats();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setChatScrollOffset((current) => clamp(current, 0, maxChatScrollOffset));
  }, [maxChatScrollOffset]);

  useEffect(() => {
    setChatScrollOffset(0);
  }, [activeChatTarget?.id, activeChatTarget?.kind]);

  useEffect(() => {
    if (activeFriend && !activeDirectFriend) {
      setMessages([]);
      return;
    }

    const unsubscribe = gateway.subscribeMessages(
      session,
      {
        ...(activeGroup ? { groupId: activeGroup.id } : {}),
        ...(activeDirectFriend ? { friendUserId: activeDirectFriend.userId } : {})
      },
      setMessages,
      (error) => {
        if (recoverInvalidStoredSession(error)) {
          return;
        }

        onNotice({ tone: "error", message: error.message });
      }
    );

    return unsubscribe;
  }, [
    activeDirectFriend,
    activeFriend,
    activeGroup,
    gateway,
    onNotice,
    recoverInvalidStoredSession,
    session
  ]);

  const executeCommand = useCallback(
    async (rawInput: string): Promise<void> => {
      const result = parseCommand(rawInput);
      if (!result.ok) {
        onNotice({ tone: "error", message: result.error });
        return;
      }

      switch (result.command.type) {
        case "help":
          onNotice({
            tone: "info",
            message: `Commands: ${quickCommandHelp.join(", ")}`
          });
          return;
        case "settings":
          setSettingsDraft(createSettingsDraft(session));
          setSettingsFieldIndex(0);
          setIsSidebarFocused(false);
          setView("settings");
          onNotice({
            tone: "info",
            message: `Settings opened. Config: ${getConfigFilePath()}`
          });
          return;
        case "theme":
          setThemeSelectionIndex(getThemeSelectionIndex(themeId));
          setIsSidebarFocused(false);
          setView("theme");
          onNotice({
            tone: "info",
            message: "Theme picker opened. Use arrows, number keys, ENTER, or ESC."
          });
          return;
        case "logout":
          onLogout();
          return;
        case "create-group": {
          const group = await gateway.createGroup(session, result.command.name);
          upsertLocalGroup(session.user.id, group);
          await refreshDirectory();
          setActiveChatTarget({ kind: "group", id: group.id });
          onNotice({
            tone: "success",
            message: group.joinCode
              ? `Created ${group.name}. Join code: ${group.joinCode}`
              : `Created ${group.name}.`
          });
          return;
        }
        case "join-group": {
          const group = await gateway.joinGroup(session, result.command.code);
          upsertLocalGroup(session.user.id, group);
          await refreshDirectory();
          setActiveChatTarget({ kind: "group", id: group.id });
          onNotice({ tone: "success", message: `Joined ${group.name}.` });
          return;
        }
        case "add-friend":
          await gateway.addFriend(session, result.command.username);
          await refreshDirectory();
          onNotice({
            tone: "success",
            message: `Friend request sent to @${result.command.username}.`
          });
          return;
      }
    },
    [gateway, onLogout, onNotice, refreshDirectory, session, themeId]
  );

  const saveNickname = useCallback((): void => {
    if (!actionFriend) {
      setView("chat");
      return;
    }

    const normalizedUsername = actionFriend.username.toLowerCase();
    const trimmedNickname = nicknameDraft.trim();
    const nextNicknames = { ...nicknames };

    if (trimmedNickname.length === 0) {
      delete nextNicknames[normalizedUsername];
    } else {
      nextNicknames[normalizedUsername] = trimmedNickname;
    }

    setLocalNickname(session.user.id, actionFriend.username, trimmedNickname);
    setNicknames(nextNicknames);
    saveLocalDirectory(session.user.id, {
      friends,
      groups,
      nicknames: nextNicknames
    });
    setView("friend-actions");
    onNotice({
      tone: "success",
      message:
        trimmedNickname.length > 0
          ? `Nickname saved for @${actionFriend.username}.`
          : `Nickname cleared for @${actionFriend.username}.`
    });
  }, [actionFriend, friends, groups, nicknameDraft, nicknames, onNotice, session.user.id]);

  const saveSettings = useCallback(async (): Promise<void> => {
    const updateInput = {
      displayName: settingsDraft.displayName,
      username: settingsDraft.username,
      ...(settingsDraft.currentPassword.length > 0
        ? { currentPassword: settingsDraft.currentPassword }
        : {}),
      ...(settingsDraft.newPassword.length > 0
        ? { newPassword: settingsDraft.newPassword }
        : {})
    };
    const updatedUser = await gateway.updateProfile(session, updateInput);
    const nextSession = { ...session, user: updatedUser };

    onSessionUpdate(nextSession);
    setSettingsDraft(createSettingsDraft(nextSession));
    setView("chat");
    onNotice({ tone: "success", message: `Profile updated for @${updatedUser.username}.` });
  }, [gateway, onNotice, onSessionUpdate, session, settingsDraft]);

  const executeSelectedAction = useCallback(async (): Promise<void> => {
    if (view === "friend-actions" && actionFriend) {
      const action = friendActions[actionSelectionIndex];
      if (!action) {
        return;
      }

      switch (action.type) {
        case "open":
          setActiveChatTarget({ kind: "friend", id: actionFriend.userId });
          setView("chat");
          setIsSidebarFocused(false);
          onNotice({ tone: "info", message: `Opened direct chat @${actionFriend.username}.` });
          return;
        case "accept":
          await gateway.acceptFriendRequest(session, actionFriend.username);
          await refreshDirectory();
          setView("chat");
          onNotice({ tone: "success", message: `Accepted @${actionFriend.username}.` });
          return;
        case "deny":
          await gateway.denyFriendRequest(session, actionFriend.username);
          removeLocalFriend(session.user.id, actionFriend.userId);
          await refreshDirectory();
          setView("chat");
          onNotice({ tone: "info", message: `Denied @${actionFriend.username}.` });
          return;
        case "cancel":
          await gateway.cancelFriendRequest(session, actionFriend.username);
          removeLocalFriend(session.user.id, actionFriend.userId);
          await refreshDirectory();
          setView("chat");
          onNotice({ tone: "info", message: `Cancelled request to @${actionFriend.username}.` });
          return;
        case "block":
          await gateway.blockFriend(session, actionFriend.username);
          upsertLocalFriend(session.user.id, { ...actionFriend, status: "blocked" });
          await refreshDirectory();
          setView("chat");
          onNotice({ tone: "warning", message: `Blocked @${actionFriend.username}.` });
          return;
        case "unblock":
          await gateway.unblockFriend(session, actionFriend.username);
          removeLocalFriend(session.user.id, actionFriend.userId);
          await refreshDirectory();
          setView("chat");
          onNotice({ tone: "success", message: `Unblocked @${actionFriend.username}.` });
          return;
        case "nickname":
          setNicknameDraft(actionFriendNickname);
          setView("nickname");
          onNotice({
            tone: "info",
            message: `Set a private nickname for @${actionFriend.username}.`
          });
          return;
      }
    }

    if (view === "group-actions" && actionGroup) {
      const action = groupActions[actionSelectionIndex];
      if (!action) {
        return;
      }

      switch (action.type) {
        case "open":
          setActiveChatTarget({ kind: "group", id: actionGroup.id });
          setView("chat");
          setIsSidebarFocused(false);
          onNotice({ tone: "info", message: `Opened group ${actionGroup.name}.` });
          return;
        case "leave":
          await gateway.leaveGroup(session, actionGroup.id);
          removeLocalGroup(session.user.id, actionGroup.id);
          await refreshDirectory();
          setActiveChatTarget((current) =>
            current?.kind === "group" && current.id === actionGroup.id ? undefined : current
          );
          setView("chat");
          onNotice({ tone: "warning", message: `Left ${actionGroup.name}.` });
          return;
      }
    }
  }, [
    actionFriend,
    actionGroup,
    actionSelectionIndex,
    actionFriendNickname,
    friendActions,
    gateway,
    groupActions,
    onNotice,
    refreshDirectory,
    session,
    view
  ]);

  const activateSidebarEntry = useCallback(
    (entry: SidebarChatEntry): void => {
      setActionTarget({ kind: entry.kind, id: entry.id });
      setActionSelectionIndex(0);
      setIsSidebarFocused(false);
      setView(entry.kind === "group" ? "group-actions" : "friend-actions");
      onNotice({
        tone: "info",
        message:
          entry.kind === "group"
            ? `Group actions opened for ${entry.label}.`
            : `Friend actions opened for ${entry.label}.`
      });
    },
    [onNotice]
  );

  const applyThemeByIndex = useCallback(
    (nextIndex: number): void => {
      const nextThemeId = themeIds[nextIndex];

      if (!nextThemeId) {
        return;
      }

      setThemeSelectionIndex(nextIndex);
      onThemeChange(nextThemeId);
    },
    [onThemeChange]
  );

  const submitInput = useCallback(async (): Promise<void> => {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return;
    }

    setInput("");

    try {
      if (trimmed.startsWith("/")) {
        await executeCommand(trimmed);
        setChatScrollOffset(0);
        return;
      }

      if (!terminalSessionId) {
        onNotice({
          tone: "warning",
          message: "Terminal session is still starting."
        });
        return;
      }

      if (activeFriend && !canOpenDirectChat(activeFriend)) {
        onNotice({
          tone: "warning",
          message: "Direct chat unlocks after the friend request is accepted."
        });
        return;
      }

      await gateway.sendMessage(session, {
        body: trimmed,
        terminalSessionId,
        ...(activeGroup ? { groupId: activeGroup.id } : {}),
        ...(activeDirectFriend ? { friendUserId: activeDirectFriend.userId } : {})
      });
      setChatScrollOffset(0);
    } catch (error) {
      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Command failed."
      });
    }
  }, [
    activeDirectFriend,
    activeFriend,
    activeGroup,
    executeCommand,
    gateway,
    input,
    onNotice,
    session,
    terminalSessionId
  ]);

  const appendComposerInput = useCallback(
    (addition: string): void => {
      setInput((current) => {
        const result = fitComposerInput(current, addition, {
          maxColumns: composerColumns,
          maxRows: composerInputRows,
          prompt: "$ "
        });

        if (!result.accepted) {
          onNotice({
            tone: "warning",
            message: COMPOSER_LIMIT_NOTICE
          });
        }

        return result.input;
      });
    },
    [composerColumns, composerInputRows, onNotice]
  );

  useInput((rawInput, key) => {
    if (key.ctrl && rawInput === "c") {
      exit();
      return;
    }

    if (isTerminalMouseSequence(rawInput)) {
      const wheelScrollDelta = getMouseWheelScrollDelta(rawInput);
      if (view === "chat" && wheelScrollDelta !== null) {
        scrollChatBy(wheelScrollDelta);
      }

      return;
    }

    if (view === "chat" && key.leftArrow) {
      setIsSidebarFocused(true);
      setSidebarSelectionIndex(
        getSidebarSelectionIndex(sidebarEntries, activeChatTarget)
      );
      return;
    }

    if (view === "chat" && isSidebarFocused) {
      if (key.rightArrow || key.escape) {
        setIsSidebarFocused(false);
        return;
      }

      if (key.upArrow) {
        setSidebarSelectionIndex((current) =>
          moveSidebarSelectionIndex(current, -1, sidebarEntries.length)
        );
        return;
      }

      if (key.downArrow) {
        setSidebarSelectionIndex((current) =>
          moveSidebarSelectionIndex(current, 1, sidebarEntries.length)
        );
        return;
      }

      if (key.return) {
        const selectedEntry = sidebarEntries[sidebarSelectionIndex];
        if (selectedEntry) {
          activateSidebarEntry(selectedEntry);
        }
        return;
      }

      return;
    }

    if (view === "friend-actions" || view === "group-actions") {
      const actionCount =
        view === "friend-actions" ? friendActions.length : groupActions.length;

      if (key.escape || key.leftArrow) {
        setView("chat");
        setActionTarget(undefined);
        setActionSelectionIndex(0);
        onNotice({ tone: "info", message: "Actions closed." });
        return;
      }

      if (key.upArrow) {
        setActionSelectionIndex((current) =>
          moveSidebarSelectionIndex(current, -1, actionCount)
        );
        return;
      }

      if (key.downArrow || key.tab) {
        setActionSelectionIndex((current) =>
          moveSidebarSelectionIndex(current, 1, actionCount)
        );
        return;
      }

      if (key.return) {
        void executeSelectedAction().catch((error: unknown) => {
          onNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Action failed."
          });
        });
      }

      return;
    }

    if (view === "theme") {
      if (key.escape) {
        setView("chat");
        onNotice({ tone: "info", message: "Theme picker closed." });
        return;
      }

      if (key.upArrow) {
        const nextIndex = moveThemeSelectionIndex(themeSelectionIndex, -1);
        applyThemeByIndex(nextIndex);
        return;
      }

      if (key.downArrow || key.tab) {
        const nextIndex = moveThemeSelectionIndex(themeSelectionIndex, 1);
        applyThemeByIndex(nextIndex);
        return;
      }

      if (key.return) {
        applyThemeByIndex(themeSelectionIndex);
        setView("chat");
        return;
      }

      const numberSelection = Number(rawInput);
      if (Number.isInteger(numberSelection) && numberSelection >= 1 && numberSelection <= themeIds.length) {
        applyThemeByIndex(numberSelection - 1);
        setView("chat");
      }

      return;
    }

    if (view === "nickname") {
      if (key.escape) {
        setNicknameDraft(actionFriendNickname);
        setView("friend-actions");
        onNotice({ tone: "info", message: "Nickname edit cancelled." });
        return;
      }

      if (key.return) {
        saveNickname();
        return;
      }

      if (rawInput.includes("\u001B")) {
        return;
      }

      if (key.backspace || key.delete) {
        setNicknameDraft((current) => deleteComposerCharacter(current));
        return;
      }

      if (rawInput.length > 0) {
        setNicknameDraft((current) => `${current}${rawInput}`);
      }

      return;
    }

    if (rawInput.includes("\u001B") && !(view === "settings" && key.escape)) {
      return;
    }

    if (view === "settings") {
      const currentField =
        settingsFields[settingsFieldIndex] ?? settingsFields[0] ?? "displayName";

      if (key.escape) {
        setSettingsDraft(createSettingsDraft(session));
        setSettingsFieldIndex(0);
        setView("chat");
        onNotice({ tone: "info", message: "Settings closed without saving." });
        return;
      }

      if (key.tab) {
        setSettingsFieldIndex((current) => (current + 1) % settingsFields.length);
        return;
      }

      if (key.return) {
        if (settingsFieldIndex < settingsFields.length - 1) {
          setSettingsFieldIndex((current) => current + 1);
          return;
        }

        void saveSettings().catch((error: unknown) => {
          onNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to save settings."
          });
        });
        return;
      }

      if (key.backspace || key.delete) {
        setSettingsDraft((current) => ({
          ...current,
          [currentField]: current[currentField].slice(0, -1)
        }));
        return;
      }

      if (rawInput.length > 0) {
        setSettingsDraft((current) => ({
          ...current,
          [currentField]: `${current[currentField]}${rawInput}`
        }));
      }

      return;
    }

    const wheelScrollDelta = getMouseWheelScrollDelta(rawInput);
    if (wheelScrollDelta !== null) {
      scrollChatBy(wheelScrollDelta);
      return;
    }

    if (key.ctrl) {
      if (rawInput === "n" || rawInput === "\u000E") {
        appendComposerInput("\n");
      }
      return;
    }

    if (key.pageUp) {
      scrollChatBy(APP_SHELL_LAYOUT.chatScrollPage);
      return;
    }

    if (key.pageDown) {
      scrollChatBy(-APP_SHELL_LAYOUT.chatScrollPage);
      return;
    }

    if (input.length === 0 && rawInput === "k") {
      scrollChatBy(APP_SHELL_LAYOUT.chatScrollStep);
      return;
    }

    if (input.length === 0 && rawInput === "j") {
      scrollChatBy(-APP_SHELL_LAYOUT.chatScrollStep);
      return;
    }

    if (key.return) {
      void submitInput();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((current) => deleteComposerCharacter(current));
      return;
    }

    if (rawInput.length > 0) {
      appendComposerInput(rawInput);
    }
  }, { isActive: inputSupported });

  return (
    <Box flexDirection="column" height={layout.terminalRows} paddingX={1}>
      <Header gatewayMode={gateway.mode} theme={theme} />
      <Box flexGrow={1} height={layout.bodyHeight}>
        <AppSidebar
          activeChatTarget={activeChatTarget}
          bodyHeight={layout.bodyHeight}
          friends={friends}
          groups={groups}
          isFocused={isSidebarFocused}
          session={session}
          sidebarEntries={sidebarEntries}
          sidebarSelectionIndex={sidebarSelectionIndex}
          stats={stats}
          theme={theme}
        />
        {view === "settings" ? (
          <SettingsWorkspace
            bodyHeight={layout.bodyHeight}
            draft={settingsDraft}
            fieldIndex={settingsFieldIndex}
            theme={theme}
          />
        ) : view === "friend-actions" ? (
          <FriendActionsWorkspace
            actionFriend={actionFriend}
            actions={friendActions}
            bodyHeight={layout.bodyHeight}
            selectionIndex={actionSelectionIndex}
            theme={theme}
          />
        ) : view === "group-actions" ? (
          <GroupActionsWorkspace
            actionGroup={actionGroup}
            actions={groupActions}
            bodyHeight={layout.bodyHeight}
            selectionIndex={actionSelectionIndex}
            theme={theme}
          />
        ) : view === "nickname" ? (
          <NicknameWorkspace
            actionFriend={actionFriend}
            bodyHeight={layout.bodyHeight}
            draft={nicknameDraft}
            theme={theme}
          />
        ) : view === "theme" ? (
          <ThemeWorkspace
            bodyHeight={layout.bodyHeight}
            selectedThemeId={themeId}
            selectionIndex={themeSelectionIndex}
            theme={theme}
          />
        ) : (
          <ChatWorkspace
            activeGroup={activeGroup}
            activeFriend={activeFriend}
            chatPaneHeight={layout.chatPaneHeight}
            chatViewportHeight={layout.chatViewportHeight}
            composerColumns={composerColumns}
            composerHeight={layout.composerHeight}
            displayRows={displayRows}
            input={input}
            scrollOffset={chatScrollOffset}
            session={session}
            theme={theme}
          />
        )}
      </Box>
      <NoticeLine notice={notice} theme={theme} />
      {!inputSupported ? <InputUnsupportedNotice theme={theme} /> : null}
    </Box>
  );
}

function SettingsWorkspace({
  bodyHeight,
  draft,
  fieldIndex,
  theme
}: {
  bodyHeight: number;
  draft: Record<SettingsField, string>;
  fieldIndex: number;
  theme: TerminalTheme;
}): React.ReactElement {
  const currentField = settingsFields[fieldIndex] ?? "displayName";

  return (
    <Box flexDirection="column" flexGrow={1} height={bodyHeight} marginLeft={1}>
      <Box
        borderStyle="single"
        borderColor={theme.auth.activeBorder}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color={theme.auth.title}>[ SETTINGS ]</Text>
        <Text color={theme.auth.hints}>ENTER advances fields. Save on the last field. ESC closes.</Text>
        <Box marginTop={1} flexDirection="column">
          {settingsFields.map((field) => (
            <Text
              key={field}
              color={field === currentField ? theme.auth.activeLabel : theme.auth.inputText}
            >
              {field === currentField ? ">" : " "} {labelForSettingsField(field)}:{" "}
              {renderSettingsValue(field, draft[field], field === currentField)}
            </Text>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.auth.hints}>Usernames must be unique and use lowercase letters, numbers, underscore.</Text>
          <Text color={theme.auth.hints}>Password changes require your current password.</Text>
        </Box>
      </Box>
    </Box>
  );
}

type FriendAction =
  | { type: "accept"; label: string }
  | { type: "block"; label: string }
  | { type: "cancel"; label: string }
  | { type: "deny"; label: string }
  | { type: "nickname"; label: string }
  | { type: "open"; label: string }
  | { type: "unblock"; label: string };

type GroupAction = { type: "leave"; label: string } | { type: "open"; label: string };

function FriendActionsWorkspace({
  actionFriend,
  actions,
  bodyHeight,
  selectionIndex,
  theme
}: {
  actionFriend?: ChatFriend | undefined;
  actions: FriendAction[];
  bodyHeight: number;
  selectionIndex: number;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <ActionWorkspace
      bodyHeight={bodyHeight}
      emptyLabel="No friend selected."
      subtitle={actionFriend ? friendSubtitle(actionFriend) : ""}
      title={actionFriend ? `@${actionFriend.username}` : "FRIEND"}
      actions={actions}
      selectionIndex={selectionIndex}
      theme={theme}
    />
  );
}

function GroupActionsWorkspace({
  actionGroup,
  actions,
  bodyHeight,
  selectionIndex,
  theme
}: {
  actionGroup?: ChatGroup | undefined;
  actions: GroupAction[];
  bodyHeight: number;
  selectionIndex: number;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <ActionWorkspace
      bodyHeight={bodyHeight}
      emptyLabel="No group selected."
      subtitle={actionGroup ? `role: ${actionGroup.role}` : ""}
      title={actionGroup ? `#${actionGroup.name}` : "GROUP"}
      actions={actions}
      selectionIndex={selectionIndex}
      theme={theme}
    />
  );
}

function NicknameWorkspace({
  actionFriend,
  bodyHeight,
  draft,
  theme
}: {
  actionFriend?: ChatFriend | undefined;
  bodyHeight: number;
  draft: string;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} height={bodyHeight} marginLeft={1}>
      <Box
        borderStyle="single"
        borderColor={theme.auth.activeBorder}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color={theme.auth.title}>[ SET NICKNAME ]</Text>
        {actionFriend ? (
          <>
            <Text color={theme.auth.inputText}>Name: {actionFriend.displayName}</Text>
            <Text color={theme.auth.hints}>Username: @{actionFriend.username}</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color={theme.auth.activeLabel}>
                {">"} Nickname: {buildFocusedComposerLine("", draft)}
              </Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text color={theme.auth.hints}>ENTER saves. Empty value clears. ESC cancels.</Text>
            </Box>
          </>
        ) : (
          <Text color={theme.auth.hints}>No friend selected.</Text>
        )}
      </Box>
    </Box>
  );
}

function ActionWorkspace({
  actions,
  bodyHeight,
  emptyLabel,
  selectionIndex,
  subtitle,
  theme,
  title
}: {
  actions: Array<{ label: string }>;
  bodyHeight: number;
  emptyLabel: string;
  selectionIndex: number;
  subtitle: string;
  theme: TerminalTheme;
  title: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} height={bodyHeight} marginLeft={1}>
      <Box
        borderStyle="single"
        borderColor={theme.auth.activeBorder}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color={theme.auth.title}>[ {title} ]</Text>
        {subtitle.length > 0 ? <Text color={theme.auth.hints}>{subtitle}</Text> : null}
        <Box marginTop={1} flexDirection="column">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <Text
                key={action.label}
                color={index === selectionIndex ? theme.auth.activeLabel : theme.auth.inputText}
              >
                {index === selectionIndex ? ">" : " "} {action.label}
              </Text>
            ))
          ) : (
            <Text color={theme.auth.hints}>{emptyLabel}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.auth.hints}>ENTER selects. ESC closes.</Text>
        </Box>
      </Box>
    </Box>
  );
}

function ThemeWorkspace({
  bodyHeight,
  selectedThemeId,
  selectionIndex,
  theme
}: {
  bodyHeight: number;
  selectedThemeId: ThemeId;
  selectionIndex: number;
  theme: TerminalTheme;
}): React.ReactElement {
  const selectedTheme = getTheme(selectedThemeId);

  return (
    <Box flexDirection="column" flexGrow={1} height={bodyHeight} marginLeft={1}>
      <Box
        borderStyle="single"
        borderColor={theme.auth.activeBorder}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color={theme.auth.title}>[ THEME ]</Text>
        <Text color={theme.auth.hints}>ARROWS preview. 1-5 chooses. ENTER returns. ESC closes.</Text>
        <Box marginTop={1} flexDirection="column">
          {themeIds.map((availableThemeId, index) => {
            const availableTheme = getTheme(availableThemeId);
            const isSelected = availableThemeId === selectedThemeId;
            const isCursor = index === selectionIndex;

            return (
              <Text
                key={availableThemeId}
                color={isSelected ? theme.auth.activeLabel : theme.auth.inactiveLabel}
              >
                {isCursor ? ">" : " "} {index + 1}. {availableTheme.name}{" "}
                <Text color={theme.auth.hints}>{availableTheme.tagline}</Text>
              </Text>
            );
          })}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.auth.subtitle}>Active: {selectedTheme.name}</Text>
          <Text color={theme.auth.inputText}>{selectedTheme.tagline}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function Header({
  gatewayMode,
  theme
}: {
  gatewayMode: ChatGateway["mode"];
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.header.borderColor}
      paddingX={1}
    >
      <Text color={theme.header.title}>TerminalTalk</Text>
      <Text color={theme.header.subtitle}> :: realtime terminal chat :: </Text>
      <Text color={gatewayMode === "convex" ? theme.header.online : theme.notice.warning}>
        [{gatewayMode.toUpperCase()}]
      </Text>
    </Box>
  );
}

function AppSidebar({
  activeChatTarget,
  bodyHeight,
  friends,
  groups,
  isFocused,
  session,
  sidebarEntries,
  sidebarSelectionIndex,
  stats,
  theme
}: {
  activeChatTarget?: SidebarChatTarget | undefined;
  bodyHeight: number;
  friends: ChatFriend[];
  groups: ChatGroup[];
  isFocused: boolean;
  session: ChatSession;
  sidebarEntries: SidebarChatEntry[];
  sidebarSelectionIndex: number;
  stats: SystemStats | null;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box flexDirection="column" height={bodyHeight} width={APP_SHELL_LAYOUT.sidebarWidth}>
      <ProfilePanel
        activeChatTarget={activeChatTarget}
        friends={friends}
        groups={groups}
        isFocused={isFocused}
        session={session}
        selectedEntry={isFocused ? sidebarEntries[sidebarSelectionIndex] : undefined}
        theme={theme}
      />
      <QuickCommands theme={theme} />
      <StatusPane stats={stats} theme={theme} />
    </Box>
  );
}

function ProfilePanel({
  activeChatTarget,
  friends,
  groups,
  isFocused,
  session,
  selectedEntry,
  theme
}: {
  activeChatTarget?: SidebarChatTarget | undefined;
  friends: ChatFriend[];
  groups: ChatGroup[];
  isFocused: boolean;
  session: ChatSession;
  selectedEntry?: SidebarChatEntry | undefined;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? theme.sidebar.activeItem : theme.sidebar.borderColor}
      flexDirection="column"
      paddingX={1}
      width={APP_SHELL_LAYOUT.profileWidth}
    >
      <Text color={theme.sidebar.sectionTitle}>[ PROFILE ]</Text>
      <Text color={theme.sidebar.value}>{truncate(session.user.displayName, 28)}</Text>
      <Text color={theme.sidebar.muted}>@{truncate(session.user.username, 27)}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={isFocused ? theme.sidebar.activeItem : theme.sidebar.sectionTitle}>[ GROUPS ]</Text>
        {groups.map((group) => (
          <Text
            key={group.id}
            color={
              isSelectedSidebarEntry(selectedEntry, "group", group.id) ||
              isActiveSidebarTarget(activeChatTarget, "group", group.id)
                ? theme.sidebar.activeItem
                : theme.sidebar.inactiveItem
            }
          >
            {formatSidebarPrefix({
              activeChatTarget,
              id: group.id,
              isFocused,
              kind: "group",
              selectedEntry
            })}{" "}
            #{truncate(group.name, 25)}
          </Text>
        ))}
        {groups.length === 0 ? <Text color={theme.sidebar.muted}>No groups yet.</Text> : null}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={isFocused ? theme.sidebar.activeItem : theme.sidebar.sectionTitle}>[ FRIENDS ]</Text>
        {friends.map((friend) => (
          <Text
            key={friend.id}
            color={
              isSelectedSidebarEntry(selectedEntry, "friend", friend.userId) ||
              isActiveSidebarTarget(activeChatTarget, "friend", friend.userId)
                ? theme.sidebar.activeItem
                : theme.sidebar.inactiveItem
            }
          >
            {formatSidebarPrefix({
              activeChatTarget,
              id: friend.userId,
              isFocused,
              kind: "friend",
              selectedEntry
            })}{" "}
            @{truncate(friend.username, 17)} <Text color={theme.sidebar.muted}>[{friend.status}]</Text>
          </Text>
        ))}
        {friends.length === 0 ? <Text color={theme.sidebar.muted}>No friends yet.</Text> : null}
      </Box>
    </Box>
  );
}

function formatSidebarPrefix({
  activeChatTarget,
  id,
  isFocused,
  kind,
  selectedEntry
}: {
  activeChatTarget?: SidebarChatTarget | undefined;
  id: string;
  isFocused: boolean;
  kind: SidebarChatEntry["kind"];
  selectedEntry?: SidebarChatEntry | undefined;
}): string {
  if (isFocused && isSelectedSidebarEntry(selectedEntry, kind, id)) {
    return ">";
  }

  return isActiveSidebarTarget(activeChatTarget, kind, id) ? "*" : " ";
}

function isSelectedSidebarEntry(
  selectedEntry: SidebarChatEntry | undefined,
  kind: SidebarChatEntry["kind"],
  id: string
): boolean {
  return selectedEntry?.kind === kind && selectedEntry.id === id;
}

function isActiveSidebarTarget(
  activeChatTarget: SidebarChatTarget | undefined,
  kind: SidebarChatTarget["kind"],
  id: string
): boolean {
  return activeChatTarget?.kind === kind && activeChatTarget.id === id;
}

function getMessageSenderColor(
  message: ChatMessage,
  session: ChatSession,
  theme: TerminalTheme
): string {
  if (message.scope === "system") {
    return theme.chat.system;
  }

  return message.sender.username === session.user.username
    ? theme.chat.senderSelf
    : theme.chat.senderOther;
}

function ChatWorkspace({
  activeGroup,
  activeFriend,
  chatPaneHeight,
  chatViewportHeight,
  composerColumns,
  composerHeight,
  displayRows,
  input,
  scrollOffset,
  session,
  theme
}: {
  activeGroup?: ChatGroup | undefined;
  activeFriend?: ChatFriend | undefined;
  chatPaneHeight: number;
  chatViewportHeight: number;
  composerColumns: number;
  composerHeight: number;
  displayRows: ChatDisplayRow[];
  input: string;
  scrollOffset: number;
  session: ChatSession;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} marginLeft={1}>
      <ChatPane
        activeGroup={activeGroup}
        activeFriend={activeFriend}
        chatColumns={composerColumns}
        chatPaneHeight={chatPaneHeight}
        chatViewportHeight={chatViewportHeight}
        displayRows={displayRows}
        scrollOffset={scrollOffset}
        session={session}
        theme={theme}
      />
      <Composer columns={composerColumns} height={composerHeight} input={input} theme={theme} />
    </Box>
  );
}

function ChatPane({
  activeGroup,
  activeFriend,
  chatColumns,
  chatPaneHeight,
  chatViewportHeight,
  displayRows,
  scrollOffset,
  session,
  theme
}: {
  activeGroup?: ChatGroup | undefined;
  activeFriend?: ChatFriend | undefined;
  chatColumns: number;
  chatPaneHeight: number;
  chatViewportHeight: number;
  displayRows: ChatDisplayRow[];
  scrollOffset: number;
  session: ChatSession;
  theme: TerminalTheme;
}): React.ReactElement {
  const visibleRows = getChatViewport(displayRows, {
    scrollOffset,
    viewportHeight: chatViewportHeight
  });
  const scrollLabel = scrollOffset > 0 ? ` | SCROLL +${scrollOffset}` : "";
  const chatLabel = activeGroup
    ? `#${activeGroup.name}`
    : activeFriend
      ? `@${activeFriend.username}`
      : "NO CHAT";

  return (
    <Box
      borderStyle="single"
      borderColor={theme.chat.borderColor}
      flexDirection="column"
      flexGrow={1}
      height={chatPaneHeight}
      paddingX={1}
      width={chatColumns + 4}
    >
      <Text color={theme.chat.paneTitle}>
        [ CHAT {chatLabel}{scrollLabel} ]
      </Text>
      {visibleRows.map((row) => renderChatDisplayRow(row, session, theme))}
      {visibleRows.length === 0 ? <Text color={theme.chat.timestamp}>No messages yet.</Text> : null}
    </Box>
  );
}

function buildChatDisplayRows(
  messages: readonly ChatMessage[],
  theme: TerminalTheme,
  chatColumns: number
): ChatDisplayRow[] {
  const rows: ChatDisplayRow[] = [];

  for (const message of messages) {
    if (message.redactedAt) {
      for (const [index, line] of buildChatMessageDisplayLines({
        body: formatVanishedMessage(message),
        maxColumns: chatColumns
      }).entries()) {
        rows.push({
          key: `${message.id}-${index}`,
          kind: "plain",
          color: theme.chat.timestamp,
          text: line.text
        });
      }
      continue;
    }

    const senderLabel = truncate(
      `${formatSenderLabel(message.sender)}:`,
      Math.max(1, chatColumns - 1)
    );

    for (const [index, line] of buildChatMessageDisplayLines({
      body: message.body ?? "",
      maxColumns: chatColumns,
      senderLabel
    }).entries()) {
      if (line.kind === "message-first") {
        rows.push({
          key: `${message.id}-${index}`,
          kind: "message-first",
          message,
          prefix: line.prefix,
          text: line.text
        });
      } else {
        rows.push({
          key: `${message.id}-${index}`,
          kind: "message-continuation",
          text: line.text
        });
      }
    }
  }

  return rows;
}

function renderChatDisplayRow(
  row: ChatDisplayRow,
  session: ChatSession,
  theme: TerminalTheme
): React.ReactElement {
  if (row.kind === "plain") {
    return <Text key={row.key} color={row.color}>{row.text}</Text>;
  }

  if (row.kind === "message-continuation") {
    return <Text key={row.key} color={theme.chat.messageText}>{row.text}</Text>;
  }

  return (
    <Text key={row.key} color={theme.chat.messageText}>
      <Text color={getMessageSenderColor(row.message, session, theme)}>
        {row.prefix}
      </Text>
      {row.text}
    </Text>
  );
}

function formatVanishedMessage(message: ChatMessage): string {
  const senderName =
    message.sender.nickname ?? message.sender.displayName ?? `@${message.sender.username}`;
  return `${senderName}'s message vanished`;
}

function StatusPane({
  stats,
  theme
}: {
  stats: SystemStats | null;
  theme: TerminalTheme;
}): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.sidebar.borderColor}
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      width={APP_SHELL_LAYOUT.localSystemWidth}
    >
      <Text color={theme.sidebar.sectionTitle}>[ LOCAL SYSTEM ]</Text>
      <Text color={theme.sidebar.muted}>Not persisted to Convex</Text>
      {stats ? (
        stats.deviceSpecLines.map((line) => (
          <Text key={line} color={theme.sidebar.value}>{truncate(line, 30)}</Text>
        ))
      ) : (
        <Text color={theme.sidebar.muted}>Reading local stats...</Text>
      )}
    </Box>
  );
}

function QuickCommands({ theme }: { theme: TerminalTheme }): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.sidebar.borderColor}
      flexDirection="column"
      paddingX={1}
      width={APP_SHELL_LAYOUT.quickCommandsWidth}
    >
      <Text color={theme.sidebar.sectionTitle}>[ QUICK COMMANDS ]</Text>
      {quickCommandHelp.slice(0, 6).map((command) => (
        <Text key={command} color={theme.sidebar.value}>{command}</Text>
      ))}
    </Box>
  );
}

function Composer({
  columns,
  height,
  input,
  theme
}: {
  columns: number;
  height: number;
  input: string;
  theme: TerminalTheme;
}): React.ReactElement {
  const displayLines = buildComposerDisplayLines({
    cursorVisible: true,
    input,
    maxColumns: columns,
    maxRows: getComposerInputRows(height),
    placeholder: "Type a message or /theme",
    prompt: "$ "
  });

  return (
    <Box
      borderStyle="single"
      borderColor={theme.composer.borderColor}
      flexDirection="column"
      height={height}
      paddingX={1}
      width={columns + 4}
    >
      {displayLines.map((line, index) => (
        <Text
          key={`${index}-${line}`}
          color={input.length > 0 ? theme.composer.inputText : theme.composer.placeholder}
        >
          {line}
        </Text>
      ))}
      <Text color={theme.auth.hints}>Ctrl+N for newline. Enter sends.</Text>
    </Box>
  );
}

function getComposerInputRows(height: number): number {
  return Math.max(1, height - 3);
}

function NoticeLine({
  notice,
  theme
}: {
  notice: AppNotice;
  theme: TerminalTheme;
}): React.ReactElement {
  const colorByTone: Record<AppNotice["tone"], string> = {
    error: theme.notice.error,
    info: theme.notice.info,
    success: theme.notice.success,
    warning: theme.notice.warning
  };

  return (
    <Box
      borderStyle="single"
      borderColor={colorByTone[notice.tone]}
      paddingX={1}
    >
      <Text color={colorByTone[notice.tone]}>{notice.tone.toUpperCase()}</Text>
      <Text color={theme.chat.messageText}> {notice.message}</Text>
    </Box>
  );
}

function InputUnsupportedNotice({ theme }: { theme: TerminalTheme }): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.notice.warning}
      paddingX={1}
    >
      <Text color={theme.notice.warning}>INPUT</Text>
      <Text color={theme.chat.messageText}>
        {" "}This terminal cannot capture keys. Open TerminalTalk in PowerShell or Windows Terminal.
      </Text>
    </Box>
  );
}

function labelForAuthField(field: AuthField): string {
  if (field === "displayName") {
    return "name";
  }

  return field;
}

function labelForSettingsField(field: SettingsField): string {
  const labels: Record<SettingsField, string> = {
    currentPassword: "current password",
    displayName: "name",
    newPassword: "new password",
    username: "username"
  };

  return labels[field];
}

function renderSettingsValue(
  field: SettingsField,
  value: string,
  isCurrent: boolean
): string {
  const displayValue =
    field === "currentPassword" || field === "newPassword"
      ? "*".repeat(value.length)
      : value;

  return isCurrent ? buildFocusedComposerLine("", displayValue) : displayValue;
}

function createSettingsDraft(session: ChatSession): Record<SettingsField, string> {
  return {
    currentPassword: "",
    displayName: session.user.displayName,
    newPassword: "",
    username: session.user.username
  };
}

function getThemeSelectionIndex(themeId: ThemeId): number {
  const index = themeIds.indexOf(themeId);
  return index >= 0 ? index : 0;
}

function moveThemeSelectionIndex(currentIndex: number, delta: number): number {
  return ((currentIndex + delta) % themeIds.length + themeIds.length) % themeIds.length;
}

function getFriendActions(friend: ChatFriend): FriendAction[] {
  if (friend.status === "blocked") {
    return [{ type: "unblock", label: "Unblock" }];
  }

  if (friend.status === "pending" && friend.direction === "incoming") {
    return [
      { type: "accept", label: "Accept" },
      { type: "deny", label: "Deny" },
      { type: "block", label: "Block" }
    ];
  }

  if (friend.status === "pending") {
    return [
      { type: "cancel", label: "Cancel Request" },
      { type: "block", label: "Block" }
    ];
  }

  return [
    { type: "open", label: "Open Chat" },
    { type: "nickname", label: "Set Nickname" },
    { type: "block", label: "Block" }
  ];
}

function getGroupActions(): GroupAction[] {
  return [
    { type: "open", label: "Open Chat" },
    { type: "leave", label: "Leave Group" }
  ];
}

function friendSubtitle(friend: ChatFriend): string {
  return friend.direction ? `${friend.status} ${friend.direction}` : friend.status;
}

function applyLocalNicknames(
  messages: readonly ChatMessage[],
  nicknames: Record<string, string>
): ChatMessage[] {
  return messages.map((message) => {
    const nickname = nicknames[message.sender.username.toLowerCase()];

    return nickname
      ? {
          ...message,
          sender: {
            ...message.sender,
            nickname
          }
        }
      : message;
  });
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
