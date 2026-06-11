import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TERMINALTALK_CONVEX_URL,
  loadRuntimeConfig
} from "../src/config/env.js";

describe("loadRuntimeConfig", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "terminaltalk-env-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("loads Convex URL from .env.local for local dev startup", () => {
    writeFileSync(
      join(cwd, ".env.local"),
      "CONVEX_URL=https://wandering-otter-232.convex.cloud\n"
    );

    expect(loadRuntimeConfig({ cwd, env: {} })).toEqual({
      convexUrl: "https://wandering-otter-232.convex.cloud",
      demoMode: false
    });
  });

  it("derives a Convex URL from CONVEX_DEPLOYMENT when CONVEX_URL is absent", () => {
    writeFileSync(
      join(cwd, ".env.local"),
      "CONVEX_DEPLOYMENT=dev:wandering-otter-232 # project: terminaltalk\n"
    );

    expect(loadRuntimeConfig({ cwd, env: {} }).convexUrl).toBe(
      "https://wandering-otter-232.convex.cloud"
    );
  });

  it("lets real environment variables override local files", () => {
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, ".env.local"), "CONVEX_URL=https://file.convex.cloud\n");

    expect(
      loadRuntimeConfig({
        cwd,
        env: {
          TERMINALTALK_CONVEX_URL: "https://override.convex.cloud",
          TERMINALTALK_DEMO_MODE: "true"
        }
      })
    ).toEqual({
      convexUrl: "https://override.convex.cloud",
      demoMode: true
    });
  });

  it("uses the public TerminalTalk Convex deployment for global npm installs", () => {
    expect(loadRuntimeConfig({ cwd, env: {} })).toEqual({
      convexUrl: DEFAULT_TERMINALTALK_CONVEX_URL,
      demoMode: false
    });
  });
});
