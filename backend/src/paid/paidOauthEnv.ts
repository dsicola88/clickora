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

/**
 * URL final do callback Paid OAuth: /api/paid/oauth/{plataforma}/callback
 * Se `PUBLIC_API_URL` / `API_PUBLIC_URL` já termina em `/api` (ex.: site na Vercel com proxy),
 * não repetir `/api` no path.
 */
function paidOauthCallbackUrl(base: string, platform: "google" | "meta" | "tiktok"): string {
  const b = base.replace(/\/$/, "");
  const tail = `paid/oauth/${platform}/callback`;
  if (/\/api$/i.test(b)) {
    return `${b}/${tail}`;
  }
  return `${b}/api/${tail}`;
}

export function googleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/google/callback";
  }
  return paidOauthCallbackUrl(base, "google");
}

export function metaOAuthRedirectUri(): string {
  const explicit = process.env.META_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/meta/callback";
  }
  return paidOauthCallbackUrl(base, "meta");
}

export function tiktokOAuthRedirectUri(): string {
  const explicit = process.env.TIKTOK_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const base = getPublicApiBase();
  if (!base) {
    return "http://localhost:3001/api/paid/oauth/tiktok/callback";
  }
  return paidOauthCallbackUrl(base, "tiktok");
}
