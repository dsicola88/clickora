/**
 * Política CORS da API.
 *
 * - App autenticada (login, dashboard): origens do site + domínios personalizados verificados + env.
 * - Tracking público (`/api/track/*`): qualquer origem http(s) — o embed/pixel corre em landers
 *   e páginas de oferta fora do allowlist (ex.: tryvisivra.com). Sem isto o browser reporta
 *   "CORS Missing Allow Origin" e pageviews/cliques via POST não chegam.
 */

export function isPublicTrackingPath(path: string): boolean {
  const p = (path || "").split("?")[0] || "";
  return p === "/api/track" || p.startsWith("/api/track/");
}

/** Origem de browser em máquina local. */
export function isLocalMachineOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.trim());
    const h = u.hostname.toLowerCase();
    if (h !== "localhost" && h !== "127.0.0.1") return false;
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isDclickoraSiteOrigin(origin: string): boolean {
  return /^https:\/\/(www\.)?dclickora\.com$/i.test(origin.trim());
}

/** Qualquer origem web (não `null`, não file://) — só para rotas de tracking público. */
export function isWebPageOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type CorsAllowContext = {
  path: string;
  /** Domínio personalizado verificado (cache em memória). */
  isVerifiedCustomDomainOrigin: (origin: string) => boolean;
  /** FRONTEND_URL + CORS_ALLOWED_ORIGINS + defaults. */
  envAllowedOrigins: string[];
};

/**
 * Sem `Origin` (curl, S2S, same-origin sem header) → permitir.
 * Em `/api/track/*` → permitir qualquer origem http(s).
 * Caso contrário → allowlist estrita (credenciais / cookies da app).
 */
export function isAllowedOrigin(origin: string | undefined, ctx: CorsAllowContext): boolean {
  if (!origin) return true;
  if (isPublicTrackingPath(ctx.path) && isWebPageOrigin(origin)) return true;
  if (isDclickoraSiteOrigin(origin)) return true;
  if (ctx.isVerifiedCustomDomainOrigin(origin)) return true;
  if (isLocalMachineOrigin(origin)) return true;
  if (ctx.envAllowedOrigins.length > 0) return ctx.envAllowedOrigins.includes(origin);
  return ["http://localhost:8080", "http://localhost:5173"].includes(origin);
}

/** Tracking público não usa cookies — evita `Allow-Origin: *` + credentials. */
export function corsCredentialsForPath(path: string): boolean {
  return !isPublicTrackingPath(path);
}
