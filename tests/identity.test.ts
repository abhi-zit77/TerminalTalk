import { describe, expect, it } from "vitest";
import { formatSenderLabel } from "../src/features/identity/formatSenderLabel.js";

describe("formatSenderLabel", () => {
  it("uses username when no display name or nickname exists", () => {
    expect(formatSenderLabel({ username: "actualuser" })).toBe("@actualuser");
  });

  it("shows display name with username as the stable identity", () => {
    expect(
      formatSenderLabel({ username: "actualuser", displayName: "Asha Rao" })
    ).toBe("Asha Rao (@actualuser)");
  });

  it("prioritizes private nickname and still preserves real username", () => {
    expect(
      formatSenderLabel({
        username: "actualuser",
        displayName: "Asha Rao",
        nickname: "Lead Manager"
      })
    ).toBe("Lead Manager (@actualuser)");
  });
});
