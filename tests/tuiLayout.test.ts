import { describe, expect, it } from "vitest";
import {
  APP_SHELL_LAYOUT,
  buildChatMessageDisplayLines,
  buildComposerLine,
  buildComposerDisplayLines,
  buildFocusedComposerLine,
  buildSidebarChatEntries,
  canOpenDirectChat,
  deleteComposerCharacter,
  fitComposerInput,
  getChatViewport,
  getMainScreenLayout,
  getMouseWheelScrollDelta,
  getNoChatStatusMessage,
  getSidebarSelectionIndex,
  insertComposerNewline,
  isTerminalMouseSequence,
  moveSidebarSelectionIndex,
  NO_CHAT_STATUS_MESSAGE
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
      chatPaneHeight: 30,
      chatViewportHeight: 27,
      composerHeight: 12,
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

  it("wraps long chat messages inside the visible chat pane width", () => {
    expect(
      buildChatMessageDisplayLines({
        body: "hey there let me tell you that TerminalTalk is clean",
        maxColumns: 32,
        senderLabel: "Rohan (@rohan77):"
      })
    ).toEqual([
      {
        kind: "message-first",
        prefix: "Rohan (@rohan77):",
        text: " hey there let"
      },
      {
        kind: "message-continuation",
        text: "  me tell you that TerminalTalk"
      },
      {
        kind: "message-continuation",
        text: "  is clean"
      }
    ]);
  });

  it("keeps screenshot-sized chat rows inside the pane columns", () => {
    const maxColumns = 72;
    const lines = buildChatMessageDisplayLines({
      body: "hey there let me tell you that the creator of TerminalTalk is Abhijit Singh and he is a awesome guy, like he created this at the age of 14. Damnnn!!!",
      maxColumns,
      senderLabel: "Rohan (@rohan77):"
    });

    for (const line of lines) {
      const width =
        line.kind === "message-first"
          ? line.prefix.length + line.text.length
          : line.text.length;
      expect(width).toBeLessThanOrEqual(maxColumns);
    }
  });

  it("hard-wraps single long words so they cannot escape the chat pane", () => {
    const maxColumns = 24;
    const lines = buildChatMessageDisplayLines({
      body: "kkvsvbhibbiszbbbvihbvbvhibv",
      maxColumns,
      senderLabel: "Rohan:"
    });

    for (const line of lines) {
      const width =
        line.kind === "message-first"
          ? line.prefix.length + line.text.length
          : line.text.length;
      expect(width).toBeLessThanOrEqual(maxColumns);
    }
  });

  it("keeps vanished chat messages bounded to the chat pane width", () => {
    expect(
      buildChatMessageDisplayLines({
        body: "Abhijit with a very long nickname's message vanished",
        maxColumns: 24
      })
    ).toEqual([
      {
        kind: "plain",
        text: "Abhijit with a very long"
      },
      {
        kind: "plain",
        text: "nickname's message"
      },
      {
        kind: "plain",
        text: "vanished"
      }
    ]);
  });

  it("renders a visible composer block cursor when focused", () => {
    expect(buildComposerLine("$ ", "hello", true)).toBe("$ hello█");
    expect(buildComposerLine("$ ", "hello", false)).toBe("$ hello ");
  });

  it("keeps focused input rendering steady to avoid timer-driven TUI flicker", () => {
    expect(buildFocusedComposerLine("$ ", "hello")).toBe("$ hello█");
    expect(buildFocusedComposerLine("", "secret")).toBe("secret█");
  });

  it("inserts a newline with the composer newline helper", () => {
    expect(insertComposerNewline("hello")).toBe("hello\n");
    expect(insertComposerNewline("hello\nworld")).toBe("hello\nworld\n");
  });

  it("deletes one composer character across line boundaries", () => {
    expect(deleteComposerCharacter("hello")).toBe("hell");
    expect(deleteComposerCharacter("hello\n")).toBe("hello");
    expect(deleteComposerCharacter("")).toBe("");
  });

  it("renders multiline composer input with a stable cursor", () => {
    expect(
      buildComposerDisplayLines({
        cursorVisible: true,
        input: "hello\nworld",
        maxColumns: 20,
        maxRows: 4,
        placeholder: "Type a message",
        prompt: "$ "
      })
    ).toEqual(["$ hello", "  world█"]);
  });

  it("wraps and clips long composer input without resizing the box", () => {
    expect(
      buildComposerDisplayLines({
        cursorVisible: true,
        input: "abcdefghi",
        maxColumns: 8,
        maxRows: 2,
        placeholder: "Type a message",
        prompt: "$ "
      })
    ).toEqual(["$ abcdef", "  ghi█"]);

    expect(
      buildComposerDisplayLines({
        cursorVisible: true,
        input: "one\ntwo\nthree",
        maxColumns: 20,
        maxRows: 2,
        placeholder: "Type a message",
        prompt: "$ "
      })
    ).toEqual(["  two", "  three█"]);
  });

  it("accepts composer input only while it fits inside the visible box", () => {
    const options = {
      maxColumns: 8,
      maxRows: 2,
      prompt: "$ "
    };

    expect(fitComposerInput("abcdefghi", "j", options)).toEqual({
      accepted: true,
      input: "abcdefghij"
    });
    expect(fitComposerInput("abcdefghijk", "l", options)).toEqual({
      accepted: false,
      input: "abcdefghijk"
    });
  });

  it("rejects a composer newline when the visible box has no remaining row", () => {
    expect(
      fitComposerInput("hello\nworld", "\n", {
        maxColumns: 20,
        maxRows: 2,
        prompt: "$ "
      })
    ).toEqual({
      accepted: false,
      input: "hello\nworld"
    });
  });

  it("shows a friendly status hint when no chat can receive messages", () => {
    expect(getNoChatStatusMessage(false)).toBe(NO_CHAT_STATUS_MESSAGE);
    expect(getNoChatStatusMessage(true)).toBeUndefined();
  });

  it("builds sidebar chat entries with groups first and friends second", () => {
    expect(
      buildSidebarChatEntries(
        [
          { id: "group-1", name: "general" },
          { id: "group-2", name: "launch" }
        ],
        [
          {
            id: "friend-record-1",
            userId: "user-1",
            username: "rohan",
            status: "pending"
          }
        ]
      )
    ).toEqual([
      { kind: "group", id: "group-1", label: "#general" },
      { kind: "group", id: "group-2", label: "#launch" },
      { kind: "friend", id: "user-1", label: "@rohan", status: "pending" }
    ]);
  });

  it("finds the sidebar selection index for the active chat target", () => {
    const entries = buildSidebarChatEntries(
      [{ id: "group-1", name: "general" }],
      [
        {
          id: "friend-record-1",
          userId: "user-1",
          username: "rohan",
          status: "accepted"
        }
      ]
    );

    expect(getSidebarSelectionIndex(entries, { kind: "friend", id: "user-1" })).toBe(1);
    expect(getSidebarSelectionIndex(entries, { kind: "group", id: "missing" })).toBe(0);
    expect(getSidebarSelectionIndex([], { kind: "group", id: "missing" })).toBe(0);
  });

  it("wraps sidebar arrow navigation across groups and friends", () => {
    expect(moveSidebarSelectionIndex(0, -1, 3)).toBe(2);
    expect(moveSidebarSelectionIndex(2, 1, 3)).toBe(0);
    expect(moveSidebarSelectionIndex(1, 1, 3)).toBe(2);
    expect(moveSidebarSelectionIndex(1, 1, 0)).toBe(0);
  });

  it("only opens direct chat subscriptions for accepted friends", () => {
    expect(canOpenDirectChat({ status: "accepted" })).toBe(true);
    expect(canOpenDirectChat({ status: "pending" })).toBe(false);
    expect(canOpenDirectChat({ status: "blocked" })).toBe(false);
    expect(canOpenDirectChat(undefined)).toBe(false);
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
