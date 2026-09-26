import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const PREFIX = "ck_live_";

export function generateApiKeyPlain(): { plain: string; prefix: string } {
  const body = crypto.randomBytes(24).toString("base64url");
  const plain = `${PREFIX}${body}`;
  return { plain, prefix: plain.slice(0, 12) };
}

export async function hashApiKey(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function apiKeyMatches(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(PREFIX) && token.length > 20;
}
