import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/features/commands/commandParser.js";

describe("parseCommand", () => {
  it("parses the theme picker command", () => {
    expect(parseCommand("/theme")).toEqual({
      ok: true,
      command: { type: "theme" }
    });
  });

  it("does not accept slash-theme as a command alias", () => {
    expect(parseCommand("/slash-theme")).toEqual({
      ok: false,
      error: "Unknown command: /slash-theme. Run /help to see available commands."
    });
  });

  it("parses group creation names with spaces", () => {
    expect(parseCommand("/create-group Core Team")).toEqual({
      ok: true,
      command: { type: "create-group", name: "Core Team" }
    });
  });

  it("requires arguments for join-group", () => {
    expect(parseCommand("/join-group")).toEqual({
      ok: false,
      error: "Usage: /join-group <code>"
    });
  });

  it("does not accept nickname changes as slash commands", () => {
    expect(parseCommand("/nick actualuser Lead Manager")).toEqual({
      ok: false,
      error: "Unknown command: /nick. Run /help to see available commands."
    });
  });

  it("does not accept friend request approvals as slash commands", () => {
    expect(parseCommand("/accept-friend rohan")).toEqual({
      ok: false,
      error: "Unknown command: /accept-friend. Run /help to see available commands."
    });
  });

  it("rejects unknown commands with a helpful error", () => {
    expect(parseCommand("/deploy")).toEqual({
      ok: false,
      error: "Unknown command: /deploy. Run /help to see available commands."
    });
  });
});
