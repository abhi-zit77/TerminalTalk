export function isInvalidStoredSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Session is invalid or expired.") ||
    error.message.includes("Session user does not exist.")
  );
}
