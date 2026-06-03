import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ChatSession } from "../domain/types.js";

const sessionSchema = z.object({
  token: z.string().min(1),
  convexUrl: z.string().url().optional(),
  user: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    displayName: z.string().min(1)
  })
});

export function getConfigFilePath(): string {
  const appDirectory = "terminaltalk";

  if (platform() === "win32") {
    const appData = process.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming");
    return join(appData, appDirectory, "config.json");
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", appDirectory, "config.json");
  }

  const xdgConfig = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");
  return join(xdgConfig, appDirectory, "config.json");
}

export function loadStoredSession(): ChatSession | null {
  const path = getConfigFilePath();

  if (!existsSync(path)) {
    return null;
  }

  const parsed = sessionSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.success ? parsed.data : null;
}

export function saveStoredSession(session: ChatSession): void {
  const path = getConfigFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
}

export function clearStoredSession(): void {
  const path = getConfigFilePath();

  if (existsSync(path)) {
    rmSync(path);
  }
}
