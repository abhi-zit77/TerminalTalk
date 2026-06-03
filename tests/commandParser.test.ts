import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/features/commands/commandParser.js";

describe("parseCommand", () => {
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

  it("parses private nicknames while preserving the real username", () => {
    expect(parseCommand("/nick actualuser Lead Manager")).toEqual({
      ok: true,
      command: {
        type: "nick",
        username: "actualuser",
        nickname: "Lead Manager"
      }
    });
  });

  it("rejects unknown commands with a helpful error", () => {
    expect(parseCommand("/deploy")).toEqual({
      ok: false,
      error: "Unknown command: /deploy. Run /help to see available commands."
    });
  });
});
