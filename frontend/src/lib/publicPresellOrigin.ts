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

/** Lander / links públicos — exclui purpose=tracking. */
export function isHostingCapableDomain(d: {
  purpose?: string | null;
  status?: string;
}): boolean {
  return d.purpose !== "tracking";
}

/**
 * Pronto para Final URL / ads:
 * - DNS verificado sem Vercel (SSL do próprio host), ou
 * - Vercel com `https_ready` / `ssl_state === https_ready`.
 * Domínio Vercel só «DNS verificado» NÃO entra — evita https:// partido em anúncios.
 */
export function isCustomDomainAdReady(d: CustomDomainDto): boolean {
  if (d.status !== "verified" || !isHostingCapableDomain(d)) return false;
  if (d.https_ready === true || d.ssl_state === "https_ready") return true;
  if (!d.vercel_domain_registered) return true;
  return false;
}

export function listVerifiedHostingDomains(
  domains: CustomDomainDto[] | null | undefined,
): CustomDomainDto[] {
  return (domains ?? []).filter((d) => d.status === "verified" && isHostingCapableDomain(d));
}

/** Hosting verificado e seguro para colar em anúncios. */
export function listAdReadyHostingDomains(
  domains: CustomDomainDto[] | null | undefined,
): CustomDomainDto[] {
  return (domains ?? []).filter(isCustomDomainAdReady);
}

/**
 * Presell aponta a um domínio Vercel ainda sem HTTPS pronto.
 * Usado na checklist de publicação (aviso — Final URL cai na app).
 */
export function isCustomDomainHttpsPendingForPresell(
  domains: CustomDomainDto[] | null | undefined,
  customDomainId: string | null | undefined,
): boolean {
  const id = customDomainId?.trim();
  if (!id) return false;
  const d = (domains ?? []).find((x) => x.id === id);
  if (!d || d.status !== "verified" || d.purpose === "tracking") return false;
  if (!d.vercel_domain_registered) return false;
  return !isCustomDomainAdReady(d);
}

/**
 * ID do domínio verificado quando a presell não tem `custom_domain_id` explícito.
 * Alinhado com o backend e a migração: `is_default` primeiro, depois o mais antigo (`created_at`).
 * Ignora domínios só de tracking.
 */
export function resolveDefaultCustomDomainIdForAccount(
  domains: CustomDomainDto[] | null | undefined,
): string | null {
  const ready = listAdReadyHostingDomains(domains);
  const pool = ready.length > 0 ? ready : listVerifiedHostingDomains(domains);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sorted[0]?.id ?? null;
}

/**
 * Resolve o URL base para uma presell: override por domínio ad-ready, senão padrão, senão origem da app.
 * Domínios Vercel só com DNS (sem HTTPS pronto) são ignorados — evita Final URL partida.
 */
export function getPublicPresellOriginForPresell(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
): string {
  const list = domains ?? [];
  const adReady = listAdReadyHostingDomains(list);
  if (presellCustomDomainId) {
    const pick = adReady.find((d) => d.id === presellCustomDomainId);
    if (pick) return `https://${pick.hostname}`;
    /** Domínio tracking / SSL ainda a provisionar: não usar como lander. */
  }
  const defaultId = resolveDefaultCustomDomainIdForAccount(domains);
  if (defaultId) {
    const pick = adReady.find((d) => d.id === defaultId);
    if (pick) return `https://${pick.hostname}`;
  }
  if (adReady[0]) return `https://${adReady[0].hostname}`;
  return getPublicPresellOrigin(null);
}

/** Parâmetro de rota `/p/:id` — UUID da presell ou slug (API suporta ambos no domínio verificado). */
export function isPresellUuidParam(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * URL completo para anúncios e cópia: **domínio escolhido** + **`/p/<uuid>`**.
 * Usamos sempre o UUID no path (fiável com a API); o «endereço» (slug) no formulário é só nome interno/URL curto opcional.
 */
export function getPublicPresellFullUrl(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
  page: { id: string },
): string {
  const origin = getPublicPresellOriginForPresell(domains, presellCustomDomainId).replace(/\/+$/, "");
  return `${origin}/p/${page.id}`;
}
