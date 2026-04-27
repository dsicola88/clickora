import { SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "./constants";

export { SESSION_MAX_AGE_SEC };

const GOOGLE_OAUTH_STATE = "g_auth_st";

function sessionCookieBase(name: string, value: string, maxAge: number, sameSite: "Lax" | "Strict" = "Lax"): string {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildSessionValueCookie(
  token: string,
  maxAge: number = SESSION_MAX_AGE_SEC,
): string {
  return sessionCookieBase(SESSION_COOKIE, token, maxAge, "Lax");
}

export function buildClearSessionCookie(): string {
  return sessionCookieBase(SESSION_COOKIE, "", 0, "Lax");
}

/** Cookie de curto prazo (CSRF state OAuth Google Sign-In). */
export function buildGoogleAuthStateCookie(state: string, maxAgeSec: number = 600): string {
  return sessionCookieBase(GOOGLE_OAUTH_STATE, state, maxAgeSec, "Lax");
}

export function buildClearGoogleAuthStateCookie(): string {
  return sessionCookieBase(GOOGLE_OAUTH_STATE, "", 0, "Lax");
}

export { GOOGLE_OAUTH_STATE };
