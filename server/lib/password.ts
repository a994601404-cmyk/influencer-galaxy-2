import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const KEY_LEN = 64;

// scrypt password hashing (Node built-in, no extra deps).
// Stored as separate hex salt + hash columns on the users table.
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const candidate = scryptSync(password, salt, KEY_LEN);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// Constant-time string comparison for hex digests.
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
