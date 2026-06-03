import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { loadRuntimeConfig } from "../config/env.js";
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
  loadStoredSession,
  saveStoredSession
} from "../services/sessionStore.js";
import { readLocalSystemStats } from "../services/systemStats.js";
import {
  APP_SHELL_LAYOUT,
  buildComposerLine,
  clamp,
  getChatViewport,
  getMainScreenLayout,
  getMouseWheelScrollDelta,
  isTerminalMouseSequence
} from "./tuiLayout.js";
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN,
  writeTerminalSequence
} from "./terminalScreen.js";

type AuthMode = "login" | "signup";
type AuthField = "username" | "displayName" | "password";
type MainView = "chat" | "settings";
type SettingsField = "displayName" | "username" | "currentPassword" | "newPassword";

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
  const [gateway] = useState<ChatGateway>(() => createChatGateway(runtimeConfig));
  const [session, setSession] = useState<ChatSession | null>(() => loadStoredSession());
  const [notice, setNotice] = useState<AppNotice>({
    tone: runtimeConfig.convexUrl ? "info" : "warning",
    message: runtimeConfig.convexUrl
      ? "Convex mode ready."
      : "Demo mode active until TERMINALTALK_CONVEX_URL is configured."
  });

  useEffect(() => {
    writeTerminalSequence(ENTER_ALTERNATE_SCREEN);

    return () => {
      writeTerminalSequence(EXIT_ALTERNATE_SCREEN);
    };
  }, []);

  useEffect(() => {
    return () => {
      void gateway.close();
    };
  }, [gateway]);

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

  if (!session) {
    return (
      <AuthScreen
        convexUrl={runtimeConfig.convexUrl}
        gateway={gateway}
        notice={notice}
        onAuth={handleAuth}
        onNotice={setNotice}
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
      session={session}
    />
  );
}

interface AuthScreenProps {
  convexUrl?: string | undefined;
  gateway: ChatGateway;
  notice: AppNotice;
  onAuth: (session: ChatSession) => void;
  onNotice: (notice: AppNotice) => void;
}

function AuthScreen({
  convexUrl,
  gateway,
  notice,
  onAuth,
  onNotice
}: AuthScreenProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalRows = stdout.rows ?? process.stdout.rows;
  const layout = useMemo(() => getMainScreenLayout(terminalRows), [terminalRows]);
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
  });

  return (
    <Box flexDirection="column" height={layout.terminalRows} paddingX={1}>
      <Header gatewayMode={gateway.mode} />
      <Box
        borderStyle="single"
        borderColor="green"
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color="cyan">[ AUTH ]</Text>
        <Text>
          Mode: <Text color="yellow">{mode.toUpperCase()}</Text>  TAB switches mode
        </Text>
        <Text color="yellow">No recovery is available in the first release.</Text>
        <Box marginTop={1} flexDirection="column">
          {fields.map((field) => (
            <Text key={field} color={field === currentField ? "green" : "gray"}>
              {field === currentField ? ">" : " "} {labelForAuthField(field)}:{" "}
              {field === "password" ? "*".repeat(draft[field].length) : draft[field]}
            </Text>
          ))}
        </Box>
        <Text color="gray">ENTER advances fields. CTRL+C exits.</Text>
      </Box>
      <NoticeLine notice={notice} />
    </Box>
  );
}

interface MainScreenProps {
  gateway: ChatGateway;
  notice: AppNotice;
  onLogout: () => void;
  onNotice: (notice: AppNotice) => void;
  onSessionUpdate: (session: ChatSession) => void;
  session: ChatSession;
}

function MainScreen({
  gateway,
  notice,
  onLogout,
  onNotice,
  onSessionUpdate,
  session
}: MainScreenProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalRows = stdout.rows ?? process.stdout.rows;
  const layout = useMemo(() => getMainScreenLayout(terminalRows), [terminalRows]);
  const [input, setInput] = useState("");
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [chatScrollOffset, setChatScrollOffset] = useState(0);
  const [cursorResetKey, setCursorResetKey] = useState(0);
  const [view, setView] = useState<MainView>("chat");
  const [settingsFieldIndex, setSettingsFieldIndex] = useState(0);
  const [settingsDraft, setSettingsDraft] = useState<Record<SettingsField, string>>(() =>
    createSettingsDraft(session)
  );

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const maxChatScrollOffset = Math.max(
    0,
    messages.length - layout.chatViewportHeight
  );

  const scrollChatBy = useCallback(
    (delta: number) => {
      setChatScrollOffset((current) =>
        clamp(current + delta, 0, maxChatScrollOffset)
      );
    },
    [maxChatScrollOffset]
  );

  const resetCursorBlink = useCallback(() => {
    setCursorResetKey((current) => current + 1);
  }, []);

  const refreshDirectory = useCallback(async (): Promise<void> => {
    const [nextGroups, nextFriends] = await Promise.all([
      gateway.listGroups(session),
      gateway.listFriends(session)
    ]);
    setGroups(nextGroups);
    setFriends(nextFriends);
    setActiveGroupId((current) => current ?? nextGroups[0]?.id);
  }, [gateway, session]);

  useEffect(() => {
    setSettingsDraft(createSettingsDraft(session));
    setSettingsFieldIndex(0);
  }, [session.user.displayName, session.user.username]);

  useEffect(() => {
    void refreshDirectory().catch((error: unknown) => {
      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load directory."
      });
    });
  }, [onNotice, refreshDirectory]);

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
  }, [activeGroup?.id]);

  useEffect(() => {
    const unsubscribe = gateway.subscribeMessages(
      session,
      { groupId: activeGroup?.id },
      setMessages,
      (error) => {
        onNotice({ tone: "error", message: error.message });
      }
    );

    return unsubscribe;
  }, [activeGroup?.id, gateway, onNotice, session]);

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
          setView("settings");
          onNotice({
            tone: "info",
            message: `Settings opened. Config: ${getConfigFilePath()}`
          });
          return;
        case "logout":
          onLogout();
          return;
        case "create-group": {
          const group = await gateway.createGroup(session, result.command.name);
          await refreshDirectory();
          setActiveGroupId(group.id);
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
          await refreshDirectory();
          setActiveGroupId(group.id);
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
        case "nick":
          await gateway.setNickname(
            session,
            result.command.username,
            result.command.nickname
          );
          onNotice({
            tone: "success",
            message: `Nickname saved for @${result.command.username}.`
          });
          return;
      }
    },
    [gateway, onLogout, onNotice, refreshDirectory, session]
  );

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

      await gateway.sendMessage(session, {
        body: trimmed,
        groupId: activeGroup?.id
      });
      setChatScrollOffset(0);
    } catch (error) {
      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Command failed."
      });
    }
  }, [activeGroup?.id, executeCommand, gateway, input, onNotice, session]);

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
        resetCursorBlink();
        return;
      }

      if (rawInput.length > 0) {
        setSettingsDraft((current) => ({
          ...current,
          [currentField]: `${current[currentField]}${rawInput}`
        }));
        resetCursorBlink();
      }

      return;
    }

    const wheelScrollDelta = getMouseWheelScrollDelta(rawInput);
    if (wheelScrollDelta !== null) {
      scrollChatBy(wheelScrollDelta);
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
      setInput((current) => current.slice(0, -1));
      resetCursorBlink();
      return;
    }

    if (rawInput.length > 0) {
      setInput((current) => `${current}${rawInput}`);
      resetCursorBlink();
    }
  });

  return (
    <Box flexDirection="column" height={layout.terminalRows} paddingX={1}>
      <Header gatewayMode={gateway.mode} />
      <Box flexGrow={1} height={layout.bodyHeight}>
        <AppSidebar
          activeGroupId={activeGroup?.id}
          bodyHeight={layout.bodyHeight}
          friends={friends}
          groups={groups}
          session={session}
          stats={stats}
        />
        {view === "settings" ? (
          <SettingsWorkspace
            bodyHeight={layout.bodyHeight}
            cursorResetKey={cursorResetKey}
            draft={settingsDraft}
            fieldIndex={settingsFieldIndex}
          />
        ) : (
          <ChatWorkspace
            activeGroup={activeGroup}
            chatPaneHeight={layout.chatPaneHeight}
            chatViewportHeight={layout.chatViewportHeight}
            cursorResetKey={cursorResetKey}
            input={input}
            messages={messages}
            scrollOffset={chatScrollOffset}
          />
        )}
      </Box>
      <NoticeLine notice={notice} />
    </Box>
  );
}

function SettingsWorkspace({
  bodyHeight,
  cursorResetKey,
  draft,
  fieldIndex
}: {
  bodyHeight: number;
  cursorResetKey: number;
  draft: Record<SettingsField, string>;
  fieldIndex: number;
}): React.ReactElement {
  const currentField = settingsFields[fieldIndex] ?? "displayName";
  const cursorVisible = useBlinkingCursor(cursorResetKey);

  return (
    <Box flexDirection="column" flexGrow={1} height={bodyHeight} marginLeft={1}>
      <Box
        borderStyle="single"
        borderColor="yellow"
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        <Text color="cyan">[ SETTINGS ]</Text>
        <Text color="gray">ENTER advances fields. Save on the last field. ESC closes.</Text>
        <Box marginTop={1} flexDirection="column">
          {settingsFields.map((field) => (
            <Text key={field} color={field === currentField ? "green" : "white"}>
              {field === currentField ? ">" : " "} {labelForSettingsField(field)}:{" "}
              {renderSettingsValue(field, draft[field], field === currentField, cursorVisible)}
            </Text>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Usernames must be unique and use lowercase letters, numbers, underscore.</Text>
          <Text color="gray">Password changes require your current password.</Text>
        </Box>
      </Box>
    </Box>
  );
}

function Header({ gatewayMode }: { gatewayMode: ChatGateway["mode"] }): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="green">TerminalTalk</Text>
      <Text color="gray"> :: realtime terminal chat :: </Text>
      <Text color={gatewayMode === "convex" ? "green" : "yellow"}>
        [{gatewayMode.toUpperCase()}]
      </Text>
    </Box>
  );
}

function AppSidebar({
  activeGroupId,
  bodyHeight,
  friends,
  groups,
  session,
  stats
}: {
  activeGroupId?: string | undefined;
  bodyHeight: number;
  friends: ChatFriend[];
  groups: ChatGroup[];
  session: ChatSession;
  stats: SystemStats | null;
}): React.ReactElement {
  return (
    <Box flexDirection="column" height={bodyHeight} width={APP_SHELL_LAYOUT.sidebarWidth}>
      <ProfilePanel
        activeGroupId={activeGroupId}
        friends={friends}
        groups={groups}
        session={session}
      />
      <QuickCommands />
      <StatusPane stats={stats} />
    </Box>
  );
}

function ProfilePanel({
  activeGroupId,
  friends,
  groups,
  session
}: {
  activeGroupId?: string | undefined;
  friends: ChatFriend[];
  groups: ChatGroup[];
  session: ChatSession;
}): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="green"
      flexDirection="column"
      paddingX={1}
      width={APP_SHELL_LAYOUT.profileWidth}
    >
      <Text color="cyan">[ PROFILE ]</Text>
      <Text>{truncate(session.user.displayName, 28)}</Text>
      <Text color="gray">@{truncate(session.user.username, 27)}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">[ GROUPS ]</Text>
        {groups.map((group) => (
          <Text key={group.id} color={group.id === activeGroupId ? "green" : "white"}>
            {group.id === activeGroupId ? ">" : " "} #{truncate(group.name, 25)}
          </Text>
        ))}
        {groups.length === 0 ? <Text color="gray">No groups yet.</Text> : null}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">[ FRIENDS ]</Text>
        {friends.slice(0, 4).map((friend) => (
          <Text key={friend.id}>
            @{truncate(friend.username, 17)} <Text color="gray">[{friend.status}]</Text>
          </Text>
        ))}
        {friends.length === 0 ? <Text color="gray">No friends yet.</Text> : null}
      </Box>
    </Box>
  );
}

function ChatWorkspace({
  activeGroup,
  chatPaneHeight,
  chatViewportHeight,
  cursorResetKey,
  input,
  messages,
  scrollOffset
}: {
  activeGroup?: ChatGroup | undefined;
  chatPaneHeight: number;
  chatViewportHeight: number;
  cursorResetKey: number;
  input: string;
  messages: ChatMessage[];
  scrollOffset: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} marginLeft={1}>
      <ChatPane
        activeGroup={activeGroup}
        chatPaneHeight={chatPaneHeight}
        chatViewportHeight={chatViewportHeight}
        messages={messages}
        scrollOffset={scrollOffset}
      />
      <Composer cursorResetKey={cursorResetKey} input={input} />
    </Box>
  );
}

function ChatPane({
  activeGroup,
  chatPaneHeight,
  chatViewportHeight,
  messages,
  scrollOffset
}: {
  activeGroup?: ChatGroup | undefined;
  chatPaneHeight: number;
  chatViewportHeight: number;
  messages: ChatMessage[];
  scrollOffset: number;
}): React.ReactElement {
  const visibleMessages = getChatViewport(messages, {
    scrollOffset,
    viewportHeight: chatViewportHeight
  });
  const scrollLabel = scrollOffset > 0 ? ` | SCROLL +${scrollOffset}` : "";

  return (
    <Box
      borderStyle="single"
      borderColor="white"
      flexDirection="column"
      flexGrow={1}
      height={chatPaneHeight}
      paddingX={1}
    >
      <Text color="cyan">
        [ CHAT {activeGroup ? `#${activeGroup.name}` : "NO GROUP"}{scrollLabel} ]
      </Text>
      {visibleMessages.map((message) => (
        <Text key={message.id}>
          <Text color={message.scope === "system" ? "yellow" : "green"}>
            {formatSenderLabel(message.sender)}:
          </Text>{" "}
          {message.body}
        </Text>
      ))}
      {visibleMessages.length === 0 ? <Text color="gray">No messages yet.</Text> : null}
    </Box>
  );
}

function StatusPane({ stats }: { stats: SystemStats | null }): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="yellow"
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      width={APP_SHELL_LAYOUT.localSystemWidth}
    >
      <Text color="cyan">[ LOCAL SYSTEM ]</Text>
      <Text color="gray">Not persisted to Convex</Text>
      {stats ? (
        stats.deviceSpecLines.map((line) => (
          <Text key={line}>{truncate(line, 30)}</Text>
        ))
      ) : (
        <Text color="gray">Reading local stats...</Text>
      )}
    </Box>
  );
}

function QuickCommands(): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      flexDirection="column"
      paddingX={1}
      width={APP_SHELL_LAYOUT.quickCommandsWidth}
    >
      <Text color="cyan">[ QUICK COMMANDS ]</Text>
      {quickCommandHelp.slice(0, 6).map((command) => (
        <Text key={command}>{command}</Text>
      ))}
    </Box>
  );
}

function Composer({
  cursorResetKey,
  input
}: {
  cursorResetKey: number;
  input: string;
}): React.ReactElement {
  const cursorVisible = useBlinkingCursor(cursorResetKey);

  return (
    <Box borderStyle="single" borderColor="green" paddingX={1}>
      <Text color="green">
        {buildComposerLine("$ ", input, cursorVisible)}
      </Text>
    </Box>
  );
}

function useBlinkingCursor(resetKey: number): boolean {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    setCursorVisible(true);
  }, [resetKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((current) => !current);
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return cursorVisible;
}

function NoticeLine({ notice }: { notice: AppNotice }): React.ReactElement {
  const colorByTone: Record<AppNotice["tone"], string> = {
    error: "red",
    info: "cyan",
    success: "green",
    warning: "yellow"
  };

  return (
    <Box borderStyle="single" borderColor={colorByTone[notice.tone]} paddingX={1}>
      <Text color={colorByTone[notice.tone]}>{notice.tone.toUpperCase()}</Text>
      <Text> {notice.message}</Text>
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
  isCurrent: boolean,
  cursorVisible: boolean
): string {
  const displayValue =
    field === "currentPassword" || field === "newPassword"
      ? "*".repeat(value.length)
      : value;

  return isCurrent ? buildComposerLine("", displayValue, cursorVisible) : displayValue;
}

function createSettingsDraft(session: ChatSession): Record<SettingsField, string> {
  return {
    currentPassword: "",
    displayName: session.user.displayName,
    newPassword: "",
    username: session.user.username
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
