import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoChatGateway, createChatGateway } from "../src/services/chatGateway.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("chat gateway runtime selection", () => {
  it("requires Convex unless demo mode is explicitly enabled", () => {
    expect(() => createChatGateway({ demoMode: false })).toThrow(
      "TERMINALTALK_CONVEX_URL is required unless TERMINALTALK_DEMO_MODE=true."
    );
    expect(createChatGateway({ demoMode: true }).mode).toBe("demo");
  });
});

describe("DemoChatGateway auth", () => {
  it("allows three-character passwords for signup and login", async () => {
    const gateway = new DemoChatGateway();
    const auth = await gateway.signup({
      username: "ram77",
      displayName: "Ram",
      password: "abc"
    });

    const login = await gateway.login({ username: "ram77", password: "abc" });

    expect(login.sessionToken).toMatch(/^demo-/);
    expect(login.user).toEqual(auth.user);
  });

  it("rejects unknown users and wrong passwords on login", async () => {
    const gateway = new DemoChatGateway();

    await expect(
      gateway.login({ username: "missing", password: "wrong-pass" })
    ).rejects.toThrow("Invalid username or password.");

    await gateway.signup({
      username: "rohan77",
      displayName: "Rohan",
      password: "correct-pass"
    });

    await expect(
      gateway.login({ username: "rohan77", password: "wrong-pass" })
    ).rejects.toThrow("Invalid username or password.");
  });

  it("allows changing a password to three characters", async () => {
    const gateway = new DemoChatGateway();
    const auth = await gateway.signup({
      username: "shortpass",
      displayName: "Short Pass",
      password: "old"
    });
    const session = { token: auth.sessionToken, user: auth.user };

    await gateway.updateProfile(session, {
      displayName: "Short Pass",
      username: "shortpass",
      currentPassword: "old",
      newPassword: "new"
    });

    const login = await gateway.login({ username: "shortpass", password: "new" });

    expect(login.sessionToken).toMatch(/^demo-/);
    expect(login.user).toEqual(auth.user);
  });
});

describe("DemoChatGateway profile settings", () => {
  it("updates the signed-in user's profile and password", async () => {
    const gateway = new DemoChatGateway();
    const auth = await gateway.signup({
      username: "rohan77",
      displayName: "Rohan",
      password: "current-pass"
    });
    const session = { token: auth.sessionToken, user: auth.user };

    const updatedUser = await gateway.updateProfile(session, {
      displayName: "Rohan Dev",
      username: "rohan_dev",
      currentPassword: "current-pass",
      newPassword: "new-password"
    });

    expect(updatedUser).toEqual({
      id: auth.user.id,
      displayName: "Rohan Dev",
      username: "rohan_dev"
    });
  });

  it("rejects username changes that collide with another user", async () => {
    const gateway = new DemoChatGateway();
    const rohan = await gateway.signup({
      username: "rohan77",
      displayName: "Rohan",
      password: "current-pass"
    });
    await gateway.signup({
      username: "takenname",
      displayName: "Taken",
      password: "other-pass"
    });

    await expect(
      gateway.updateProfile(
        { token: rohan.sessionToken, user: rohan.user },
        { displayName: "Rohan", username: "takenname" }
      )
    ).rejects.toThrow("Username is already taken.");
  });

  it("updates a demo profile loaded from a saved local session", async () => {
    const gateway = new DemoChatGateway();

    const updatedUser = await gateway.updateProfile(
      {
        token: "demo-existing-session",
        user: {
          id: "saved-user",
          username: "saveduser",
          displayName: "Saved User"
        }
      },
      {
        displayName: "Saved Local User",
        username: "saved_local"
      }
    );

    expect(updatedUser).toEqual({
      id: "saved-user",
      displayName: "Saved Local User",
      username: "saved_local"
    });
  });
});

describe("DemoChatGateway direct chat subscriptions", () => {
  it("requires an accepted friend before sending direct messages", async () => {
    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const rohan = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const abhiSession = { token: abhi.sessionToken, user: abhi.user };
    const rohanSession = { token: rohan.sessionToken, user: rohan.user };
    const abhiTerminalSessionId = await gateway.startTerminalSession(abhiSession);

    await gateway.addFriend(abhiSession, "rohan");

    await expect(
      gateway.sendMessage(abhiSession, {
        body: "pending should fail",
        friendUserId: rohan.user.id,
        terminalSessionId: abhiTerminalSessionId
      })
    ).rejects.toThrow("Direct messages require an accepted friend.");

    await gateway.acceptFriendRequest(rohanSession, "abhi");
    await gateway.sendMessage(abhiSession, {
      body: "accepted works",
      friendUserId: rohan.user.id,
      terminalSessionId: abhiTerminalSessionId
    });

    const received: string[][] = [];
    const unsubscribe = gateway.subscribeMessages(
      rohanSession,
      { friendUserId: abhi.user.id },
      (messages) => {
        received.push(messages.map((message) => message.body ?? ""));
      }
    );
    unsubscribe();

    expect(received.at(-1)).toEqual(["accepted works"]);
  });

  it("redacts messages from the ended terminal session only", async () => {
    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const rohan = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const abhiSession = { token: abhi.sessionToken, user: abhi.user };
    const rohanSession = { token: rohan.sessionToken, user: rohan.user };
    const abhiTerminalSessionId = await gateway.startTerminalSession(abhiSession);
    const rohanTerminalSessionId = await gateway.startTerminalSession(rohanSession);

    await gateway.sendMessage(abhiSession, {
      body: "abhi vanishes",
      groupId: "demo-general",
      terminalSessionId: abhiTerminalSessionId
    });
    await gateway.sendMessage(rohanSession, {
      body: "rohan remains",
      groupId: "demo-general",
      terminalSessionId: rohanTerminalSessionId
    });

    await gateway.endTerminalSession(abhiSession, abhiTerminalSessionId);

    const received: Array<
      Array<{ body?: string | undefined; redactedAt?: number | undefined }>
    > = [];
    const unsubscribe = gateway.subscribeMessages(
      rohanSession,
      { groupId: "demo-general" },
      (messages) => {
        received.push(
          messages
            .filter((message) => message.sender.username !== "terminaltalk")
            .map((message) => ({
              body: message.body,
              redactedAt: message.redactedAt
            }))
        );
      }
    );
    unsubscribe();

    const latestMessages = received.at(-1);
    expect(latestMessages?.[0]?.body).toBeUndefined();
    expect(latestMessages?.[0]?.redactedAt).toEqual(expect.any(Number));
    expect(latestMessages?.[1]?.body).toBe("rohan remains");
  });

  it("removes redacted message placeholders after twenty four hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00.000Z"));

    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const rohan = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const abhiSession = { token: abhi.sessionToken, user: abhi.user };
    const rohanSession = { token: rohan.sessionToken, user: rohan.user };
    const abhiTerminalSessionId = await gateway.startTerminalSession(abhiSession);
    const rohanTerminalSessionId = await gateway.startTerminalSession(rohanSession);

    await gateway.sendMessage(abhiSession, {
      body: "abhi vanishes",
      groupId: "demo-general",
      terminalSessionId: abhiTerminalSessionId
    });
    await gateway.sendMessage(rohanSession, {
      body: "rohan remains",
      groupId: "demo-general",
      terminalSessionId: rohanTerminalSessionId
    });

    await gateway.endTerminalSession(abhiSession, abhiTerminalSessionId);
    vi.setSystemTime(new Date("2026-06-11T00:00:00.001Z"));

    const received: string[][] = [];
    const unsubscribe = gateway.subscribeMessages(
      rohanSession,
      { groupId: "demo-general" },
      (messages) => {
        received.push(
          messages
            .filter((message) => message.sender.username !== "terminaltalk")
            .map((message) => message.body ?? "<redacted>")
        );
      }
    );
    unsubscribe();

    expect(received.at(-1)).toEqual(["rohan remains"]);
  });

  it("filters direct chat messages by selected friend", async () => {
    const gateway = new DemoChatGateway();
    const auth = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const session = { token: auth.sessionToken, user: auth.user };
    const terminalSessionId = await gateway.startTerminalSession(session);
    const rohanAuth = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const ishaAuth = await gateway.signup({
      username: "isha",
      displayName: "Isha",
      password: "current-pass"
    });
    await gateway.addFriend(session, "rohan");
    await gateway.acceptFriendRequest(
      { token: rohanAuth.sessionToken, user: rohanAuth.user },
      "abhi"
    );
    await gateway.addFriend(session, "isha");
    await gateway.acceptFriendRequest({ token: ishaAuth.sessionToken, user: ishaAuth.user }, "abhi");

    const friends = await gateway.listFriends(session);
    const rohanFriend = friends.find((friend) => friend.username === "rohan");
    const isha = friends.find((friend) => friend.username === "isha");
    if (!rohanFriend || !isha) {
      throw new Error("Expected demo friends to exist.");
    }

    const directMessages: string[][] = [];
    const unsubscribe = gateway.subscribeMessages(
      session,
      { friendUserId: rohanFriend.userId },
      (messages) => {
        directMessages.push(messages.map((message) => message.body ?? ""));
      }
    );

    await gateway.sendMessage(session, {
      body: "for rohan",
      friendUserId: rohanFriend.userId,
      terminalSessionId
    });
    await gateway.sendMessage(session, {
      body: "for isha",
      friendUserId: isha.userId,
      terminalSessionId
    });
    unsubscribe();

    expect(directMessages.at(-1)).toEqual(["for rohan"]);
  });

  it("blocks direct messages in both directions", async () => {
    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const rohan = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const abhiSession = { token: abhi.sessionToken, user: abhi.user };
    const rohanSession = { token: rohan.sessionToken, user: rohan.user };
    const abhiTerminalSessionId = await gateway.startTerminalSession(abhiSession);

    await gateway.addFriend(abhiSession, "rohan");
    await gateway.acceptFriendRequest(rohanSession, "abhi");
    await gateway.blockFriend(abhiSession, "rohan");

    await expect(
      gateway.sendMessage(abhiSession, {
        body: "blocked",
        friendUserId: rohan.user.id,
        terminalSessionId: abhiTerminalSessionId
      })
    ).rejects.toThrow("Direct messages require an accepted friend.");
  });

  it("requires a fresh friend request after unblock", async () => {
    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const rohan = await gateway.signup({
      username: "rohan",
      displayName: "Rohan",
      password: "current-pass"
    });
    const abhiSession = { token: abhi.sessionToken, user: abhi.user };
    const rohanSession = { token: rohan.sessionToken, user: rohan.user };

    await gateway.addFriend(abhiSession, "rohan");
    await gateway.acceptFriendRequest(rohanSession, "abhi");
    await gateway.blockFriend(rohanSession, "abhi");

    expect(await gateway.listFriends(abhiSession)).not.toContainEqual(
      expect.objectContaining({ username: "rohan", status: "accepted" })
    );
    expect(await gateway.listFriends(rohanSession)).toContainEqual(
      expect.objectContaining({ username: "abhi", status: "blocked" })
    );
    await expect(gateway.addFriend(abhiSession, "rohan")).rejects.toThrow(
      "Friend requests are blocked for that user."
    );

    await gateway.unblockFriend(rohanSession, "abhi");
    await gateway.addFriend(abhiSession, "rohan");

    expect(await gateway.listFriends(abhiSession)).toContainEqual(
      expect.objectContaining({
        direction: "outgoing",
        status: "pending",
        username: "rohan"
      })
    );
    expect(await gateway.listFriends(rohanSession)).toContainEqual(
      expect.objectContaining({
        direction: "incoming",
        status: "pending",
        username: "abhi"
      })
    );
  });
});

describe("DemoChatGateway groups", () => {
  it("removes a group from a user's directory when they leave", async () => {
    const gateway = new DemoChatGateway();
    const abhi = await gateway.signup({
      username: "abhi",
      displayName: "Abhi",
      password: "current-pass"
    });
    const session = { token: abhi.sessionToken, user: abhi.user };

    const group = await gateway.createGroup(session, "IDK");
    expect(await gateway.listGroups(session)).toContainEqual(
      expect.objectContaining({ id: group.id, name: "IDK" })
    );

    await gateway.leaveGroup(session, group.id);

    expect(await gateway.listGroups(session)).not.toContainEqual(
      expect.objectContaining({ id: group.id })
    );
  });
});
