/**
 * OAuth2 "Sign in with Google" (OpenID) — separado do Google Ads / Marketing API.
 * Configure: GOOGLE_AUTH_CLIENT_ID + GOOGLE_AUTH_CLIENT_SECRET
 * (ou GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET para o mesmo cliente OAuth “Web” com redirect de login).
 */
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

function clientId(): string | undefined {
  return (
    process.env.GOOGLE_AUTH_CLIENT_ID?.trim() ??
    process.env.GOOGLE_CLIENT_ID?.trim()
  );
}

function clientSecret(): string | undefined {
  return (
    process.env.GOOGLE_AUTH_CLIENT_SECRET?.trim() ??
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function isGoogleUserAuthConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function buildGoogleUserSignInUrl(redirectUri: string, state: string): string {
  const id = clientId();
  if (!id) throw new Error("GOOGLE_AUTH_CLIENT_ID (ou GOOGLE_CLIENT_ID) em falta.");
  const u = new URL(OAUTH_AUTH);
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export async function exchangeGoogleUserAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    throw new Error("Credenciais OAuth (login Google) em falta.");
  }
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const j = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !j.access_token) {
    throw new Error(
      j.error_description?.trim() ||
        j.error ||
        `Falha na troca do código de login Google (${res.status}).`,
    );
  }
  return { access_token: j.access_token };
}

export type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
  picture?: string;
};

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = (await res.json()) as GoogleUserInfo & { error?: string };
  if (!res.ok || !j.sub || !j.email) {
    throw new Error(j.error || "Não foi possível obter o perfil Google.");
  }
  return {
    sub: j.sub,
    email: j.email.trim().toLowerCase(),
    name: j.name,
    email_verified: j.email_verified,
    picture: j.picture,
  };
}
