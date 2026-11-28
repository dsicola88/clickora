import type {
  CustomDomainPurpose,
  DomainHealthStatus,
  DomainRoutingEventType,
  DomainRoutingRole,
  Prisma,
} from "@prisma/client";
import { promises as dnsPromises } from "node:dns";
import { systemPrisma } from "./prisma";
import { probeCustomDomainLiveSsl } from "./customDomainLiveSsl";
import { probeRotatorDestinationQuick } from "./rotatorDestinationHealth";
import { refreshCustomDomainCache } from "./customDomainCache";
import { invalidateTrackEdgeDest } from "./trackEdgeDestCache";
import { appendWorkspaceAuditLog } from "./workspaceAudit";
import { hostnameLookupVariants, normalizeHostname } from "./requestHost";

export type RoutingDomainCandidate = {
  id: string;
  userId: string;
  hostname: string;
  status: string;
  purpose: CustomDomainPurpose | string;
  isDefault: boolean;
  isDefaultTracking: boolean;
  routingRole: DomainRoutingRole | string;
  healthStatus: DomainHealthStatus | string;
  consecutiveFailures: number;
  autoRecover: boolean;
  isActive: boolean;
  routingPriority: number;
  vercelDomainRegistered?: boolean;
  httpsReachableCached?: boolean | null;
  lastHealthError?: string | null;
};

export type PresellBindingCandidate = {
  customDomainId: string;
  role: DomainRoutingRole | string;
  priority: number;
  isActive: boolean;
};

function isHostingCapable(purpose: string): boolean {
  return purpose !== "tracking";
}

function isTrackingCapable(purpose: string): boolean {
  return purpose === "tracking" || purpose === "both";
}

function isUsableHostingDomain(d: RoutingDomainCandidate): boolean {
  return (
    d.status === "verified" &&
    d.isActive !== false &&
    d.healthStatus !== "down" &&
    isHostingCapable(String(d.purpose || "both"))
  );
}

/** Domínio padrão da conta (ou o primeiro utilizável por prioridade) — usado quando nada mais serve. */
function pickAccountFallbackDomain(domains: RoutingDomainCandidate[]): RoutingDomainCandidate | null {
  const usable = domains
    .filter(isUsableHostingDomain)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.routingPriority - b.routingPriority;
    });
  return usable[0] ?? null;
}

/**
 * Seleciona o domínio autorizado para uma presell seguindo:
 * 1) Se houver bindings explícitos ativos (`PresellDomainBinding`):
 *    - primeiro `primary` utilizável
 *    - depois `backup` utilizável ordenado por `priority` ascendente (failover)
 *    - (standby não entra em failover automático; exige promoção explícita)
 * 2) Sem bindings explícitos (modo legado): `legacyCustomDomainId` -> `isDefault` -> primeiro utilizável.
 */
export function selectAuthorizedDomainForPresell(input: {
  domains: RoutingDomainCandidate[];
  bindings: PresellBindingCandidate[];
  legacyCustomDomainId?: string | null;
}): {
  domain: RoutingDomainCandidate | null;
  usedFailover: boolean;
  reason:
    | "primary_binding"
    | "backup_failover"
    | "account_fallback"
    | "legacy_explicit"
    | "legacy_default"
    | "none_available";
} {
  const byId = new Map(input.domains.map((d) => [d.id, d]));

  const activeBindings = input.bindings
    .filter((b) => b.isActive)
    .sort((a, b) => a.priority - b.priority);

  if (activeBindings.length > 0) {
    const primaryBindings = activeBindings.filter((b) => b.role === "primary");
    for (const b of primaryBindings) {
      const dom = byId.get(b.customDomainId);
      if (dom && isUsableHostingDomain(dom)) {
        return { domain: dom, usedFailover: false, reason: "primary_binding" };
      }
    }

    const backupBindings = activeBindings.filter((b) => b.role === "backup");
    for (const b of backupBindings) {
      const dom = byId.get(b.customDomainId);
      if (dom && isUsableHostingDomain(dom)) {
        return { domain: dom, usedFailover: true, reason: "backup_failover" };
      }
    }

    // Nenhum domínio com binding está utilizável: nunca ficar pior do que o modo legado — cai para o domínio
    // padrão da conta / primeiro utilizável (mesma cadeia que o frontend em `getPublicPresellOriginForPresell`).
    const fallback = pickAccountFallbackDomain(input.domains);
    if (fallback) return { domain: fallback, usedFailover: true, reason: "account_fallback" };
    return { domain: null, usedFailover: false, reason: "none_available" };
  }

  // Modo legado (sem bindings na tabela presell_domain_bindings)
  if (input.legacyCustomDomainId) {
    const legacyDom = byId.get(input.legacyCustomDomainId);
    if (legacyDom && isUsableHostingDomain(legacyDom)) {
      return { domain: legacyDom, usedFailover: false, reason: "legacy_explicit" };
    }
  }

  const usable = input.domains
    .filter(isUsableHostingDomain)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.routingPriority - b.routingPriority;
    });
  if (usable[0]) {
    return {
      domain: usable[0],
      usedFailover: Boolean(input.legacyCustomDomainId && usable[0].id !== input.legacyCustomDomainId),
      reason: "legacy_default",
    };
  }
  return { domain: null, usedFailover: false, reason: "none_available" };
}

export const DOMAIN_FAILOVER_THRESHOLD = 3;

/** Falhas consecutivas até `down` (env `DOMAIN_HEALTH_FAIL_THRESHOLD`, 1–20). */
export function domainFailThresholdFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.DOMAIN_HEALTH_FAIL_THRESHOLD?.trim() || "", 10);
  if (!Number.isFinite(n)) return DOMAIN_FAILOVER_THRESHOLD;
  return Math.min(20, Math.max(1, n));
}

const DOMAIN_HEALTH_HTTP_TIMEOUT_DEFAULT_MS = 8_000;

/** Timeout da camada HTTP da sonda de saúde (env `DOMAIN_HEALTH_HTTP_TIMEOUT_MS`, 1000–30000). */
export function domainHealthHttpTimeoutMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.DOMAIN_HEALTH_HTTP_TIMEOUT_MS?.trim() || "", 10);
  if (!Number.isFinite(n)) return DOMAIN_HEALTH_HTTP_TIMEOUT_DEFAULT_MS;
  return Math.min(30_000, Math.max(1_000, n));
}

type HttpProbeFn = typeof probeRotatorDestinationQuick;

/** Timeout/erro de rede repete uma vez (latência pontual não deve marcar o domínio como degradado). Respostas HTTP não repetem. */
export async function probeDomainHttpWithRetry(
  url: string,
  timeoutMs: number,
  probe: HttpProbeFn = probeRotatorDestinationQuick,
): Promise<Awaited<ReturnType<HttpProbeFn>>> {
  const first = await probe(url, { timeoutMs, bypassCache: true });
  if (first.healthy || (first.reason !== "timeout" && first.reason !== "network")) return first;
  return probe(url, { timeoutMs, bypassCache: true });
}

export function evaluateDomainHealthTransition(input: {
  currentStatus: DomainHealthStatus | string;
  consecutiveFailures: number;
  autoRecover: boolean;
  probeOk: boolean;
  error?: string | null;
  failThreshold?: number;
}): {
  nextStatus: DomainHealthStatus;
  consecutiveFailures: number;
  shouldTriggerFailover: boolean;
  recoveredFromFailure: boolean;
  eligibleForAutoRecovery: boolean;
  eventType: DomainRoutingEventType;
  reason: string;
} {
  const threshold = Math.max(1, input.failThreshold ?? DOMAIN_FAILOVER_THRESHOLD);

  if (input.probeOk) {
    const wasDownOrDegraded =
      input.currentStatus === "down" || input.currentStatus === "degraded";
    return {
      nextStatus: "healthy",
      consecutiveFailures: 0,
      shouldTriggerFailover: false,
      recoveredFromFailure: wasDownOrDegraded,
      eligibleForAutoRecovery: input.currentStatus === "down" && input.autoRecover,
      // `auto_recovery` fica reservado à ação de routing (repor primário após failover).
      eventType: "health_check_passed",
      reason: wasDownOrDegraded ? "Domínio recuperou conectividade SSL/HTTP." : "Sondagem HTTPS/SSL OK.",
    };
  }

  const nextFailures = Math.max(0, input.consecutiveFailures) + 1;
  const isDown = nextFailures >= threshold;
  return {
    nextStatus: isDown ? "down" : "degraded",
    consecutiveFailures: nextFailures,
    shouldTriggerFailover: isDown,
    recoveredFromFailure: false,
    eligibleForAutoRecovery: false,
    eventType: isDown ? "health_check_failed" : "health_check_degraded",
    reason: input.error?.trim() || (isDown ? "Falhas consecutivas atingiram limite de failover." : "Falha transitória na sondagem."),
  };
}

/**
 * Motivo (frase sem sujeito) pelo qual um domínio não pode passar a primário; `null` = pode.
 * `healthy` confia na última sondagem (que já inclui a camada SSL). `unknown` só é recusado com HTTPS falhado.
 */
export function describeUnavailablePrimaryTarget(
  d: Pick<RoutingDomainCandidate, "healthStatus" | "httpsReachableCached" | "lastHealthError">,
): string | null {
  const err = d.lastHealthError?.trim();
  const detail = err ? ` Último erro: ${err.slice(0, 160)}` : "";
  if (d.healthStatus === "down") return `está indisponível (down).${detail}`;
  if (d.healthStatus === "degraded") {
    return `está a falhar as verificações DNS/SSL/HTTP (degradado).${detail}`;
  }
  if (d.healthStatus !== "healthy" && d.httpsReachableCached === false) {
    return "não responde em HTTPS (certificado SSL inválido, expirado ou em falta).";
  }
  return null;
}

/** Troca recusada pelo estado atual (gate de saúde, já principal, principal mudou) → HTTP 409. */
export class DomainRoutingRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainRoutingRefusedError";
  }
}

const PRIMARY_CHANGED_MESSAGE = "O domínio principal mudou entretanto. Nada foi alterado.";

export function planPrimaryDomainSwap(input: {
  currentPrimary: RoutingDomainCandidate | null;
  target: RoutingDomainCandidate | null;
  scope: "hosting" | "tracking";
}):
  | { ok: true; previousDomainId: string | null; targetDomainId: string }
  | { ok: false; error: string } {
  if (!input.target) {
    return { ok: false, error: "Domínio de destino não encontrado." };
  }
  if (input.target.status !== "verified") {
    return { ok: false, error: "Domínio de destino precisa estar verificado." };
  }
  if (!input.target.isActive) {
    return { ok: false, error: "Domínio de destino está desativado." };
  }
  const unavailable = describeUnavailablePrimaryTarget(input.target);
  if (unavailable) {
    return { ok: false, error: `Domínio de destino ${unavailable}` };
  }
  if (input.scope === "hosting" && !isHostingCapable(String(input.target.purpose))) {
    return { ok: false, error: "Domínio só de tracking não pode assumir papel primário de presells." };
  }
  if (input.scope === "tracking" && !isTrackingCapable(String(input.target.purpose))) {
    return { ok: false, error: "Domínio só de hosting não pode assumir papel primário de tracking." };
  }
  if (input.currentPrimary && input.currentPrimary.id === input.target.id) {
    return { ok: false, error: "Este domínio já é o principal ativo." };
  }
  return {
    ok: true,
    previousDomainId: input.currentPrimary?.id ?? null,
    targetDomainId: input.target.id,
  };
}

export function planRollbackTarget(input: {
  currentPrimaryId: string | null;
  events: Array<{
    eventType: DomainRoutingEventType | string;
    previousDomainId: string | null;
    targetDomainId: string | null;
  }>;
  domains: RoutingDomainCandidate[];
}): { ok: true; targetDomainId: string } | { ok: false; error: string } {
  const byId = new Map(input.domains.map((d) => [d.id, d]));
  const swapEvent = input.events.find(
    (e) =>
      (e.eventType === "manual_swap" ||
        e.eventType === "auto_failover" ||
        e.eventType === "manual_rollback") &&
      e.previousDomainId &&
      e.previousDomainId !== input.currentPrimaryId,
  );
  if (!swapEvent?.previousDomainId) {
    return { ok: false, error: "Não há domínio anterior registado no histórico para rollback." };
  }
  const target = byId.get(swapEvent.previousDomainId);
  if (!target) {
    return { ok: false, error: "O domínio anterior já não existe na conta." };
  }
  if (target.status !== "verified" || !target.isActive) {
    return { ok: false, error: "O domínio anterior não está verificado e ativo para rollback." };
  }
  const unavailable = describeUnavailablePrimaryTarget(target);
  if (unavailable) {
    return {
      ok: false,
      error: `Rollback recusado: o domínio anterior (${target.hostname}) ${unavailable.replace(/\.?$/, ".")} O domínio atual mantém-se.`,
    };
  }
  return { ok: true, targetDomainId: target.id };
}

export type HostBindingCheckRow = {
  hostname: string;
  isActive: boolean;
  domainIsActive: boolean;
  domainStatus: string;
};

/**
 * Bindings servem para escolher o domínio canónico/failover — não para restringir onde a presell abre.
 * Uma Final URL já publicada no Google Ads pode usar qualquer domínio verificado do dono; bloquear
 * esse host gera o sintoma clássico «cliques no Ads que não chegam à Clickora nem à rede».
 * Por isso só se recusa o host quando o operador desativou explicitamente esse domínio para esta presell
 * (binding com `isActive=false`). Endpoints de medição (`/track/*`) nunca usam esta verificação.
 */
export function isRequestHostAllowedForPresellBindings(input: {
  requestHost: string;
  bindings: HostBindingCheckRow[];
}): boolean {
  if (input.bindings.length === 0) return true;
  const variants = new Set(hostnameLookupVariants(input.requestHost));
  if (variants.size === 0) return true;
  const matching = input.bindings.filter((b) => {
    const norm = normalizeHostname(b.hostname);
    return variants.has(norm) || hostnameLookupVariants(norm).some((v) => variants.has(v));
  });
  if (matching.length === 0) return true;
  return matching.some((b) => b.isActive);
}

export async function recordDomainRoutingEvent(args: {
  userId: string;
  eventType: DomainRoutingEventType;
  scope?: "domain" | "presell" | "offer";
  customDomainId?: string | null;
  previousDomainId?: string | null;
  targetDomainId?: string | null;
  presellId?: string | null;
  offerId?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await systemPrisma.domainRoutingEvent.create({
      data: {
        userId: args.userId,
        eventType: args.eventType,
        scope: args.scope ?? "domain",
        customDomainId: args.customDomainId ?? null,
        previousDomainId: args.previousDomainId ?? null,
        targetDomainId: args.targetDomainId ?? null,
        presellId: args.presellId ?? null,
        offerId: args.offerId ?? null,
        actorUserId: args.actorUserId ?? null,
        reason: args.reason ? args.reason.slice(0, 500) : null,
        metadata: (args.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.warn("[domainRouting] falha ao gravar DomainRoutingEvent:", err instanceof Error ? err.message : err);
  }
}

export type DomainHealthProbeResult = {
  ok: boolean;
  healthStatus: DomainHealthStatus;
  previousStatus: DomainHealthStatus;
  httpStatus: number | null;
  error: string | null;
  failedLayer: DomainProbeLayer | null;
  consecutiveFailures: number;
  shouldTriggerFailover: boolean;
  eligibleForAutoRecovery: boolean;
};

/**
 * Sonda DNS + SSL + HTTP do domínio (reutiliza `probeCustomDomainLiveSsl` e `probeRotatorDestinationQuick`),
 * atualiza o estado de saúde na BD e regista histórico em `DomainRoutingEvent`.
 * Só observa: nunca altera o conteúdo servido nem faz redirects.
 */
export async function runDomainHealthProbeAndUpdate(args: {
  domainId: string;
  userId: string;
  actorUserId?: string | null;
}): Promise<DomainHealthProbeResult> {
  const row = await systemPrisma.customDomain.findFirst({
    where: { id: args.domainId, userId: args.userId },
  });
  if (!row) {
    throw new Error("Domínio não encontrado.");
  }

  if (row.status !== "verified") {
    return {
      ok: false,
      healthStatus: row.healthStatus,
      previousStatus: row.healthStatus,
      httpStatus: row.lastHttpStatus ?? null,
      error: "Domínio ainda pendente de verificação DNS.",
      failedLayer: "dns",
      consecutiveFailures: row.consecutiveFailures,
      shouldTriggerFailover: false,
      eligibleForAutoRecovery: false,
    };
  }

  const [dnsProbe, sslLive, httpProbe] = await Promise.all([
    probeDomainDns(row.hostname),
    probeCustomDomainLiveSsl({
      status: row.status,
      hostname: row.hostname,
      vercelDomainRegistered: row.vercelDomainRegistered,
    }),
    probeDomainHttpWithRetry(`https://${row.hostname}/`, domainHealthHttpTimeoutMsFromEnv()),
  ]);

  const layers = summarizeDomainProbeLayers({
    dns: dnsProbe,
    ssl: sslLive
      ? { httpsReachable: sslLive.httpsReachable, vercelMisconfigured: sslLive.vercelMisconfigured }
      : null,
    http: { healthy: httpProbe.healthy, status: httpProbe.status ?? null, reason: httpProbe.reason ?? null },
  });
  const probeOk = layers.ok;
  const errorMsg = layers.error;

  const previousStatus = row.healthStatus;
  const transition = evaluateDomainHealthTransition({
    currentStatus: row.healthStatus,
    consecutiveFailures: row.consecutiveFailures,
    autoRecover: row.autoRecover,
    probeOk,
    error: errorMsg,
    failThreshold: domainFailThresholdFromEnv(),
  });

  await systemPrisma.customDomain.update({
    where: { id: row.id },
    data: {
      healthStatus: transition.nextStatus,
      consecutiveFailures: transition.consecutiveFailures,
      lastHealthCheckAt: new Date(),
      lastHealthError: probeOk ? null : transition.reason.slice(0, 500),
      lastHttpStatus: httpProbe.status ?? null,
      ...(sslLive && typeof sslLive.httpsReachable === "boolean"
        ? {
            httpsReachableCached: sslLive.httpsReachable,
            httpsReadyCheckedAt: new Date(),
          }
        : {}),
    },
  });

  // Histórico compacto: falhas e mudanças de estado (checks saudáveis repetidos não geram linhas).
  if (shouldRecordHealthEvent({ previousStatus, nextStatus: transition.nextStatus, probeOk, manual: Boolean(args.actorUserId) })) {
    await recordDomainRoutingEvent({
      userId: row.userId,
      eventType: transition.eventType,
      scope: "domain",
      customDomainId: row.id,
      actorUserId: args.actorUserId ?? null,
      reason: transition.reason,
      metadata: {
        hostname: row.hostname,
        previous_status: previousStatus,
        next_status: transition.nextStatus,
        failed_layer: layers.failedLayer,
        dns_ok: dnsProbe.ok,
        dns_error: dnsProbe.error,
        http_status: httpProbe.status,
        ssl_reachable: sslLive?.httpsReachable ?? null,
        vercel_misconfigured: sslLive?.vercelMisconfigured ?? null,
        consecutive_failures: transition.consecutiveFailures,
      },
    });
  }

  return {
    ok: probeOk,
    healthStatus: transition.nextStatus,
    previousStatus,
    httpStatus: httpProbe.status ?? null,
    error: errorMsg,
    failedLayer: layers.failedLayer,
    consecutiveFailures: transition.consecutiveFailures,
    shouldTriggerFailover: transition.shouldTriggerFailover,
    eligibleForAutoRecovery: transition.eligibleForAutoRecovery,
  };
}

export type DomainProbeLayer = "dns" | "ssl" | "http";

/** Combina DNS → SSL → HTTP numa decisão única (a primeira camada que falha explica o erro). */
export function summarizeDomainProbeLayers(input: {
  dns: { ok: boolean; error: string | null };
  ssl: { httpsReachable: boolean | null | undefined; vercelMisconfigured: boolean | null | undefined } | null;
  http: { healthy: boolean; status: number | null; reason: string | null };
}): { ok: boolean; failedLayer: DomainProbeLayer | null; error: string | null } {
  if (!input.dns.ok) {
    return { ok: false, failedLayer: "dns", error: `DNS: ${input.dns.error || "sem registos A/AAAA/CNAME"}` };
  }
  const sslOk = input.ssl
    ? input.ssl.httpsReachable !== false && input.ssl.vercelMisconfigured !== true
    : true;
  if (!sslOk) {
    return { ok: false, failedLayer: "ssl", error: "SSL/TLS: certificado ou edge mal configurado." };
  }
  if (!input.http.healthy) {
    return {
      ok: false,
      failedLayer: "http",
      error: `HTTP: ${input.http.reason || (input.http.status ? `status ${input.http.status}` : "sem resposta")}`,
    };
  }
  return { ok: true, failedLayer: null, error: null };
}

export function shouldRecordHealthEvent(input: {
  previousStatus: DomainHealthStatus | string;
  nextStatus: DomainHealthStatus | string;
  probeOk: boolean;
  manual: boolean;
}): boolean {
  if (input.manual) return true;
  if (!input.probeOk) return true;
  return input.previousStatus !== input.nextStatus;
}

const DNS_TIMEOUT_MS = 2_500;

/** Resolve A/AAAA/CNAME com timeout; qualquer registo válido conta como DNS OK. */
export async function probeDomainDns(
  hostname: string,
  resolver: Pick<typeof import("node:dns").promises, "resolve4" | "resolve6" | "resolveCname"> = dnsPromises,
): Promise<{ ok: boolean; error: string | null }> {
  const host = normalizeHostname(hostname);
  if (!host) return { ok: false, error: "hostname inválido" };
  const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), DNS_TIMEOUT_MS)),
    ]);
  const attempts = await Promise.allSettled([
    withTimeout(resolver.resolve4(host)),
    withTimeout(resolver.resolve6(host)),
    withTimeout(resolver.resolveCname(host)),
  ]);
  const ok = attempts.some((a) => a.status === "fulfilled" && Array.isArray(a.value) && a.value.length > 0);
  if (ok) return { ok: true, error: null };
  const firstErr = attempts.find((a) => a.status === "rejected") as PromiseRejectedResult | undefined;
  const code =
    (firstErr?.reason as { code?: string } | undefined)?.code ||
    (firstErr?.reason instanceof Error ? firstErr.reason.message : null);
  return { ok: false, error: code || "sem registos" };
}

/**
 * Sincroniza bindings múltiplos da presell e mantém `presell_pages.custom_domain_id`
 * alinhado com o binding `primary` ativo.
 */
export async function syncPresellDomainBindings(args: {
  userId: string;
  presellId: string;
  bindings: Array<{
    customDomainId: string;
    role: DomainRoutingRole;
    priority?: number;
    isActive?: boolean;
  }>;
  actorUserId?: string | null;
}): Promise<{ primaryDomainId: string | null }> {
  const domainIds = [...new Set(args.bindings.map((b) => b.customDomainId))];
  const ownedDomains = domainIds.length
    ? await systemPrisma.customDomain.findMany({
        where: { id: { in: domainIds }, userId: args.userId, status: "verified" },
      })
    : [];
  const validMap = new Map(ownedDomains.map((d) => [d.id, d]));

  for (const b of args.bindings) {
    const dom = validMap.get(b.customDomainId);
    if (!dom) {
      throw new Error("Um ou mais domínios selecionados são inválidos ou não estão verificados.");
    }
    if (dom.purpose === "tracking") {
      throw new Error(`Domínio só de tracking (${dom.hostname}) não pode alojar presell.`);
    }
  }

  // Garante no máximo um primary ativo.
  let seenPrimary = false;
  const normalized = args.bindings.map((b, idx) => {
    const active = b.isActive !== false;
    let role = b.role;
    if (role === "primary" && active) {
      if (seenPrimary) role = "backup";
      else seenPrimary = true;
    }
    return {
      customDomainId: b.customDomainId,
      role,
      priority: typeof b.priority === "number" ? b.priority : role === "primary" ? 10 : 100 + idx * 10,
      isActive: active,
    };
  });

  const primaryEntry = normalized.find((b) => b.role === "primary" && b.isActive) ?? null;

  await systemPrisma.$transaction(async (tx) => {
    await tx.presellDomainBinding.deleteMany({
      where: { presellId: args.presellId, userId: args.userId },
    });
    if (normalized.length > 0) {
      await tx.presellDomainBinding.createMany({
        data: normalized.map((b) => ({
          userId: args.userId,
          presellId: args.presellId,
          customDomainId: b.customDomainId,
          role: b.role,
          priority: b.priority,
          isActive: b.isActive,
        })),
      });
    }
    await tx.presellPage.update({
      where: { id: args.presellId },
      data: { customDomainId: primaryEntry?.customDomainId ?? null },
    });
  });

  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: "binding_updated",
    scope: "presell",
    presellId: args.presellId,
    targetDomainId: primaryEntry?.customDomainId ?? null,
    actorUserId: args.actorUserId ?? null,
    reason: `Atualizados ${normalized.length} domínio(s) autorizados para a presell.`,
    metadata: { bindings: normalized },
  });

  void invalidateTrackEdgeDest(args.presellId);
  return { primaryDomainId: primaryEntry?.customDomainId ?? null };
}

/**
 * Mantém `presell_domain_bindings` coerente quando o domínio é trocado pelo formulário legado
 * (`custom_domain_id`). Escolha explícita do dono: não aplica gate de saúde.
 * - `null` (seguir default da conta): remove bindings, senão o link canónico ficaria preso ao domínio antigo.
 * - sem bindings: nada a fazer (modo legado já coerente).
 * - com bindings: o domínio escolhido passa a primary e o anterior fica como backup (rollback possível).
 */
export async function alignPresellBindingsWithLegacyDomain(args: {
  userId: string;
  presellId: string;
  customDomainId: string | null;
  actorUserId?: string | null;
}): Promise<{ changed: boolean; previousDomainId: string | null }> {
  let bindings: Array<{ customDomainId: string; role: string; isActive: boolean }>;
  try {
    bindings = await systemPrisma.presellDomainBinding.findMany({
      where: { presellId: args.presellId, userId: args.userId },
      select: { customDomainId: true, role: true, isActive: true },
    });
  } catch {
    return { changed: false, previousDomainId: null };
  }
  if (bindings.length === 0) return { changed: false, previousDomainId: null };

  const previousDomainId =
    bindings.find((b) => b.role === "primary" && b.isActive)?.customDomainId ?? null;

  if (!args.customDomainId) {
    await systemPrisma.presellDomainBinding.deleteMany({
      where: { presellId: args.presellId, userId: args.userId },
    });
    await recordDomainRoutingEvent({
      userId: args.userId,
      eventType: "binding_updated",
      scope: "presell",
      presellId: args.presellId,
      previousDomainId,
      actorUserId: args.actorUserId ?? null,
      reason: "Presell passou a seguir o domínio padrão da conta; bindings removidos.",
    });
    void invalidateTrackEdgeDest(args.presellId);
    return { changed: true, previousDomainId };
  }

  if (previousDomainId === args.customDomainId) {
    return { changed: false, previousDomainId };
  }

  const targetId = args.customDomainId;
  await systemPrisma.$transaction(async (tx) => {
    await tx.presellDomainBinding.updateMany({
      where: { presellId: args.presellId, userId: args.userId, role: "primary" },
      data: { role: "backup", priority: 50 },
    });
    await tx.presellDomainBinding.upsert({
      where: { presellId_customDomainId: { presellId: args.presellId, customDomainId: targetId } },
      create: {
        userId: args.userId,
        presellId: args.presellId,
        customDomainId: targetId,
        role: "primary",
        priority: 10,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: { role: "primary", priority: 10, isActive: true, lastUsedAt: new Date() },
    });
  });
  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: "manual_swap",
    scope: "presell",
    presellId: args.presellId,
    customDomainId: targetId,
    previousDomainId,
    targetDomainId: targetId,
    actorUserId: args.actorUserId ?? null,
    reason: "Domínio da presell alterado no editor.",
  });
  void invalidateTrackEdgeDest(args.presellId);
  return { changed: true, previousDomainId };
}

/**
 * Troca o domínio primário de uma presell específica (atualiza bindings + `customDomainId`)
 * e regista evento para suportar rollback imediato.
 */
export async function swapPresellPrimaryDomain(args: {
  userId: string;
  presellId: string;
  targetDomainId: string;
  actorUserId: string | null;
  workspaceId?: string | null;
  reason?: string | null;
  isRollback?: boolean;
  automaticEventType?: "auto_failover" | "auto_recovery";
  metadata?: Record<string, unknown> | null;
  /** Ações automáticas: só aplica se o primário ainda for este (uma troca manual entretanto prevalece). */
  expectedCurrentPrimaryId?: string | null;
}): Promise<{ previousDomainId: string | null; targetDomainId: string }> {
  const page = await systemPrisma.presellPage.findFirst({
    where: { id: args.presellId, userId: args.userId },
    include: { domainBindings: true },
  });
  if (!page) throw new Error("Presell não encontrada.");

  const target = await systemPrisma.customDomain.findFirst({
    where: { id: args.targetDomainId, userId: args.userId },
  });
  if (!target) throw new Error("Domínio de destino não encontrado.");

  const currentPrimaryId =
    page.domainBindings.find((b) => b.role === "primary" && b.isActive)?.customDomainId ??
    page.customDomainId ??
    null;

  const currentPrimaryRow = currentPrimaryId
    ? await systemPrisma.customDomain.findFirst({ where: { id: currentPrimaryId, userId: args.userId } })
    : null;

  const check = planPrimaryDomainSwap({
    currentPrimary: currentPrimaryRow as RoutingDomainCandidate | null,
    target: target as RoutingDomainCandidate,
    scope: "hosting",
  });
  if (!check.ok) throw new DomainRoutingRefusedError(check.error);
  if (args.expectedCurrentPrimaryId !== undefined && currentPrimaryId !== args.expectedCurrentPrimaryId) {
    throw new DomainRoutingRefusedError(PRIMARY_CHANGED_MESSAGE);
  }

  await systemPrisma.$transaction(async (tx) => {
    if (args.expectedCurrentPrimaryId !== undefined) {
      const fresh = await tx.presellDomainBinding.findFirst({
        where: { presellId: page.id, userId: args.userId, role: "primary", isActive: true },
        select: { customDomainId: true },
      });
      if ((fresh?.customDomainId ?? currentPrimaryId) !== args.expectedCurrentPrimaryId) {
        throw new DomainRoutingRefusedError(PRIMARY_CHANGED_MESSAGE);
      }
    }
    await tx.presellDomainBinding.updateMany({
      where: { presellId: page.id, userId: args.userId, role: "primary" },
      data: { role: "backup", priority: 50 },
    });
    await tx.presellDomainBinding.upsert({
      where: { presellId_customDomainId: { presellId: page.id, customDomainId: target.id } },
      create: {
        userId: args.userId,
        presellId: page.id,
        customDomainId: target.id,
        role: "primary",
        priority: 10,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        role: "primary",
        priority: 10,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
    await tx.presellPage.update({
      where: { id: page.id },
      data: { customDomainId: target.id },
    });
  });

  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: args.automaticEventType ?? (args.isRollback ? "manual_rollback" : "manual_swap"),
    scope: "presell",
    customDomainId: target.id,
    previousDomainId: check.previousDomainId,
    targetDomainId: target.id,
    presellId: page.id,
    actorUserId: args.actorUserId,
    reason: args.reason || (args.isRollback ? "Rollback manual do domínio da presell." : "Troca manual do domínio principal da presell."),
    metadata: args.metadata ?? null,
  });

  if (args.workspaceId && args.actorUserId) {
    await appendWorkspaceAuditLog({
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      action: args.isRollback ? "presell.domain_rollback" : "presell.domain_swap",
      resourceType: "presell_page",
      resourceId: page.id,
      metadata: {
        previous_domain_id: check.previousDomainId,
        target_domain_id: target.id,
        hostname: target.hostname,
      },
    });
  }

  void invalidateTrackEdgeDest(page.id);
  return { previousDomainId: check.previousDomainId, targetDomainId: target.id };
}

/**
 * Promove um domínio verificado para `primary` na conta (mantendo `is_default` sincronizado).
 */
export async function promotePrimaryDomainForUser(args: {
  userId: string;
  targetDomainId: string;
  actorUserId: string | null;
  workspaceId?: string | null;
  reason?: string | null;
  isRollback?: boolean;
  /** Ações automáticas do monitor (failover / recuperação) — sem ator humano. */
  automaticEventType?: "auto_failover" | "auto_recovery";
  metadata?: Record<string, unknown> | null;
  /** Ações automáticas: só aplica se o primário ainda for este (uma troca manual entretanto prevalece). */
  expectedCurrentPrimaryId?: string | null;
}): Promise<{ previousDomainId: string | null; targetDomainId: string }> {
  const domains = await systemPrisma.customDomain.findMany({
    where: { userId: args.userId },
  });
  const currentPrimary =
    domains.find((d) => d.isDefault && d.purpose !== "tracking") ??
    domains.find((d) => d.routingRole === "primary" && d.purpose !== "tracking") ??
    null;
  const target = domains.find((d) => d.id === args.targetDomainId) ?? null;

  const check = planPrimaryDomainSwap({
    currentPrimary: currentPrimary as RoutingDomainCandidate | null,
    target: target as RoutingDomainCandidate | null,
    scope: "hosting",
  });
  if (!check.ok) throw new DomainRoutingRefusedError(check.error);
  if (args.expectedCurrentPrimaryId !== undefined && (currentPrimary?.id ?? null) !== args.expectedCurrentPrimaryId) {
    throw new DomainRoutingRefusedError(PRIMARY_CHANGED_MESSAGE);
  }

  await systemPrisma.$transaction(async (tx) => {
    if (args.expectedCurrentPrimaryId !== undefined) {
      const fresh = await tx.customDomain.findFirst({
        where: { userId: args.userId, isDefault: true, purpose: { not: "tracking" } },
        select: { id: true },
      });
      if ((fresh?.id ?? null) !== args.expectedCurrentPrimaryId) {
        throw new DomainRoutingRefusedError(PRIMARY_CHANGED_MESSAGE);
      }
    }
    await tx.customDomain.updateMany({
      where: { userId: args.userId, purpose: { not: "tracking" } },
      data: { isDefault: false },
    });
    if (currentPrimary && currentPrimary.id !== check.targetDomainId) {
      await tx.customDomain.update({
        where: { id: currentPrimary.id },
        data: { routingRole: "backup", routingPriority: 50 },
      });
    }
    await tx.customDomain.update({
      where: { id: check.targetDomainId },
      data: { isDefault: true, routingRole: "primary", routingPriority: 10 },
    });
  });

  await refreshCustomDomainCache();
  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: args.automaticEventType ?? (args.isRollback ? "manual_rollback" : "manual_swap"),
    scope: "domain",
    customDomainId: check.targetDomainId,
    previousDomainId: check.previousDomainId,
    targetDomainId: check.targetDomainId,
    actorUserId: args.actorUserId,
    reason: args.reason || (args.isRollback ? "Rollback manual para o domínio principal anterior." : "Troca manual do domínio principal da conta."),
    metadata: args.metadata ?? null,
  });

  if (args.workspaceId && args.actorUserId) {
    await appendWorkspaceAuditLog({
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      action: args.isRollback ? "custom_domain.rollback_primary" : "custom_domain.promote_primary",
      resourceType: "custom_domain",
      resourceId: check.targetDomainId,
      metadata: {
        previous_domain_id: check.previousDomainId,
        target_domain_id: check.targetDomainId,
      },
    });
  }

  return { previousDomainId: check.previousDomainId, targetDomainId: check.targetDomainId };
}

export async function loadPresellActiveBindingsForHostCheck(presellId: string): Promise<HostBindingCheckRow[]> {
  try {
    const rows = await systemPrisma.presellDomainBinding.findMany({
      where: { presellId },
      include: {
        customDomain: { select: { hostname: true, isActive: true, status: true } },
      },
    });
    return rows.map((r) => ({
      hostname: r.customDomain.hostname,
      isActive: r.isActive,
      domainIsActive: r.customDomain.isActive,
      domainStatus: r.customDomain.status,
    }));
  } catch {
    // Se a tabela ainda não existir antes do migrate deploy, falha aberto (compatibilidade).
    return [];
  }
}
