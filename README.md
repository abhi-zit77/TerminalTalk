# TerminalTalk

Open-source realtime terminal chat built with TypeScript, Ink, and Convex.

TerminalTalk installs as a global npm CLI:

```bash
npm i -g terminaltalk
terminaltalk
```

The package name is lowercase (`terminaltalk`) because npm requires lowercase
package names. The UI brand is `TerminalTalk`.

## Status

This is an initial open-source build, not a v1 release. It includes:

- Ink-powered terminal UI with profile, groups, messages, local system status, and quick commands.
- Convex schema and functions for users, sessions, friends, groups, messages, and nicknames.
- Local demo mode when no Convex deployment URL is configured.
- Local-only device stats. RAM, disk, CPU, OS, and network status are displayed in the UI but are never written to Convex.
- Password hashing with salted PBKDF2-HMAC-SHA256. Raw passwords are never stored.
- Local session storage under the OS config directory. The local config stores the session token, not the password.

## Local Development

```bash
npm install
npm run dev
```

Without a Convex URL, TerminalTalk starts in demo mode.

To connect a Convex deployment:

```bash
cp .env.example .env
# Set TERMINALTALK_CONVEX_URL=https://your-project.convex.cloud
npm run dev
```

## Convex Setup

Create a Convex project, then deploy the functions in `convex/`.

```bash
npx convex dev
```

Set the public deployment URL in `.env`:

```bash
TERMINALTALK_CONVEX_URL=https://your-project.convex.cloud
```

Do not commit `.env` or private deployment secrets.

## Commands

```text
/settings
/create-group <name>
/join-group <code>
/add-friend <username>
/nick <username> <nickname>
/help
/logout
```

Messages typed without a slash are sent to the active group.

## Security Notes

- No account recovery exists in the first release.
- Forgotten passwords cannot be reset yet.
- Passwords are hashed before storage.
- Session tokens are stored locally and only token hashes are stored in Convex.
- Group join codes are returned to the creator and stored as hashes in Convex.
- Device/system stats are local display data only.

## Validation

Run the quality gate before publishing:

```bash
npm run lint
npx tsc --noEmit
npm test
npm audit --audit-level=high
npm pack --dry-run
```

## Publishing Checklist

- Create or confirm the GitHub repository named `terminaltalk`.
- Confirm npm ownership and publish rights for `terminaltalk`.
- Create the Convex deployment and set `TERMINALTALK_CONVEX_URL`.
- Confirm the license. This scaffold uses MIT.
- Add final screenshots or branding assets before announcing the repo.
- Decide whether account recovery should be email recovery or recovery codes after the first release.

## License

MIT
