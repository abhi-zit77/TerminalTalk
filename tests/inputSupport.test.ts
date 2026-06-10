import { describe, expect, it } from "vitest";
import { isRawInputSupported } from "../src/ui/inputSupport.js";

describe("isRawInputSupported", () => {
  it("accepts interactive TTY input streams with raw mode support", () => {
    expect(isRawInputSupported({ isTTY: true, setRawMode: () => undefined })).toBe(
      true
    );
  });

  it("rejects non-interactive streams so Ink does not crash on startup", () => {
    expect(isRawInputSupported({ isTTY: false, setRawMode: () => undefined })).toBe(
      false
    );
    expect(isRawInputSupported({ isTTY: true })).toBe(false);
  });
});
