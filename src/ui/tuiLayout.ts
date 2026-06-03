export const APP_SHELL_LAYOUT = {
  sidebarWidth: 34,
  profileWidth: 34,
  quickCommandsWidth: 34,
  localSystemWidth: 34,
  fallbackTerminalRows: 24,
  headerHeight: 3,
  noticeHeight: 3,
  composerHeight: 3,
  chatPaneChromeHeight: 3,
  chatViewportHeight: 16,
  chatScrollStep: 3,
  chatScrollPage: 8
} as const;

export interface MainScreenLayout {
  bodyHeight: number;
  chatPaneHeight: number;
  chatViewportHeight: number;
  terminalRows: number;
}

interface ChatViewportOptions {
  scrollOffset: number;
  viewportHeight: number;
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

export function buildComposerLine(
  prompt: string,
  input: string,
  cursorVisible: boolean
): string {
  return `${prompt}${input}${cursorVisible ? "█" : " "}`;
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
