/**
 * Etapa 3 — failover automático após falhas consecutivas + auto-recovery.
 *
 * Regras de conformidade (Google Ads / Meta / Microsoft):
 * - Só muda o domínio canónico usado pelo painel (links novos, base de tracking, presells sem domínio fixo).
 *   Não há redirects 301/302 entre domínios nem conteúdo diferente por visitante: o domínio antigo
 *   continua a servir a mesma presell se voltar a responder.
 * - Nunca altera anúncios/Final URLs: o assistente de continuidade sugere a troca para aprovação humana.
 * - Opt-in explícito: só domínios com papel `backup` (conta) ou bindings `backup` (presell) são alvos.
 */
import type { DomainRoutingEventType } from "@prisma/client";
import { systemPrisma } from "./prisma";
import {
  describeUnavailablePrimaryTarget,
  promotePrimaryDomainForUser,
  runDomainHealthProbeAndUpdate,
  swapPresellPrimaryDomain,
  type RoutingDomainCandidate,
} from "./domainRoutingService";

export type FailoverDomain = Pick<
  RoutingDomainCandidate,
  "id" | "status" | "purpose" | "isDefault" | "routingRole" | "healthStatus" | "isActive" | "routingPriority" | "autoRecover"
> & {
  hostname?: string;
  userId?: string;
  httpsReachableCached?: boolean | null;
  lastHealthError?: string | null;
  lastHealthCheckAt?: Date | null;
};

/**
 * Failover automático só para destinos com última sondagem saudável: `unknown` (nunca sondado) e
 * `degraded` (já a falhar, abaixo do limiar) não recebem tráfego sem decisão humana.
 */
function isUsableFailoverTarget(d: FailoverDomain): boolean {
  return (
    d.status === "verified" &&
    d.isActive !== false &&
    d.healthStatus === "healthy" &&
    describeUnavailablePrimaryTarget(d) === null &&
    String(d.purpose || "both") !== "tracking"
  );
}

function rankTargets<T extends FailoverDomain>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.routingPriority !== b.routingPriority) return a.routingPriority - b.routingPriority;
    return a.id.localeCompare(b.id);
  });
}

export function autoFailoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DOMAIN_AUTO_FAILOVER_ENABLED?.trim().toLowerCase() !== "false";
}

/** Janela mínima entre failover e recuperação automática (anti-flapping). */
export function autoRecoveryHoldMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.DOMAIN_AUTO_RECOVERY_HOLD_MINUTES?.trim() || "", 10);
  const minutes = Number.isFinite(n) ? Math.min(24 * 60, Math.max(1, n)) : 10;
  return minutes * 60_000;
}

/** Failover de conta: o domínio principal (is_default) caiu → promover o melhor `backup` explícito. */
export function planAccountFailover(input: {
  failedDomainId: string;
  domains: FailoverDomain[];
  /** Destinos rejeitados pela confirmação ao vivo neste ciclo. */
  excludedIds?: ReadonlySet<string>;
}): { ok: true; targetDomainId: string } | { ok: false; reason: string } {
  const failed = input.domains.find((d) => d.id === input.failedDomainId);
  if (!failed) return { ok: false, reason: "domain_not_found" };
  if (!failed.isDefault || String(failed.purpose) === "tracking") {
    return { ok: false, reason: "not_account_primary" };
  }
  if (failed.healthStatus !== "down") return { ok: false, reason: "not_down" };
  const candidates = rankTargets(
    input.domains.filter(
      (d) =>
        d.id !== failed.id &&
        d.routingRole === "backup" &&
        !input.excludedIds?.has(d.id) &&
        isUsableFailoverTarget(d),
    ),
  );
  const target = candidates[0];
  if (!target) return { ok: false, reason: "no_backup_available" };
  return { ok: true, targetDomainId: target.id };
}

export type PresellBindingForFailover = {
  presellId: string;
  bindings: Array<{ customDomainId: string; role: string; priority: number; isActive: boolean }>;
};

/** Failover por presell: primário ligado ao domínio caído → primeiro binding `backup` utilizável. */
export function planPresellFailovers(input: {
  failedDomainId: string;
  presells: PresellBindingForFailover[];
  domainsById: Map<string, FailoverDomain>;
  excludedIds?: ReadonlySet<string>;
}): Array<{ presellId: string; fromDomainId: string; targetDomainId: string }> {
  const plans: Array<{ presellId: string; fromDomainId: string; targetDomainId: string }> = [];
  for (const p of input.presells) {
    const primary = p.bindings.find((b) => b.role === "primary" && b.isActive);
    if (!primary || primary.customDomainId !== input.failedDomainId) continue;
    const backups = p.bindings
      .filter(
        (b) =>
          b.role === "backup" &&
          b.isActive &&
          b.customDomainId !== input.failedDomainId &&
          !input.excludedIds?.has(b.customDomainId),
      )
      .sort((a, b) => a.priority - b.priority);
    const target = backups.find((b) => {
      const d = input.domainsById.get(b.customDomainId);
      return Boolean(d && isUsableFailoverTarget(d));
    });
    if (target) {
      plans.push({ presellId: p.presellId, fromDomainId: primary.customDomainId, targetDomainId: target.customDomainId });
    }
  }
  return plans;
}

export type RoutingEventForRecovery = {
  id: string;
  eventType: DomainRoutingEventType | string;
  scope: string;
  presellId: string | null;
  previousDomainId: string | null;
  targetDomainId: string | null;
  createdAt: Date;
};

const RESOLVING_EVENTS = new Set(["auto_recovery", "manual_swap", "manual_rollback"]);

function scopeKey(ev: { scope: string; presellId: string | null }): string {
  return ev.scope === "presell" && ev.presellId ? `presell:${ev.presellId}` : "domain";
}

/**
 * Recuperações pendentes: `auto_failover` cujo domínio original voltou a estar saudável,
 * passou a janela anti-flapping, tem `autoRecover` ligado e o primário atual ainda é o alvo do failover
 * (se o dono trocou manualmente entretanto, a escolha humana prevalece).
 */
export function planAutoRecoveries(input: {
  events: RoutingEventForRecovery[];
  domainsById: Map<string, FailoverDomain>;
  currentPrimaryByScope: Map<string, string | null>;
  now: Date;
  holdMs: number;
}): Array<{ scope: "domain" | "presell"; presellId: string | null; fromDomainId: string; toDomainId: string; failoverEventId: string }> {
  const sorted = [...input.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const latestFailoverByScope = new Map<string, RoutingEventForRecovery>();
  for (const ev of sorted) {
    const key = scopeKey(ev);
    if (ev.eventType === "auto_failover") latestFailoverByScope.set(key, ev);
    else if (RESOLVING_EVENTS.has(String(ev.eventType))) latestFailoverByScope.delete(key);
  }

  const out: Array<{ scope: "domain" | "presell"; presellId: string | null; fromDomainId: string; toDomainId: string; failoverEventId: string }> = [];
  for (const [key, ev] of latestFailoverByScope) {
    if (!ev.previousDomainId || !ev.targetDomainId) continue;
    if (input.now.getTime() - ev.createdAt.getTime() < input.holdMs) continue;
    const original = input.domainsById.get(ev.previousDomainId);
    if (!original || !original.autoRecover) continue;
    if (original.healthStatus !== "healthy" || !isUsableFailoverTarget(original)) continue;
    const currentPrimary = input.currentPrimaryByScope.get(key) ?? null;
    if (currentPrimary !== ev.targetDomainId) continue;
    out.push({
      scope: key === "domain" ? "domain" : "presell",
      presellId: key === "domain" ? null : ev.presellId,
      fromDomainId: ev.targetDomainId,
      toDomainId: ev.previousDomainId,
      failoverEventId: ev.id,
    });
  }
  return out;
}

const FAILOVER_DOMAIN_SELECT = {
  id: true,
  userId: true,
  hostname: true,
  status: true,
  purpose: true,
  isDefault: true,
  routingRole: true,
  healthStatus: true,
  isActive: true,
  routingPriority: true,
  autoRecover: true,
  httpsReachableCached: true,
  lastHealthError: true,
  lastHealthCheckAt: true,
} as const;

/** Sondagem saudável mais recente do que isto dispensa nova sondagem do destino antes de promover. */
const TARGET_FRESH_MS = 2 * 60_000;

export type ConfirmFailoverTarget = (domain: FailoverDomain) => Promise<boolean>;

/** Confirma ao vivo que o destino responde antes de lhe dar tráfego (evita promover um backup que caiu entretanto). */
export const confirmFailoverTargetLive: ConfirmFailoverTarget = async (d) => {
  const ageMs = Date.now() - (d.lastHealthCheckAt?.getTime() ?? 0);
  // Idade negativa (relógio/fuso desalinhado) não conta como sondagem fresca.
  if (d.healthStatus === "healthy" && ageMs >= 0 && ageMs < TARGET_FRESH_MS) return true;
  if (!d.userId) return false;
  try {
    const r = await runDomainHealthProbeAndUpdate({ domainId: d.id, userId: d.userId });
    return r.ok;
  } catch {
    return false;
  }
};

export type FailoverActionResult = {
  kind: "account_failover" | "presell_failover" | "account_recovery" | "presell_recovery";
  userId: string;
  presellId: string | null;
  fromDomainId: string;
  toDomainId: string;
  fromHostname: string | null;
  toHostname: string | null;
};

/** Executa failover (conta + presells) para um domínio que acabou de ficar `down`. Idempotente. */
export async function executeFailoverForDownDomain(args: {
  userId: string;
  failedDomainId: string;
  reason: string;
  confirmTarget?: ConfirmFailoverTarget;
}): Promise<FailoverActionResult[]> {
  if (!autoFailoverEnabled()) return [];
  const domains = await systemPrisma.customDomain.findMany({
    where: { userId: args.userId },
    select: FAILOVER_DOMAIN_SELECT,
  });
  const byId = new Map(domains.map((d) => [d.id, d]));
  const host = (id: string) => byId.get(id)?.hostname ?? null;
  const results: FailoverActionResult[] = [];

  const confirmTarget = args.confirmTarget ?? confirmFailoverTargetLive;
  const confirmations = new Map<string, boolean>();
  const rejected = new Set<string>();
  const confirm = async (id: string): Promise<boolean> => {
    if (!confirmations.has(id)) {
      const d = byId.get(id);
      const ok = d ? await confirmTarget(d) : false;
      confirmations.set(id, ok);
      if (!ok) rejected.add(id);
    }
    return confirmations.get(id)!;
  };

  let accountPlan = planAccountFailover({ failedDomainId: args.failedDomainId, domains });
  while (accountPlan.ok && !(await confirm(accountPlan.targetDomainId))) {
    accountPlan = planAccountFailover({ failedDomainId: args.failedDomainId, domains, excludedIds: rejected });
  }
  if (accountPlan.ok) {
    try {
      await promotePrimaryDomainForUser({
        userId: args.userId,
        targetDomainId: accountPlan.targetDomainId,
        actorUserId: null,
        automaticEventType: "auto_failover",
        reason: `Failover automático: ${host(args.failedDomainId) ?? "domínio"} indisponível (${args.reason}).`,
        metadata: { failed_domain_id: args.failedDomainId },
      });
      results.push({
        kind: "account_failover",
        userId: args.userId,
        presellId: null,
        fromDomainId: args.failedDomainId,
        toDomainId: accountPlan.targetDomainId,
        fromHostname: host(args.failedDomainId),
        toHostname: host(accountPlan.targetDomainId),
      });
    } catch (err) {
      console.warn("[domainFailover] account failover falhou:", err instanceof Error ? err.message : err);
    }
  }

  const bindings = await systemPrisma.presellDomainBinding.findMany({
    where: { userId: args.userId },
    select: { presellId: true, customDomainId: true, role: true, priority: true, isActive: true },
  });
  const grouped = new Map<string, PresellBindingForFailover>();
  for (const b of bindings) {
    const entry = grouped.get(b.presellId) ?? { presellId: b.presellId, bindings: [] };
    entry.bindings.push(b);
    grouped.set(b.presellId, entry);
  }
  const presellPlans: Array<{ presellId: string; fromDomainId: string; targetDomainId: string }> = [];
  for (const presell of grouped.values()) {
    let plan = planPresellFailovers({ failedDomainId: args.failedDomainId, presells: [presell], domainsById: byId })[0];
    while (plan && !(await confirm(plan.targetDomainId))) {
      plan = planPresellFailovers({
        failedDomainId: args.failedDomainId,
        presells: [presell],
        domainsById: byId,
        excludedIds: rejected,
      })[0];
    }
    if (plan) presellPlans.push(plan);
  }
  for (const plan of presellPlans) {
    try {
      await swapPresellPrimaryDomain({
        userId: args.userId,
        presellId: plan.presellId,
        targetDomainId: plan.targetDomainId,
        actorUserId: null,
        automaticEventType: "auto_failover",
        reason: `Failover automático da presell: ${host(plan.fromDomainId) ?? "domínio"} indisponível.`,
        metadata: { failed_domain_id: plan.fromDomainId },
      });
      results.push({
        kind: "presell_failover",
        userId: args.userId,
        presellId: plan.presellId,
        fromDomainId: plan.fromDomainId,
        toDomainId: plan.targetDomainId,
        fromHostname: host(plan.fromDomainId),
        toHostname: host(plan.targetDomainId),
      });
    } catch (err) {
      console.warn("[domainFailover] presell failover falhou:", plan.presellId, err instanceof Error ? err.message : err);
    }
  }
  return results;
}

/** Procura failovers pendentes de recuperação (últimos 7 dias) e repõe o domínio original quando seguro. */
export async function processPendingAutoRecoveries(now: Date = new Date()): Promise<FailoverActionResult[]> {
  if (!autoFailoverEnabled()) return [];
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const failovers = await systemPrisma.domainRoutingEvent.findMany({
    where: { eventType: "auto_failover", createdAt: { gte: since } },
    select: { userId: true },
    distinct: ["userId"],
    take: 500,
  });
  const results: FailoverActionResult[] = [];
  for (const { userId } of failovers) {
    try {
      results.push(...(await processUserAutoRecoveries(userId, now, since)));
    } catch (err) {
      console.warn("[domainFailover] auto-recovery falhou:", userId, err instanceof Error ? err.message : err);
    }
  }
  return results;
}

async function processUserAutoRecoveries(userId: string, now: Date, since: Date): Promise<FailoverActionResult[]> {
  const [events, domains, primaries] = await Promise.all([
    systemPrisma.domainRoutingEvent.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        eventType: { in: ["auto_failover", "auto_recovery", "manual_swap", "manual_rollback"] },
      },
      select: {
        id: true,
        eventType: true,
        scope: true,
        presellId: true,
        previousDomainId: true,
        targetDomainId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    systemPrisma.customDomain.findMany({ where: { userId }, select: FAILOVER_DOMAIN_SELECT }),
    systemPrisma.presellDomainBinding.findMany({
      where: { userId, role: "primary", isActive: true },
      select: { presellId: true, customDomainId: true },
    }),
  ]);
  const byId = new Map(domains.map((d) => [d.id, d]));
  const currentPrimaryByScope = new Map<string, string | null>();
  currentPrimaryByScope.set(
    "domain",
    domains.find((d) => d.isDefault && String(d.purpose) !== "tracking")?.id ?? null,
  );
  for (const p of primaries) currentPrimaryByScope.set(`presell:${p.presellId}`, p.customDomainId);

  const plans = planAutoRecoveries({
    events,
    domainsById: byId,
    currentPrimaryByScope,
    now,
    holdMs: autoRecoveryHoldMs(),
  });
  const host = (id: string) => byId.get(id)?.hostname ?? null;
  const results: FailoverActionResult[] = [];
  for (const plan of plans) {
    try {
      if (plan.scope === "domain") {
        await promotePrimaryDomainForUser({
          userId,
          targetDomainId: plan.toDomainId,
          actorUserId: null,
          automaticEventType: "auto_recovery",
          reason: `Recuperação automática: ${host(plan.toDomainId) ?? "domínio"} voltou a responder.`,
          metadata: { failover_event_id: plan.failoverEventId },
        });
      } else if (plan.presellId) {
        await swapPresellPrimaryDomain({
          userId,
          presellId: plan.presellId,
          targetDomainId: plan.toDomainId,
          actorUserId: null,
          automaticEventType: "auto_recovery",
          reason: `Recuperação automática da presell: ${host(plan.toDomainId) ?? "domínio"} voltou a responder.`,
          metadata: { failover_event_id: plan.failoverEventId },
        });
      }
      results.push({
        kind: plan.scope === "domain" ? "account_recovery" : "presell_recovery",
        userId,
        presellId: plan.presellId,
        fromDomainId: plan.fromDomainId,
        toDomainId: plan.toDomainId,
        fromHostname: host(plan.fromDomainId),
        toHostname: host(plan.toDomainId),
      });
    } catch (err) {
      console.warn("[domainFailover] recovery falhou:", plan, err instanceof Error ? err.message : err);
    }
  }
  return results;
}
