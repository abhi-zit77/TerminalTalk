export interface SenderIdentity {
  username: string;
  displayName?: string | undefined;
  nickname?: string | undefined;
}

export function formatSenderLabel(identity: SenderIdentity): string {
  const stableUsername = `@${identity.username}`;
  const preferredName = identity.nickname ?? identity.displayName;

  if (!preferredName) {
    return stableUsername;
  }

  return `${preferredName} (${stableUsername})`;
}
