/**
 * URLs de retorno ao site (Vercel) após OAuth — não confundir com a URL da API (Railway).
 * Defina PAID_OAUTH_FRONTEND_RETURN_URL (ex. https://www.dclickora.com) ou o primeiro valor de FRONTEND_URL.
 */
export function getPaidOAuthFrontendBase(): string {
  const raw =
    process.env.PAID_OAUTH_FRONTEND_RETURN_URL?.trim() ||
    process.env.FRONTEND_URL?.split(",")[0]?.trim() ||
    "http://localhost:8080";
  return raw.replace(/\/$/, "");
}

/** Base pública da API para callbacks OAuth (deve coincidir com o redirect URI registado no Google/Meta/TikTok). */
export function getPublicApiBase(): string {
  const b =
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.BACKEND_PUBLIC_URL?.trim() ||
    "";
  return b.replace(/\/$/, "");
}

export function googleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/google/callback";
  }
  return `${base}/api/paid/oauth/google/callback`;
}

export function metaOAuthRedirectUri(): string {
  const explicit = process.env.META_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/meta/callback";
  }
  return `${base}/api/paid/oauth/meta/callback`;
}

export function tiktokOAuthRedirectUri(): string {
  const explicit = process.env.TIKTOK_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/tiktok/callback";
  }
  return `${base}/api/paid/oauth/tiktok/callback`;
}
