export type SlashCommand =
  | { type: "add-friend"; username: string }
  | { type: "create-group"; name: string }
  | { type: "help" }
  | { type: "join-group"; code: string }
  | { type: "logout" }
  | { type: "settings" }
  | { type: "theme" };

export type ParseCommandResult =
  | { ok: true; command: SlashCommand }
  | { ok: false; error: string };

export const quickCommandHelp = [
  "/theme",
  "/settings",
  "/create-group <name>",
  "/join-group <code>",
  "/add-friend <username>",
  "/help",
  "/logout"
] as const;

export function parseCommand(input: string): ParseCommandResult {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { ok: false, error: "Commands must start with /." };
  }

  const [rawCommand = "", ...args] = trimmed.split(/\s+/);
  const rest = args.join(" ").trim();

  switch (rawCommand) {
    case "/theme":
      return { ok: true, command: { type: "theme" } };
    case "/settings":
      return { ok: true, command: { type: "settings" } };
    case "/help":
      return { ok: true, command: { type: "help" } };
    case "/logout":
      return { ok: true, command: { type: "logout" } };
    case "/create-group":
      if (rest.length === 0) {
        return { ok: false, error: "Usage: /create-group <name>" };
      }

      return { ok: true, command: { type: "create-group", name: rest } };
    case "/join-group": {
      const [code] = args;
      if (!code) {
        return { ok: false, error: "Usage: /join-group <code>" };
      }

      return { ok: true, command: { type: "join-group", code } };
    }
    case "/add-friend": {
      const [username] = args;
      if (!username) {
        return { ok: false, error: "Usage: /add-friend <username>" };
      }

      return { ok: true, command: { type: "add-friend", username } };
    }
    default:
      return {
        ok: false,
        error: `Unknown command: ${rawCommand}. Run /help to see available commands.`
      };
  }
}
