import { describe, expect, it } from "vitest";
import { isInvalidStoredSessionError } from "../src/services/sessionErrors.js";

describe("isInvalidStoredSessionError", () => {
  it("detects invalid or expired Convex session errors", () => {
    expect(
      isInvalidStoredSessionError(new Error("Session is invalid or expired."))
    ).toBe(true);
    expect(
      isInvalidStoredSessionError(
        new Error(
          "[CONVEX Q(groups:listMine)] Server Error Uncaught Error: Session is invalid or expired."
        )
      )
    ).toBe(true);
  });

  it("detects stored sessions whose user was deleted", () => {
    expect(isInvalidStoredSessionError(new Error("Session user does not exist."))).toBe(
      true
    );
  });

  it("ignores unrelated errors", () => {
    expect(isInvalidStoredSessionError(new Error("Network disconnected."))).toBe(false);
    expect(isInvalidStoredSessionError("Session is invalid or expired.")).toBe(false);
  });
});
