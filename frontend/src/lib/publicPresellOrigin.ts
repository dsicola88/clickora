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
 * ID do domínio verificado quando a presell não tem `custom_domain_id` explícito.
 * Alinhado com o backend e a migração: `is_default` primeiro, depois o mais antigo (`created_at`).
 */
export function resolveDefaultCustomDomainIdForAccount(
  domains: CustomDomainDto[] | null | undefined,
): string | null {
  const verified = (domains ?? []).filter((d) => d.status === "verified");
  if (verified.length === 0) return null;
  const sorted = [...verified].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sorted[0]?.id ?? null;
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
  const defaultId = resolveDefaultCustomDomainIdForAccount(domains);
  if (defaultId) {
    const pick = verified.find((d) => d.id === defaultId);
    if (pick) return `https://${pick.hostname}`;
  }
  if (verified[0]) return `https://${verified[0].hostname}`;
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
