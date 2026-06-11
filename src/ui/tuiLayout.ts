export const APP_SHELL_LAYOUT = {
  sidebarWidth: 34,
  profileWidth: 34,
  quickCommandsWidth: 34,
  localSystemWidth: 34,
  fallbackTerminalRows: 24,
  headerHeight: 3,
  noticeHeight: 3,
  composerHeight: 12,
  chatPaneChromeHeight: 3,
  chatViewportHeight: 16,
  chatScrollStep: 3,
  chatScrollPage: 8
} as const;

export const NO_CHAT_STATUS_MESSAGE =
  "No chat selected. Add a friend, join a group, or create one to start.";

export interface MainScreenLayout {
  bodyHeight: number;
  chatPaneHeight: number;
  chatViewportHeight: number;
  composerHeight: number;
  terminalRows: number;
}

interface ChatViewportOptions {
  scrollOffset: number;
  viewportHeight: number;
}

export type ChatMessageDisplayLine =
  | { kind: "message-first"; prefix: string; text: string }
  | { kind: "message-continuation"; text: string }
  | { kind: "plain"; text: string };

export interface ChatMessageDisplayOptions {
  body: string;
  maxColumns: number;
  senderLabel?: string | undefined;
}

export interface ComposerDisplayOptions {
  cursorVisible: boolean;
  input: string;
  maxColumns: number;
  maxRows: number;
  placeholder: string;
  prompt: string;
}

export interface ComposerFitOptions {
  maxColumns: number;
  maxRows: number;
  prompt: string;
}

export interface ComposerFitResult {
  accepted: boolean;
  input: string;
}

export type SidebarChatEntry =
  | { kind: "group"; id: string; label: string }
  | { kind: "friend"; id: string; label: string; status: string };

export type SidebarChatTarget =
  | { kind: "group"; id: string }
  | { kind: "friend"; id: string };

interface SidebarGroupLike {
  id: string;
  name: string;
}

interface SidebarFriendLike {
  id: string;
  userId: string;
  username: string;
  status: string;
}

export interface DirectChatFriendLike {
  status: string;
}

export function getMainScreenLayout(terminalRows?: number): MainScreenLayout {
  const safeTerminalRows =
    typeof terminalRows === "number" && Number.isFinite(terminalRows) && terminalRows > 0
      ? terminalRows
      : APP_SHELL_LAYOUT.fallbackTerminalRows;

  const bodyHeight = Math.max(
    1,
    safeTerminalRows - APP_SHELL_LAYOUT.headerHeight - APP_SHELL_LAYOUT.noticeHeight
  );
  const chatPaneHeight = Math.max(1, bodyHeight - APP_SHELL_LAYOUT.composerHeight);
  const chatViewportHeight = Math.max(
    1,
    chatPaneHeight - APP_SHELL_LAYOUT.chatPaneChromeHeight
  );

  return {
    bodyHeight,
    chatPaneHeight,
    chatViewportHeight,
    composerHeight: APP_SHELL_LAYOUT.composerHeight,
    terminalRows: safeTerminalRows
  };
}

export function getChatViewport<T>(
  items: readonly T[],
  { scrollOffset, viewportHeight }: ChatViewportOptions
): T[] {
  if (viewportHeight <= 0 || items.length === 0) {
    return [];
  }

  const maxOffset = Math.max(0, items.length - viewportHeight);
  const safeOffset = clamp(scrollOffset, 0, maxOffset);
  const end = items.length - safeOffset;
  const start = Math.max(0, end - viewportHeight);

  return items.slice(start, end);
}

export function buildChatMessageDisplayLines({
  body,
  maxColumns,
  senderLabel
}: ChatMessageDisplayOptions): ChatMessageDisplayLine[] {
  const safeColumns = Math.max(1, maxColumns);

  if (!senderLabel) {
    return wrapTextWords(body, safeColumns).map((text) => ({
      kind: "plain" as const,
      text
    }));
  }

  const firstLineWidth = Math.max(1, safeColumns - senderLabel.length);
  const [firstText = "", ...remainingText] = wrapTextWords(` ${body}`, firstLineWidth);
  const continuationLines = wrapTextWords(remainingText.join(" "), safeColumns - 2);

  return [
    {
      kind: "message-first" as const,
      prefix: senderLabel,
      text: firstText
    },
    ...continuationLines.map((text) => ({
      kind: "message-continuation" as const,
      text: `  ${text}`
    }))
  ];
}

export function buildComposerLine(
  prompt: string,
  input: string,
  cursorVisible: boolean
): string {
  return `${prompt}${input}${cursorVisible ? "█" : " "}`;
}

export function buildFocusedComposerLine(prompt: string, input: string): string {
  return buildComposerLine(prompt, input, true);
}

export function insertComposerNewline(input: string): string {
  return `${input}\n`;
}

export function deleteComposerCharacter(input: string): string {
  return input.length > 0 ? input.slice(0, -1) : input;
}

export function buildComposerDisplayLines({
  cursorVisible,
  input,
  maxColumns,
  maxRows,
  placeholder,
  prompt
}: ComposerDisplayOptions): string[] {
  const cursor = cursorVisible ? "█" : " ";
  const displayInput = input.length > 0 ? `${input}${cursor}` : `${cursor} ${placeholder}`;
  const safeRows = Math.max(1, maxRows);
  const safeColumns = Math.max(1, maxColumns);
  const lines = displayInput
    .split("\n")
    .flatMap((line, index) =>
      wrapComposerLine(index === 0 ? prompt : "  ", line, safeColumns)
    );

  return lines.slice(Math.max(0, lines.length - safeRows));
}

export function fitComposerInput(
  input: string,
  addition: string,
  options: ComposerFitOptions
): ComposerFitResult {
  const candidate = `${input}${addition}`;

  return isComposerInputWithinBounds(candidate, options)
    ? { accepted: true, input: candidate }
    : { accepted: false, input };
}

export function getNoChatStatusMessage(hasSendableChat: boolean): string | undefined {
  return hasSendableChat ? undefined : NO_CHAT_STATUS_MESSAGE;
}

export function buildSidebarChatEntries(
  groups: readonly SidebarGroupLike[],
  friends: readonly SidebarFriendLike[]
): SidebarChatEntry[] {
  return [
    ...groups.map((group) => ({
      kind: "group" as const,
      id: group.id,
      label: `#${group.name}`
    })),
    ...friends.map((friend) => ({
      kind: "friend" as const,
      id: friend.userId,
      label: `@${friend.username}`,
      status: friend.status
    }))
  ];
}

export function getSidebarSelectionIndex(
  entries: readonly SidebarChatEntry[],
  target?: SidebarChatTarget
): number {
  if (entries.length === 0) {
    return 0;
  }

  const targetIndex = target
    ? entries.findIndex((entry) => entry.kind === target.kind && entry.id === target.id)
    : -1;

  return targetIndex >= 0 ? targetIndex : 0;
}

export function moveSidebarSelectionIndex(
  currentIndex: number,
  delta: number,
  entryCount: number
): number {
  if (entryCount <= 0) {
    return 0;
  }

  return ((currentIndex + delta) % entryCount + entryCount) % entryCount;
}

export function canOpenDirectChat(friend?: DirectChatFriendLike): boolean {
  return friend?.status === "accepted";
}

export function getMouseWheelScrollDelta(input: string): number | null {
  const normalizedInput = stripEscapePrefix(input);
  const match = /^\[<(?<button>64|65);\d+;\d+[mM]$/.exec(normalizedInput);
  const button = match?.groups?.button;

  if (button === "64") {
    return APP_SHELL_LAYOUT.chatScrollStep;
  }

  if (button === "65") {
    return -APP_SHELL_LAYOUT.chatScrollStep;
  }

  return null;
}

export function isTerminalMouseSequence(input: string): boolean {
  const normalizedInput = stripEscapePrefix(input);

  return /^\[<\d+;\d+;\d+[mM]$/.test(normalizedInput)
    || /^\[M[\s\S]{3}$/.test(normalizedInput);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stripEscapePrefix(input: string): string {
  const escape = String.fromCharCode(27);

  return input.startsWith(escape) ? input.slice(1) : input;
}

function wrapComposerLine(prefix: string, line: string, maxColumns: number): string[] {
  const contentWidth = Math.max(1, maxColumns - prefix.length);

  if (line.length === 0) {
    return [prefix];
  }

  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += contentWidth) {
    const nextPrefix = index === 0 ? prefix : "  ";
    chunks.push(`${nextPrefix}${line.slice(index, index + contentWidth)}`);
  }

  return chunks;
}

function isComposerInputWithinBounds(
  input: string,
  { maxColumns, maxRows, prompt }: ComposerFitOptions
): boolean {
  const safeRows = Math.max(1, maxRows);
  const safeColumns = Math.max(1, maxColumns);
  const lines = `${input}█`
    .split("\n")
    .flatMap((line, index) =>
      wrapComposerLine(index === 0 ? prompt : "  ", line, safeColumns)
    );

  return lines.length <= safeRows;
}

function wrapTextWords(text: string, maxColumns: number): string[] {
  const safeColumns = Math.max(1, maxColumns);
  const words = text.trimEnd().split(/\s+/).filter((word) => word.length > 0);
  const startsWithSpace = text.startsWith(" ");
  const lines: string[] = [];
  let currentLine = startsWithSpace ? " " : "";

  for (const word of words) {
    if (currentLine.trim().length === 0) {
      currentLine = `${currentLine}${word}`;
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (candidate.length <= safeColumns) {
      currentLine = candidate;
      continue;
    }

    pushWrappedLine(lines, currentLine, safeColumns);
    currentLine = word;
  }

  if (currentLine.length > 0) {
    pushWrappedLine(lines, currentLine, safeColumns);
  }

  return lines.length > 0 ? lines : [""];
}

function pushWrappedLine(lines: string[], line: string, maxColumns: number): void {
  if (line.length <= maxColumns) {
    lines.push(line);
    return;
  }

  for (let index = 0; index < line.length; index += maxColumns) {
    lines.push(line.slice(index, index + maxColumns));
  }
}
