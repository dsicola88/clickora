import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { decryptSecretField, encryptSecretField } from "./fieldEncryption";
import { signToken, verifyToken, type JwtPayload } from "./jwt";

authenticator.options = { window: 1 };

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function mfaOtpauthUrl(args: { email: string; secret: string; issuer?: string }): string {
  const issuer = args.issuer || process.env.MFA_ISSUER || "dclickora";
  return authenticator.keyuri(args.email, issuer, args.secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}

export function encryptMfaSecret(secret: string): string {
  return encryptSecretField(secret) || secret;
}

export function decryptMfaSecret(stored: string | null | undefined): string | null {
  return decryptSecretField(stored);
}

/** 8 códigos de 10 chars; devolve plain + hash JSON para BD. */
export async function generateBackupCodes(count = 8): Promise<{ plain: string[]; hashedJson: string }> {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString("hex");
    plain.push(code);
    hashed.push(await bcrypt.hash(code, 10));
  }
  return { plain, hashedJson: JSON.stringify(hashed) };
}

export async function consumeBackupCode(
  storedJson: string | null | undefined,
  code: string,
): Promise<{ ok: true; nextJson: string } | { ok: false }> {
  if (!storedJson) return { ok: false };
  let hashes: string[];
  try {
    hashes = JSON.parse(storedJson) as string[];
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(hashes)) return { ok: false };
  const trimmed = code.trim().toLowerCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(trimmed, hashes[i]!)) {
      const next = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      return { ok: true, nextJson: JSON.stringify(next) };
    }
  }
  return { ok: false };
}

export type MfaPendingPayload = JwtPayload;

export function signMfaPendingToken(payload: JwtPayload): string {
  return signToken({ ...payload, purpose: "mfa" }, "10m");
}

export function verifyMfaPendingToken(token: string): JwtPayload {
  const raw = verifyToken(token);
  if (raw.purpose !== "mfa") {
    throw new Error("not_mfa_token");
  }
  return raw;
}
