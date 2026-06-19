import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function createPasswordHash(password: string, salt = randomBytes(16).toString("base64url")): Promise<string> {
  return (async () => {
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return `scrypt$${salt}$${derivedKey.toString("base64url")}`;
  })();
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, encodedKey] = storedHash.split("$");

  if (scheme !== "scrypt" || !salt || !encodedKey) {
    return false;
  }

  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(encodedKey, "base64url");

  if (storedKey.length !== candidate.length) {
    return false;
  }

  return timingSafeEqual(storedKey, candidate);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

