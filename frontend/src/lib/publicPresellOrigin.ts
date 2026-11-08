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

function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.includes("://") ? origin : `https://${origin}`);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".local");
  } catch {
    return false;
  }
}

/**
 * Resolve o URL base para uma presell: override por domínio ad-ready, senão padrão, senão origem da app.
 * Domínios Vercel só com DNS (sem HTTPS pronto) são ignorados para ads — mas NUNCA gravamos
 * localhost em rotadores/URL pública quando existe hostname verificado (mesmo SSL a provisionar).
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

  const fallback = getPublicPresellOrigin(null);
  if (!isLocalDevOrigin(fallback)) return fallback;

  // Dev local + domínio verificado (SSL pending): preferir hostname público nos braços do rotador.
  const verified = listVerifiedHostingDomains(list);
  if (presellCustomDomainId) {
    const pending = verified.find((d) => d.id === presellCustomDomainId);
    if (pending) return `https://${pending.hostname}`;
  }
  if (verified[0]) return `https://${verified[0].hostname}`;
  return fallback;
}

/** Parâmetro de rota `/p/:id` — UUID da presell ou slug (API suporta ambos no domínio verificado). */
export function isPresellUuidParam(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * Tipos com gate / builder — ficam na SPA `/p/`.
 * Restantes publicados podem usar HTML lite `/l/` (LCP).
 */
const LITE_BLOCKED_TYPES = new Set([
  "cookies",
  "idade",
  "sexo",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "pais",
  "captcha",
  "grupo_homem",
  "grupo_mulher",
  "builder",
  "desconto",
  "modelos",
  "vsl",
  "vsl_tsl",
  "fantasma",
]);

export function isPresellLitePathEligible(type: string | null | undefined): boolean {
  const t = (type || "").trim().toLowerCase();
  if (!t) return false;
  return !LITE_BLOCKED_TYPES.has(t);
}

/**
 * URL completo para anúncios e cópia: domínio escolhido + `/l/<uuid>` (LCP)
 * quando elegível; senão `/p/<uuid>` (SPA / gates).
 */
export function getPublicPresellFullUrl(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
  page: { id: string; type?: string | null },
): string {
  const origin = getPublicPresellOriginForPresell(domains, presellCustomDomainId).replace(/\/+$/, "");
  const path = isPresellLitePathEligible(page.type) ? `/l/${page.id}` : `/p/${page.id}`;
  return `${origin}${path}`;
}
