import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RuntimeConfig {
  convexUrl?: string | undefined;
  demoMode: boolean;
}

export const DEFAULT_TERMINALTALK_CONVEX_URL = "https://wandering-otter-232.convex.cloud";

interface RuntimeConfigOptions {
  cwd?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

export function loadRuntimeConfig(options: RuntimeConfigOptions = {}): RuntimeConfig {
  const env = {
    ...loadLocalEnvFiles(options.cwd ?? process.cwd()),
    ...(options.env ?? process.env)
  };
  const convexUrl = getFirstNonEmptyEnvValue(env, [
    "TERMINALTALK_CONVEX_URL",
    "CONVEX_URL"
  ]);
  const demoMode =
    env["TERMINALTALK_DEMO_MODE"]?.trim().toLowerCase() === "true";

  return {
    convexUrl:
      convexUrl ??
      deriveConvexUrl(env["CONVEX_DEPLOYMENT"]) ??
      DEFAULT_TERMINALTALK_CONVEX_URL,
    demoMode
  };
}

function loadLocalEnvFiles(cwd: string): Record<string, string> {
  return [".env", ".env.local"].reduce<Record<string, string>>((values, filename) => {
    const path = join(cwd, filename);
    if (!existsSync(path)) {
      return values;
    }

    return {
      ...values,
      ...parseEnvFile(readFileSync(path, "utf8"))
    };
  }, {});
}

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = stripInlineComment(stripEnvQuotes(rawValue)).trim();
  }

  return values;
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function stripInlineComment(value: string): string {
  const commentIndex = value.indexOf(" #");
  return commentIndex >= 0 ? value.slice(0, commentIndex) : value;
}

function getFirstNonEmptyEnvValue(
  env: Record<string, string | undefined>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function deriveConvexUrl(deployment?: string): string | undefined {
  const deploymentName = deployment?.trim().split(/\s+/)[0]?.split(":").at(-1);

  return deploymentName && deploymentName.length > 0
    ? `https://${deploymentName}.convex.cloud`
    : undefined;
}
