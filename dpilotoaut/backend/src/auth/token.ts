import { SignJWT, jwtVerify } from "jose";

import { SESSION_MAX_AGE_SEC } from "./constants";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (min 16 characters).");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  email: string;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!sub) throw new Error("Invalid token: missing sub");
  return { sub, email };
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}
