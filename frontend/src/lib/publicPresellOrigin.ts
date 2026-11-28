import type { CustomDomainDto, DomainBindingDto } from "@/types/api";

/** Mensagem quando não existe onde publicar (sem domínio próprio nem domínio técnico isolado). */
export const PUBLIC_DOMAIN_REQUIRED_MESSAGE =
  "Conecte um domínio próprio verificado para publicar esta página. O domínio principal da plataforma não serve presells públicas.";

const PLATFORM_MAIN_HOSTNAMES_EXACT = new Set(["dclickora.com", "www.dclickora.com", "clickora.com", "www.clickora.com"]);

/** Domínio principal da plataforma (não serve presells públicas). */
export function isPlatformMainHostname(hostname: string | null | undefined): boolean {
  return PLATFORM_MAIN_HOSTNAMES_EXACT.has(String(hostname || "").trim().toLowerCase().split(":")[0] || "");
}

const PLATFORM_TRACK_URL_RE = /https?:\/\/(?:www\.)?d?clickora\.com\/api\/track\//gi;

/**
 * CTAs gravados com o host da plataforma (`https://www.dclickora.com/api/track/r/…`) passam a usar a
 * base de tracking do domínio onde a presell é servida — o domínio principal não faz saltos para ofertas.
 * `apiBase` tem de ser absoluto (ex. `https://loja.com/api`); caso contrário não altera nada.
 */
export function rehomePlatformTrackUrls<T>(value: T, apiBase: string): T {
  const base = apiBase.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return value;
  try {
    if (isPlatformMainHostname(new URL(base).hostname)) return value;
  } catch {
    return value;
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(PLATFORM_TRACK_URL_RE, `${base}/track/`);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

/** Preview privado do dono dentro do painel (exige sessão; nunca é um URL público). */
export function ownerPresellPreviewPath(presellId: string): string {
  return `/presells/preview/${encodeURIComponent(presellId)}`;
}

/**
 * Origem do SITE (marketing/SEO). NÃO é origem de presells públicas: o domínio principal
 * não hospeda presells — para links de presell usa-se `getPublicPresellOriginForPresell`.
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
 * Domínio utilizável no roteamento público: ativo (`is_active !== false`) e não marcado `down`.
 */
export function isDomainActiveAndHealthy(d: Pick<CustomDomainDto, "is_active" | "health_status">): boolean {
  if (d.is_active === false) return false;
  if (d.health_status === "down") return false;
  return true;
}

/**
 * Pronto para Final URL / ads:
 * - DNS verificado sem Vercel (SSL do próprio host), ou
 * - Vercel com `https_ready` / `ssl_state === https_ready`.
 * Domínio Vercel só «DNS verificado», desativado ou `down` NÃO entra — evita https:// partido em anúncios.
 */
export function isCustomDomainAdReady(d: CustomDomainDto): boolean {
  if (d.status !== "verified" || !isHostingCapableDomain(d) || !isDomainActiveAndHealthy(d)) return false;
  if (d.https_ready === true || d.ssl_state === "https_ready") return true;
  if (!d.vercel_domain_registered) return true;
  return false;
}

export function listVerifiedHostingDomains(
  domains: CustomDomainDto[] | null | undefined,
): CustomDomainDto[] {
  return (domains ?? []).filter(
    (d) => d.status === "verified" && isHostingCapableDomain(d) && isDomainActiveAndHealthy(d),
  );
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

const ROLE_ORDER: Record<string, number> = {
  primary: 0,
  backup: 1,
  standby: 2,
};

/**
 * ID do domínio verificado quando a presell não tem `custom_domain_id` explícito.
 * Alinhado com o backend e a migração: `is_default` primeiro, depois `routing_role` / `routing_priority`, depois o mais antigo (`created_at`).
 * Ignora domínios só de tracking, desativados ou `down`.
 */
export function resolveDefaultCustomDomainIdForAccount(
  domains: CustomDomainDto[] | null | undefined,
): string | null {
  const ready = listAdReadyHostingDomains(domains);
  const pool = ready.length > 0 ? ready : listVerifiedHostingDomains(domains);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    const roleA = ROLE_ORDER[a.routing_role ?? "standby"] ?? 9;
    const roleB = ROLE_ORDER[b.routing_role ?? "standby"] ?? 9;
    if (roleA !== roleB) return roleA - roleB;
    const prioA = a.routing_priority ?? 100;
    const prioB = b.routing_priority ?? 100;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sorted[0]?.id ?? null;
}

/**
 * Domínio técnico isolado, dedicado só a páginas publicadas (`VITE_PUBLIC_PRESELL_HOST`).
 * Nunca aceita o domínio principal da plataforma.
 */
export function getPublicPresellTechnicalOrigin(): string | null {
  const raw = import.meta.env.VITE_PUBLIC_PRESELL_HOST?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const h = u.hostname.toLowerCase();
    if (!h.includes(".")) return null;
    if (PLATFORM_MAIN_HOSTNAMES.has(h)) return null;
    return `https://${h}`;
  } catch {
    return null;
  }
}

const PLATFORM_MAIN_HOSTNAMES = new Set([
  "dclickora.com",
  "www.dclickora.com",
  "clickora.com",
  "www.clickora.com",
]);

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
 * Resolve o URL base público de uma presell, por ordem:
 * 1. domínio verificado e pronto para Ads (o da presell, o padrão, ou o primeiro);
 * 2. dev local (localhost) — só para desenvolvimento;
 * 3. domínio técnico isolado (`VITE_PUBLIC_PRESELL_HOST`);
 * 4. domínio verificado ainda a provisionar SSL (melhor que nada; a checklist avisa);
 * 5. `""` — sem onde publicar. NUNCA devolve o domínio principal da plataforma.
 */
export function getPublicPresellOriginForPresell(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
  domainBindings?: DomainBindingDto[] | null,
): string {
  const list = domains ?? [];
  const adReady = listAdReadyHostingDomains(list);

  // 1) Bindings explícitos da presell: respeita primary -> backup -> standby e prioridade.
  const activeBindings = [...(domainBindings ?? [])]
    .filter((b) => b.is_active !== false)
    .sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
      if (roleDiff !== 0) return roleDiff;
      return (a.priority ?? 100) - (b.priority ?? 100);
    });
  for (const b of activeBindings) {
    const match = adReady.find((d) => d.id === b.custom_domain_id);
    if (match) return `https://${match.hostname}`;
  }

  // 2) Override legado da presell (`custom_domain_id`).
  if (presellCustomDomainId) {
    const pick = adReady.find((d) => d.id === presellCustomDomainId);
    if (pick) return `https://${pick.hostname}`;
    /** Domínio tracking / desativado / down / SSL a provisionar: tenta contingência. */
  }
  const defaultId = resolveDefaultCustomDomainIdForAccount(domains);
  if (defaultId) {
    const pick = adReady.find((d) => d.id === defaultId);
    if (pick) return `https://${pick.hostname}`;
  }
  if (adReady[0]) return `https://${adReady[0].hostname}`;

  const verified = listVerifiedHostingDomains(list);
  const pending = (): string => {
    for (const b of activeBindings) {
      const match = verified.find((d) => d.id === b.custom_domain_id);
      if (match) return `https://${match.hostname}`;
    }
    if (presellCustomDomainId) {
      const p = verified.find((d) => d.id === presellCustomDomainId);
      if (p) return `https://${p.hostname}`;
    }
    return verified[0] ? `https://${verified[0].hostname}` : "";
  };

  const siteOrigin = getPublicPresellOrigin(null);
  if (isLocalDevOrigin(siteOrigin)) {
    // Dev local + domínio verificado (SSL pending): preferir hostname público nos braços do rotador.
    return pending() || siteOrigin;
  }

  return getPublicPresellTechnicalOrigin() ?? pending();
}

/** Há onde publicar (domínio próprio, técnico ou dev)? */
export function hasPublicPresellOrigin(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId?: string | null,
  domainBindings?: DomainBindingDto[] | null,
): boolean {
  return getPublicPresellOriginForPresell(domains, presellCustomDomainId, domainBindings).length > 0;
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

const MAIN_PLATFORM_HOSTS = new Set([
  "dclickora.com",
  "www.dclickora.com",
  "clickora.com",
  "www.clickora.com",
]);

/**
 * Origem dclickora / preview / dev — slug no path da SPA não é suportado (API exige UUID).
 */
export function isMainPlatformPresellOrigin(origin: string): boolean {
  if (isLocalDevOrigin(origin)) return true;
  try {
    const h = new URL(origin.includes("://") ? origin : `https://${origin}`).hostname.toLowerCase();
    if (MAIN_PLATFORM_HOSTS.has(h)) return true;
    if (h.endsWith(".dclickora.com") || h.endsWith(".vercel.app")) return true;
    return false;
  } catch {
    return true;
  }
}

function isTechnicalPresellOrigin(origin: string): boolean {
  const technical = getPublicPresellTechnicalOrigin();
  if (!technical) return false;
  try {
    const h = new URL(origin.includes("://") ? origin : `https://${origin}`).hostname.toLowerCase();
    return h === new URL(technical).hostname;
  } catch {
    return false;
  }
}

/**
 * Segmento do path público: no domínio verificado com slug → `/{slug}` (estilo SuperPresell);
 * senão UUID em dclickora / domínio técnico / lite `/l/` quando elegível; fallback `/p/<uuid>`.
 * O domínio técnico não tem dono verificado — a API de slug devolveria 404.
 */
export function resolvePublicPresellPath(
  page: { id: string; slug?: string | null; type?: string | null },
  origin: string,
): string {
  const slug = (page.slug ?? "").trim();
  const onCustomLander = !isMainPlatformPresellOrigin(origin) && !isTechnicalPresellOrigin(origin);
  const canUseSlug = onCustomLander && slug.length > 0 && !isPresellUuidParam(slug);

  if (canUseSlug) {
    return `/${encodeURIComponent(slug)}`;
  }

  const lite = isPresellLitePathEligible(page.type);
  if (lite) {
    return `/l/${page.id}`;
  }
  return `/p/${page.id}`;
}

/**
 * URL completo para anúncios e cópia: domínio escolhido + `/{slug}` no custom;
 * senão `/l/<uuid>` (LCP) ou `/p/<uuid>` no domínio técnico isolado.
 * Devolve `""` quando não há onde publicar (ver `PUBLIC_DOMAIN_REQUIRED_MESSAGE`).
 */
export function getPublicPresellFullUrl(
  domains: CustomDomainDto[] | null | undefined,
  presellCustomDomainId: string | null | undefined,
  page: {
    id: string;
    slug?: string | null;
    type?: string | null;
    domain_bindings?: DomainBindingDto[] | null;
  },
): string {
  const origin = getPublicPresellOriginForPresell(
    domains,
    presellCustomDomainId,
    page.domain_bindings,
  ).replace(/\/+$/, "");
  if (!origin) return "";
  const path = resolvePublicPresellPath(page, origin);
  return `${origin}${path}`;
}
