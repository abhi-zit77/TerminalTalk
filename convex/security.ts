import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

const hashIterations = 210_000;
const passwordKeyLength = 32;
const tokenByteLength = 32;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function createPasswordHash(password: string): string {
  const salt = randomHex(16);
  const digest = pbkdf2(sha256, utf8ToBytes(password), hexToBytes(salt), {
    c: hashIterations,
    dkLen: passwordKeyLength
  });

  return `pbkdf2-sha256$${hashIterations}$${salt}$${bytesToHex(digest)}`;
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, iterations, salt, digest] = encodedHash.split("$");

  if (algorithm !== "pbkdf2-sha256" || !iterations || !salt || !digest) {
    return false;
  }

  const computed = pbkdf2(sha256, utf8ToBytes(password), hexToBytes(salt), {
    c: Number(iterations),
    dkLen: passwordKeyLength
  });

  return constantTimeEqual(bytesToHex(computed), digest);
}

export function createSessionToken(): string {
  return randomHex(tokenByteLength);
}

export function hashToken(token: string): string {
  return bytesToHex(sha256(utf8ToBytes(token)));
}

export function createJoinCode(): string {
  return `TT-${randomHex(5).toUpperCase()}`;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
