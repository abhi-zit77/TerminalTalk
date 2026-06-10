import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChatFriend, ChatGroup } from "../src/domain/types.js";
import {
  clearStoredSession,
  loadLocalDirectory,
  removeLocalGroup,
  saveStoredSession,
  setLocalNickname,
  upsertLocalFriend,
  upsertLocalGroup
} from "../src/services/sessionStore.js";

describe("local directory storage", () => {
  const originalAppData = process.env["APPDATA"];
  let appData: string;

  beforeEach(() => {
    appData = mkdtempSync(join(tmpdir(), "terminaltalk-config-"));
    process.env["APPDATA"] = appData;
  });

  afterEach(() => {
    if (originalAppData === undefined) {
      delete process.env["APPDATA"];
    } else {
      process.env["APPDATA"] = originalAppData;
    }
    rmSync(appData, { recursive: true, force: true });
  });

  it("keeps friends, groups, and nicknames locally after logout", () => {
    const friend: ChatFriend = {
      id: "friend-record",
      userId: "user-rohan",
      username: "rohan",
      displayName: "Rohan",
      status: "accepted"
    };
    const group: ChatGroup = {
      id: "group-idk",
      name: "IDK",
      role: "member"
    };

    saveStoredSession({
      token: "session-token",
      user: { id: "user-abhi", username: "abhi", displayName: "Abhi" }
    });
    upsertLocalFriend("user-abhi", friend);
    upsertLocalGroup("user-abhi", group);
    setLocalNickname("user-abhi", "rohan", "Bro");
    clearStoredSession();

    expect(loadLocalDirectory("user-abhi")).toEqual({
      friends: [friend],
      groups: [group],
      nicknames: { rohan: "Bro" }
    });
  });

  it("removes a group only from the signed-in user's local directory", () => {
    const group: ChatGroup = {
      id: "group-idk",
      name: "IDK",
      role: "member"
    };

    upsertLocalGroup("user-abhi", group);
    upsertLocalGroup("user-rohan", group);
    removeLocalGroup("user-abhi", "group-idk");

    expect(loadLocalDirectory("user-abhi").groups).toEqual([]);
    expect(loadLocalDirectory("user-rohan").groups).toEqual([group]);
  });
});
