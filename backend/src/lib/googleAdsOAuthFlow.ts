import crypto from "node:crypto";
import {
  getGoogleAdsApiClientConfigFromEnv,
} from "../modules/googleAds/googleAds.service";

type StatePayload = { u: string; exp: number };

export function signGoogleAdsOAuthState(userId: string): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET em falta");
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const p: StatePayload = { u: userId, exp };
  const pStr = JSON.stringify(p);
  const sig = crypto.createHmac("sha256", secret).update(pStr).digest("base64url");
  return Buffer.from(JSON.stringify({ p: pStr, s: sig }), "utf8").toString("base64url");
}

export function verifyGoogleAdsOAuthState(state: string): { userId: string } | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const { p: pStr, s } = JSON.parse(raw) as { p: string; s: string };
    const sig = crypto.createHmac("sha256", secret).update(pStr).digest("base64url");
    if (s !== sig) return null;
    const p = JSON.parse(pStr) as StatePayload;
    if (typeof p.u !== "string" || typeof p.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) > p.exp) return null;
    return { userId: p.u };
  } catch {
    return null;
  }
}

/**
 * URI exacta registada na Google Cloud (tipo Web). Por defeito: API_PUBLIC_URL + /integrations/google-ads/oauth/callback
 */
export function getGoogleAdsOAuthRedirectUri(): string {
  const o = process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI?.trim();
  if (o) return o.replace(/\/$/, "");
  const base = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Defina API_PUBLIC_URL ou GOOGLE_ADS_OAUTH_REDIRECT_URI para o callback OAuth Google Ads.",
    );
  }
  return `${base}/integrations/google-ads/oauth/callback`;
}

export function getPrimaryFrontendOrigin(): string {
  const raw = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:8080";
}

export function buildGoogleAdsAuthorizeUrl(state: string): { authorizeUrl: string } {
  const cfg = getGoogleAdsApiClientConfigFromEnv();
  if (!cfg) throw new Error("Google Ads API client não configurado no servidor");
  const redirectUri = getGoogleAdsOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return { authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

export async function exchangeGoogleAdsAuthorizationCode(
  code: string,
): Promise<{ refresh_token?: string; error?: string }> {
  const cfg = getGoogleAdsApiClientConfigFromEnv();
  if (!cfg) return { error: "server_config" };
  let redirectUri: string;
  try {
    redirectUri = getGoogleAdsOAuthRedirectUri();
  } catch {
    return { error: "redirect_uri_config" };
  }
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = (await res.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    return { error: json.error_description || json.error || `token_${res.status}` };
  }
  if (!json.refresh_token) {
    return { error: "no_refresh_token" };
  }
  return { refresh_token: json.refresh_token };
}
