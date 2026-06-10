import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
  terminalThemes,
  themeIds
} from "../src/config/themes.js";

describe("terminal themes", () => {
  it("ships exactly the five selectable TerminalTalk themes", () => {
    expect(themeIds).toEqual([
      "midnight-hacker",
      "blood-moon",
      "deep-ocean",
      "phantom-purple",
      "golden-ember"
    ]);
  });

  it("uses Phantom Purple as the default theme", () => {
    expect(DEFAULT_THEME_ID).toBe("phantom-purple");
    expect(getTheme(DEFAULT_THEME_ID).name).toBe("Phantom Purple");
  });

  it("defines complete color zones for every theme", () => {
    for (const themeId of themeIds) {
      const theme = terminalThemes[themeId];

      expect(theme.header.title).toMatch(/^#|^[a-z]+$/);
      expect(theme.sidebar.activeItem).toMatch(/^#|^[a-z]+$/);
      expect(theme.chat.messageText).toMatch(/^#|^[a-z]+$/);
      expect(theme.composer.cursor).toMatch(/^#|^[a-z]+$/);
      expect(theme.auth.activeBorder).toMatch(/^#|^[a-z]+$/);
    }
  });

  it("validates theme ids before loading persisted preferences", () => {
    expect(isThemeId("deep-ocean")).toBe(true);
    expect(isThemeId("slash-theme")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});
