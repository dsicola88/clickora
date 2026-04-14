import type { CustomDomainDto } from "@/types/api";

/**
 * Origem usada em links públicos das presells (anúncios, Google).
 * Com domínio verificado, usa `https://hostname`; caso contrário env ou o origin atual.
 */
export function getPublicPresellOrigin(verifiedHostname?: string | null): string {
  const h = verifiedHostname?.trim();
  if (h) return `https://${h}`;
  const env = import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://www.dclickora.com";
}

/**
 * Resolve o URL base para uma presell: override por domínio, senão domínio padrão da conta, senão primeiro verificado.
 */
export function getPublicPresellOriginForPresell(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
): string {
  const list = domains ?? [];
  const verified = list.filter((d) => d.status === "verified");
  if (presellCustomDomainId) {
    const pick = verified.find((d) => d.id === presellCustomDomainId);
    if (pick) return `https://${pick.hostname}`;
  }
  const def = verified.find((d) => d.is_default);
  if (def) return `https://${def.hostname}`;
  if (verified[0]) return `https://${verified[0].hostname}`;
  return getPublicPresellOrigin(null);
}

/** Parâmetro de rota `/p/:id` é UUID da presell no Clickora (não o link do produto). */
export function isPresellUuidParam(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * No domínio personalizado verificado, o URL público pode usar o slug (endereço) em vez do UUID.
 * Em dclickora.com, preview Vercel ou localhost usa-se sempre o UUID.
 */
export function publicPresellPathUsesSlugForOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return false;
    if (h.endsWith(".vercel.app")) return false;
    if (h === "dclickora.com" || h === "www.dclickora.com") return false;
    return true;
  } catch {
    return false;
  }
}

export function getPublicPresellPath(page: { id: string; slug: string }, origin: string): string {
  if (publicPresellPathUsesSlugForOrigin(origin)) {
    return `/p/${encodeURIComponent(page.slug)}`;
  }
  return `/p/${page.id}`;
}

/** URL completo para anúncios: domínio + `/p/` + slug (domínio próprio) ou + UUID (dclickora). */
export function getPublicPresellFullUrl(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
  page: { id: string; slug: string },
): string {
  const origin = getPublicPresellOriginForPresell(domains, presellCustomDomainId).replace(/\/+$/, "");
  return `${origin}${getPublicPresellPath(page, origin)}`;
}

/**
 * Pré-visualização no painel (ícone «olho»): abre no **mesmo** site onde estás (ex.: dclickora.com),
 * não no domínio personalizado — evita mudar de domínio só para pré-visualizar.
 * Sempre `/p/<uuid>` (GET público por ID funciona em qualquer origem).
 */
export function getPublicPresellViewerUrl(page: { id: string }): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/+$/, "")}/p/${page.id}`;
  }
  const env = import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim();
  if (env) return `${env.replace(/\/+$/, "")}/p/${page.id}`;
  return `https://www.dclickora.com/p/${page.id}`;
}
