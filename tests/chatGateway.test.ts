import { describe, expect, it } from "vitest";
import { DemoChatGateway } from "../src/services/chatGateway.js";

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
