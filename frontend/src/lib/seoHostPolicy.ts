/**
 * Política de indexação por host: só o site de marketing (dclickora) deve rankear.
 * Domínios de assinantes, tracking e landers `/p/*` ficam fora dos buscadores por defeito.
 */

const MAIN_MARKETING_HOSTS = new Set(["dclickora.com", "www.dclickora.com"]);

export function isMainMarketingHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0];
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return MAIN_MARKETING_HOSTS.has(h);
}

/** Caminhos públicos de marketing que podem ser indexados no host principal. */
export const MARKETING_INDEXABLE_PATHS = new Set([
  "/",
  "/planos",
  "/plans",
  "/presell-para-afiliados",
  "/rastreamento-afiliados",
  "/super-presell",
  "/guia-vendas-afiliados",
  "/auth",
  "/privacidade",
  "/termos",
  "/aviso-medico",
]);

export function isMarketingIndexablePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return MARKETING_INDEXABLE_PATHS.has(p);
}

export function isPublicPresellPath(pathname: string): boolean {
  return /^\/p\/[^/]+/i.test(pathname);
}

/**
 * Deve este URL ficar fora dos buscadores?
 * — Qualquer host que não seja o site principal
 * — Qualquer lander `/p/...` (mesmo em www.dclickora.com)
 */
export function shouldNoindexCurrentLocation(
  hostname: string,
  pathname: string,
): boolean {
  if (!isMainMarketingHostname(hostname)) return true;
  if (isPublicPresellPath(pathname)) return true;
  return false;
}

export const ROBOTS_NOINDEX = "noindex, nofollow";
export const ROBOTS_INDEX_RICH =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

/** Keywords de alta intenção para afiliados / media buyers (PT + EN). */
export const MARKETING_SEO_KEYWORDS = [
  "presell",
  "super presell",
  "página presell",
  "presell page",
  "tracking",
  "rastreamento",
  "rastreamento de conversões",
  "rastreamento afiliados",
  "click tracker",
  "rastreador de cliques",
  "ferramenta para afiliados",
  "links rastreados",
  "UTM tracking",
  "postback",
  "marketing de afiliados",
  "media buyer",
  "conversões Google Ads",
].join(", ");
