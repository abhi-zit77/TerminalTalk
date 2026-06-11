# TerminalTalk
<img width="1900" height="1072" alt="image" src="https://github.com/user-attachments/assets/09b00eec-f20a-470c-a935-9fa4cfaf18ad" />


TerminalTalk is a realtime terminal chat app with a dedicated Ink TUI, Convex
sync, group chat, accepted-friend direct messages, local session controls, and
terminal-session-based message disappearance.

> Status: TerminalTalk is still early testing software. Use it carefully, review
> the code before running it in sensitive environments, and do not share private
> credentials or production data through test deployments.

TerminalTalk opens as an app-like command-line workspace, keeps local device
details local, and uses Convex for realtime accounts, sessions, groups, friends,
and messages.

```bash
npm i -g @abhi_zit/terminaltalk
terminaltalk
```

The npm package is scoped as `@abhi_zit/terminaltalk`. The product name is
`TerminalTalk`, and the CLI command is `terminaltalk`.

## Features

- Realtime terminal chat powered by Convex.
- Ink and React TUI with profile, groups, friends, chat history, composer, quick commands, and local system status.
- Group chat with generated join codes.
- Direct chats between accepted friends only.
- Friend requests, blocking, unblocking, and local private nicknames.
- Account settings for display name, username, and password changes.
- Theme picker with persisted local theme selection.
- Terminal-session-based message disappearance: message bodies are removed when a terminal session ends or expires.
- Vanished-message placeholders stay visible for 24 hours, then are cleaned up automatically.
- Local demo mode for UI development without a Convex deployment.
- Local-only system stats. RAM, disk, CPU, OS, GPU, and network status are shown in the UI but are not written to Convex.
- Password hashing with salted PBKDF2-HMAC-SHA256. Raw passwords are never stored.
- Local session persistence under the OS config directory.

## Install

```bash
npm i -g @abhi_zit/terminaltalk
terminaltalk
```

TerminalTalk requires Node.js 20 or newer.

## Local Development

```bash
npm install
npm run dev
```

Without a local Convex URL, TerminalTalk uses the public TerminalTalk Convex
deployment. Set demo mode when you want an in-memory local UI session instead.

PowerShell demo mode:

```powershell
$env:TERMINALTALK_DEMO_MODE="true"
npm run dev
```

macOS/Linux demo mode:

```bash
TERMINALTALK_DEMO_MODE=true npm run dev
```

## Convex Setup

Create a Convex project, then deploy or run the functions in `convex/`.

```bash
npx convex dev
```

Set the public deployment URL in `.env`:

```bash
TERMINALTALK_CONVEX_URL=https://your-project.convex.cloud
TERMINALTALK_DEMO_MODE=false
```

Do not commit `.env`, private deployment credentials, or secrets.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `TERMINALTALK_CONVEX_URL` | No | Override the public TerminalTalk Convex deployment used by the CLI client. |
| `TERMINALTALK_DEMO_MODE` | No | Set to `true` to use the in-memory demo gateway for local UI work. |

## Command Reference

TerminalTalk has two kinds of actions:

- Slash commands typed into the composer.
- Sidebar action menus opened with keyboard selection and Enter.

### Slash Commands

| Command | Purpose |
| --- | --- |
| `/theme` | Open the theme picker. Use arrow keys to preview, number keys `1-5` to choose, Enter to return, and Esc to close. |
| `/settings` | Open account settings for display name, username, current password, and new password. Enter advances fields and saves on the last field. Esc closes. |
| `/create-group <name>` | Create a new group and receive a join code. Group names may contain spaces. |
| `/join-group <code>` | Join an existing group with its join code. |
| `/add-friend <username>` | Send a friend request to another user. |
| `/help` | Show the currently available slash commands in the notice line. |
| `/logout` | Clear the local stored session and return to the auth screen. |

Text that does not start with `/` is sent as a message to the active chat.

### Sidebar Actions

Move focus into the sidebar, select a group or friend, and press Enter to open
its action menu.

Friend actions:

| Action | Purpose |
| --- | --- |
| `Open Chat` | Open a direct chat with an accepted friend. |
| `Set Nickname` | Save a private local nickname for that friend. Nicknames are not persisted to Convex. |
| `Accept Request` | Accept an incoming friend request. |
| `Deny Request` | Deny an incoming friend request. |
| `Cancel Request` | Cancel an outgoing friend request. |
| `Block` | Block a user and remove any stale accepted friendship. |
| `Unblock` | Remove a block. A fresh friend request is required before chatting again. |

Group actions:

| Action | Purpose |
| --- | --- |
| `Open Chat` | Open the selected group chat. |
| `Leave Group` | Leave the selected group. The built-in demo group cannot be left in demo mode. |

### Keyboard Controls

| Key | Purpose |
| --- | --- |
| `Enter` | Send a message, advance form fields, select a menu action, or save on the final settings field. |
| `Ctrl+N` | Insert a newline in the message composer. |
| `Ctrl+C` | Exit the app. |
| `Esc` | Close settings, theme picker, nickname editor, or action menus. |
| `PageUp` / `PageDown` | Scroll chat history. |
| `k` / `j` | Scroll chat history when the composer is empty. |
| Arrow keys | Move through menus and theme options. |
| Number keys `1-5` | Select a theme in the theme picker. |

Mouse-wheel scrolling is best effort and depends on the terminal forwarding
xterm mouse events.

## Message Disappearance Model

TerminalTalk ties messages to a terminal session.

1. A terminal session starts after sign-in.
2. The client sends heartbeats while the TUI is open.
3. When the terminal closes cleanly, that session ends.
4. If heartbeats stop, Convex expires the session.
5. Messages from the ended or expired terminal session are redacted by removing the message body.
6. Other users see `<sender>'s message vanished` for 24 hours after redaction.
7. After 24 hours, the placeholder is removed from query results and a Convex cron deletes the redacted record.

The original message body is not retained after redaction.

## Security And Privacy

- No account recovery exists in the first release.
- Forgotten passwords cannot be reset yet.
- Passwords are hashed before storage.
- Session tokens are stored locally, and only token hashes are stored in Convex.
- Group join codes are returned to the creator and stored as hashes in Convex.
- Convex authorizes group messages by group membership.
- Convex authorizes direct messages by accepted friendships.
- Blocking removes stale accepted relationships and blocks direct messages in both directions.
- Friend and group sidebars may load from local cache, but Convex still authorizes message access.
- Private nicknames are local device data only.
- Local system stats are display-only and are not persisted to Convex.

## Project Structure

```text
convex/                     Convex schema, auth, groups, friends, messages, crons
src/cli.tsx                 CLI entry point
src/ui/App.tsx              Main Ink TUI
src/ui/tuiLayout.ts         Pure layout, wrapping, scrolling, and composer helpers
src/services/chatGateway.ts Convex and demo chat gateways
src/services/sessionStore.ts Local session, directory cache, theme, and nickname storage
src/config/themes.ts        Terminal themes
tests/                      Vitest coverage for parser, gateway, layout, env, sessions, themes
```

## Development Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start TerminalTalk from TypeScript source. |
| `npm start` | Alias for starting the TypeScript CLI. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript with `--noEmit`. |
| `npx tsc --noEmit` | Typecheck without using the npm script. |
| `npm test` | Run the Vitest suite. |
| `npm run validate` | Run lint, typecheck, and tests. |
| `npm audit --audit-level=high` | Check for high-severity dependency vulnerabilities. |
| `npm run build` | Clean and build the package into `dist/`. |
| `npm run pack:dry` | Preview the npm package contents without publishing. |

## Validation

Run the full quality gate before publishing:

```bash
npm run lint
npx tsc --noEmit
npm test
npm audit --audit-level=high
npm run build
npm run pack:dry
```

## Release And NPM Update Commands

Use these commands when publishing a new npm package version.

Patch release:

```bash
npm version patch
npm run validate
npm audit --audit-level=high
npm run build
npm run pack:dry
npm publish --access public
git push origin main --follow-tags
```

Minor release:

```bash
npm version minor
npm run validate
npm audit --audit-level=high
npm run build
npm run pack:dry
npm publish --access public
git push origin main --follow-tags
```

Major release:

```bash
npm version major
npm run validate
npm audit --audit-level=high
npm run build
npm run pack:dry
npm publish --access public
git push origin main --follow-tags
```

If you already updated `package.json` manually, replace `npm version ...` with:

```bash
npm publish --access public
git push origin main --follow-tags
```

## Publishing Checklist

- Confirm `package.json` has the correct package name, version, description, license, bin path, files list, and npm access.
- Confirm npm login and package ownership with `npm whoami`.
- Confirm the GitHub repository remote is correct.
- Confirm Convex functions are deployed.
- Confirm `TERMINALTALK_CONVEX_URL` points to the intended production Convex deployment.
- Run the validation gate.
- Run `npm run pack:dry` and inspect the package contents.
- Publish with `npm publish --access public`.
- Push the version commit and tag to GitHub.
- Create a GitHub release from the version tag when the release is ready to announce.

## Contributing

Contributions are welcome. Please keep changes focused and include tests for
behavior changes.

Recommended local loop:

```bash
npm install
npm run validate
```

For UI changes, also run TerminalTalk in a real terminal and verify layout,
keyboard behavior, wrapping, and scroll behavior manually.

## Professional Open-Source Notes

Before a wider release, consider adding:

- `CONTRIBUTING.md` for contribution workflow and coding standards.
- `CODE_OF_CONDUCT.md` for community expectations.
- `SECURITY.md` for vulnerability reporting.
- GitHub issue templates for bugs and feature requests.
- GitHub Actions CI for lint, typecheck, test, audit, and build.
- Screenshots or a short terminal recording in the README.
- Changelog entries for each published npm version.

## License

MIT. See `LICENSE`.
