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
