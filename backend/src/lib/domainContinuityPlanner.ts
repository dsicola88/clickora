/**
 * Etapa 4/5 — funções puras do painel de continuidade:
 * - uptime por domínio a partir das transições de saúde registadas;
 * - assistente de Final URL (Google Ads) que só SUGERE trocas para aprovação humana.
 *
 * Invariantes do assistente: mantém path + query da Final URL (só troca o host para outro domínio
 * verificado do mesmo dono), remove gclid/ValueTrack e nunca chama mutações na Google Ads.
 */
import { sanitizeFinalUrlForAds } from "./googleAdsFinalUrl";
import { hostnameLookupVariants, normalizeHostname } from "./requestHost";

export type HealthTransitionEvent = {
  createdAt: Date;
  eventType: string;
  metadata?: unknown;
};

function statusFromEvent(ev: HealthTransitionEvent): string | null {
  const meta = ev.metadata && typeof ev.metadata === "object" ? (ev.metadata as Record<string, unknown>) : null;
  const next = typeof meta?.next_status === "string" ? meta.next_status : null;
  if (next) return next;
  if (ev.eventType === "health_check_failed") return "down";
  if (ev.eventType === "health_check_degraded") return "degraded";
  if (ev.eventType === "health_check_passed") return "healthy";
  return null;
}

function previousStatusFromEvent(ev: HealthTransitionEvent): string | null {
  const meta = ev.metadata && typeof ev.metadata === "object" ? (ev.metadata as Record<string, unknown>) : null;
  return typeof meta?.previous_status === "string" ? meta.previous_status : null;
}

/**
 * Disponibilidade (0–1) na janela: tempo fora de `down` / duração. `degraded` conta como disponível
 * (abaixo do limiar de failover). Sem eventos na janela → estado atual durante toda a janela.
 */
export function computeUptimeFromTransitions(input: {
  events: HealthTransitionEvent[];
  windowStart: Date;
  now: Date;
  currentStatus: string;
}): number | null {
  const start = input.windowStart.getTime();
  const end = input.now.getTime();
  if (end <= start) return null;
  const inWindow = input.events
    .filter((e) => e.createdAt.getTime() >= start && e.createdAt.getTime() <= end)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (inWindow.length === 0) {
    if (input.currentStatus === "unknown") return null;
    return input.currentStatus === "down" ? 0 : 1;
  }

  let status = previousStatusFromEvent(inWindow[0]!) ?? "healthy";
  let cursor = start;
  let downMs = 0;
  for (const ev of inWindow) {
    const t = ev.createdAt.getTime();
    if (status === "down") downMs += t - cursor;
    cursor = t;
    status = statusFromEvent(ev) ?? status;
  }
  if (status === "down") downMs += end - cursor;
  const ratio = 1 - downMs / (end - start);
  return Math.max(0, Math.min(1, Number(ratio.toFixed(4))));
}

export type PresellRisk = "ok" | "no_domain" | "primary_down" | "primary_paused" | "on_backup";

/**
 * Risco de continuidade de uma presell. `primary` é o domínio *configurado* (binding primário, domínio da presell
 * ou padrão da conta) — não o canónico já escolhido — para que um primário em baixo nunca fique escondido por um backup.
 */
export function classifyPresellRisk(input: {
  hasSelectedDomain: boolean;
  primary: { healthStatus: string; isActive: boolean } | null;
  usedFailover: boolean;
}): PresellRisk {
  if (!input.hasSelectedDomain) return "no_domain";
  if (input.primary && input.primary.healthStatus === "down") return "primary_down";
  if (input.primary && !input.primary.isActive) return "primary_paused";
  if (input.usedFailover) return "on_backup";
  return "ok";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESERVED_FIRST_SEGMENTS = new Set(["api", "track", "assets", "static", "favicon.ico", "robots.txt", "sitemap.xml"]);

export type PresellPathRef = { kind: "id"; value: string } | { kind: "slug"; value: string } | { kind: "root" };

/** Formatos públicos: `/`, `/{slug}`, `/p/<uuid|slug>`, `/l/<uuid>`. */
export function extractPresellRefFromPath(pathname: string): PresellPathRef | null {
  const segs = pathname.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (segs.length === 0) return { kind: "root" };
  if ((segs[0] === "p" || segs[0] === "l") && segs[1]) {
    return UUID_RE.test(segs[1]) ? { kind: "id", value: segs[1].toLowerCase() } : { kind: "slug", value: segs[1] };
  }
  if (segs.length === 1 && !RESERVED_FIRST_SEGMENTS.has(segs[0]!.toLowerCase())) {
    return UUID_RE.test(segs[0]!) ? { kind: "id", value: segs[0]!.toLowerCase() } : { kind: "slug", value: segs[0]! };
  }
  return null;
}

export type ContinuityDomain = {
  id: string;
  hostname: string;
  status: string;
  purpose: string;
  isActive: boolean;
  healthStatus: string;
  /** Presell servida em `/`. Uma Final URL de raiz só migra para um domínio com a mesma escolha. */
  rootPresellId?: string | null;
};

export type ContinuityPresellInfo = {
  id: string;
  title: string;
  status: string;
  canonicalDomainId: string | null;
};

export type FinalUrlIssue =
  | "domain_down"
  | "domain_paused"
  | "domain_unverified"
  | "unknown_host"
  | "presell_unpublished"
  | "not_canonical";

export type FinalUrlSuggestion = {
  issue: FinalUrlIssue;
  severity: "critical" | "warning" | "info";
  currentHost: string;
  presellId: string | null;
  presellTitle: string | null;
  suggestedUrl: string | null;
  suggestedHost: string | null;
};

function findDomainByHost(domains: ContinuityDomain[], host: string): ContinuityDomain | null {
  const variants = new Set(hostnameLookupVariants(host));
  return (
    domains.find((d) => {
      const norm = normalizeHostname(d.hostname);
      return variants.has(norm) || hostnameLookupVariants(norm).some((v) => variants.has(v));
    }) ?? null
  );
}

function isServingCandidate(d: ContinuityDomain | null | undefined): d is ContinuityDomain {
  return Boolean(d && d.status === "verified" && d.isActive && d.healthStatus !== "down" && d.purpose !== "tracking");
}

/**
 * Avalia uma Final URL de um anúncio. Devolve `null` quando está OK; host fora da conta só gera aviso, sem sugestão.
 * A sugestão troca só o host (mesmo path/query) e só quando a presell está resolvida e o destino a serve
 * no mesmo caminho, por isso a landing revista pelo Google não muda.
 */
export function planFinalUrlContinuitySuggestion(input: {
  finalUrl: string;
  domains: ContinuityDomain[];
  accountCanonicalDomainId: string | null;
  resolvePresell: (ref: PresellPathRef, domain: ContinuityDomain | null) => ContinuityPresellInfo | null;
  isPlatformHost: (host: string) => boolean;
}): FinalUrlSuggestion | null {
  let url: URL;
  try {
    url = new URL(input.finalUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = normalizeHostname(url.hostname);
  if (!host || input.isPlatformHost(host)) return null;

  const domain = findDomainByHost(input.domains, host);
  const ref = extractPresellRefFromPath(url.pathname);
  const presell = ref ? input.resolvePresell(ref, domain) : null;

  const byId = new Map(input.domains.map((d) => [d.id, d]));
  const canonicalForPresell = presell?.canonicalDomainId ? byId.get(presell.canonicalDomainId) : null;
  const accountCanonical = input.accountCanonicalDomainId ? byId.get(input.accountCanonicalDomainId) : null;
  // Destino sugerido para os anúncios: saudável primeiro; `unknown` (ainda por sondar) só na falta de um saudável.
  // Nunca `degraded` — mesma regra do failover automático (não enviar tráfego pago para um domínio a falhar).
  const ordered = [canonicalForPresell, accountCanonical, ...input.domains];
  // Raiz (`/`): o destino tem de servir a mesma presell em `/`, senão a landing revista muda.
  const servesSameRoot = (d: ContinuityDomain) => ref?.kind !== "root" || (presell !== null && d.rootPresellId === presell.id);
  const pickTarget = (allowUnknown: boolean) =>
    ordered.find(
      (d) =>
        isServingCandidate(d) &&
        d.id !== domain?.id &&
        servesSameRoot(d) &&
        (d.healthStatus === "healthy" || (allowUnknown && d.healthStatus === "unknown")),
    ) ?? null;
  const target = pickTarget(false) ?? pickTarget(true);

  // Se o caminho aponta para uma presell que não existe na conta, não há página garantida no destino:
  // não inventamos uma Final URL (evita enviar tráfego pago para um 404 / página errada).
  const unresolvedPresellRef = ref === null || presell === null;

  const suggestion = (issue: FinalUrlIssue, severity: FinalUrlSuggestion["severity"], withTarget: boolean): FinalUrlSuggestion => {
    let suggestedUrl: string | null = null;
    if (withTarget && target && !unresolvedPresellRef) {
      const next = new URL(url.toString());
      next.hostname = target.hostname;
      next.protocol = "https:";
      next.port = "";
      suggestedUrl = sanitizeFinalUrlForAds(next.toString()) || next.toString();
    }
    return {
      issue,
      severity,
      currentHost: host,
      presellId: presell?.id ?? null,
      presellTitle: presell?.title ?? null,
      suggestedUrl,
      suggestedHost: suggestedUrl && target ? target.hostname : null,
    };
  };

  if (!domain) return suggestion("unknown_host", "info", false);
  if (domain.status !== "verified") return suggestion("domain_unverified", "critical", true);
  if (presell && presell.status !== "published") return suggestion("presell_unpublished", "critical", false);
  if (domain.healthStatus === "down") return suggestion("domain_down", "critical", true);
  if (!domain.isActive) return suggestion("domain_paused", "warning", true);
  if (presell?.canonicalDomainId && presell.canonicalDomainId !== domain.id && isServingCandidate(canonicalForPresell)) {
    return suggestion("not_canonical", "info", true);
  }
  return null;
}
