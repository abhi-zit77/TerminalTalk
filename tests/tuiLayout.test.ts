import { describe, expect, it } from "vitest";
import {
  APP_SHELL_LAYOUT,
  buildComposerLine,
  getChatViewport,
  getMainScreenLayout,
  getMouseWheelScrollDelta,
  isTerminalMouseSequence
} from "../src/ui/tuiLayout.js";
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN
} from "../src/ui/terminalScreen.js";

describe("TUI layout helpers", () => {
  it("keeps all left sidebar panels aligned to the same width", () => {
    expect(APP_SHELL_LAYOUT.sidebarWidth).toBe(34);
    expect(APP_SHELL_LAYOUT.profileWidth).toBe(APP_SHELL_LAYOUT.quickCommandsWidth);
    expect(APP_SHELL_LAYOUT.localSystemWidth).toBe(APP_SHELL_LAYOUT.quickCommandsWidth);
  });

  it("reserves fixed rows for header, composer, and notice while expanding chat", () => {
    expect(getMainScreenLayout(48)).toEqual({
      bodyHeight: 42,
      chatPaneHeight: 39,
      chatViewportHeight: 36,
      terminalRows: 48
    });
  });

  it("falls back to a usable terminal height when rows are unavailable", () => {
    expect(getMainScreenLayout(undefined).terminalRows).toBe(
      APP_SHELL_LAYOUT.fallbackTerminalRows
    );
  });

  it("shows the newest chat messages when the scroll offset is zero", () => {
    const messages = Array.from({ length: 20 }, (_, index) => `message-${index + 1}`);

    expect(getChatViewport(messages, { viewportHeight: 5, scrollOffset: 0 })).toEqual([
      "message-16",
      "message-17",
      "message-18",
      "message-19",
      "message-20"
    ]);
  });

  it("moves the chat viewport upward when the user scrolls back", () => {
    const messages = Array.from({ length: 20 }, (_, index) => `message-${index + 1}`);

    expect(getChatViewport(messages, { viewportHeight: 5, scrollOffset: 2 })).toEqual([
      "message-14",
      "message-15",
      "message-16",
      "message-17",
      "message-18"
    ]);
  });

  it("clamps chat scroll offsets beyond the available history", () => {
    const messages = Array.from({ length: 8 }, (_, index) => `message-${index + 1}`);

    expect(getChatViewport(messages, { viewportHeight: 5, scrollOffset: 99 })).toEqual([
      "message-1",
      "message-2",
      "message-3",
      "message-4",
      "message-5"
    ]);
  });

  it("renders a visible composer block cursor when focused", () => {
    expect(buildComposerLine("$ ", "hello", true)).toBe("$ hello█");
    expect(buildComposerLine("$ ", "hello", false)).toBe("$ hello ");
  });

  it("parses xterm mouse wheel escape sequences when the terminal reports them", () => {
    expect(getMouseWheelScrollDelta("[<64;22;7M")).toBe(APP_SHELL_LAYOUT.chatScrollStep);
    expect(getMouseWheelScrollDelta("[<65;22;7M")).toBe(-APP_SHELL_LAYOUT.chatScrollStep);
    expect(getMouseWheelScrollDelta("\u001B[<64;22;7M")).toBe(
      APP_SHELL_LAYOUT.chatScrollStep
    );
    expect(getMouseWheelScrollDelta("plain text")).toBeNull();
  });

  it("identifies terminal mouse click coordinates so they are not typed", () => {
    expect(isTerminalMouseSequence("[<0;53;18M")).toBe(true);
    expect(isTerminalMouseSequence("\u001B[<0;53;18m")).toBe(true);
    expect(isTerminalMouseSequence("[<32;53;18M")).toBe(true);
    expect(isTerminalMouseSequence("/settings")).toBe(false);
  });
});

describe("terminal screen helpers", () => {
  it("enters a dedicated alternate terminal screen and hides the native cursor", () => {
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[?1049h");
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[2J");
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[H");
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[?25l");
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[?1000h");
    expect(ENTER_ALTERNATE_SCREEN).toContain("\u001B[?1006h");
  });

  it("restores the normal terminal screen and native cursor on exit", () => {
    expect(EXIT_ALTERNATE_SCREEN).toContain("\u001B[?25h");
    expect(EXIT_ALTERNATE_SCREEN).toContain("\u001B[?1006l");
    expect(EXIT_ALTERNATE_SCREEN).toContain("\u001B[?1000l");
    expect(EXIT_ALTERNATE_SCREEN).toContain("\u001B[?1049l");
  });
});
