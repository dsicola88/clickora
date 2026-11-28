/**
 * Etapa 2 — monitorização contínua de DNS, SSL e HTTP dos domínios verificados, com alertas.
 * Etapa 3 — dispara failover automático após falhas consecutivas e processa auto-recovery.
 *
 * Seguro em múltiplas réplicas: cada check é "reclamado" com um UPDATE condicional em
 * `last_health_check_at`, por isso dois processos nunca sondam o mesmo domínio no mesmo intervalo.
 * Só observa e muda o domínio canónico do painel — nunca altera HTML servido nem anúncios.
 */
import cron from "node-cron";
import { systemPrisma } from "./prisma";
import {
  runDomainHealthProbeAndUpdate,
  type DomainHealthProbeResult,
} from "./domainRoutingService";
import {
  executeFailoverForDownDomain,
  processPendingAutoRecoveries,
  type FailoverActionResult,
} from "./domainFailover";
import {
  decideDomainHealthAlert,
  dispatchDomainContinuityAlert,
  type DomainContinuityAlert,
} from "./domainContinuityAlerts";
import {
  recordAlertSent,
  recordFailover,
  recordProbeError,
  recordProbeOutcome,
  recordRecovery,
  recordTick,
  recordTickSkippedOverlap,
} from "./domainContinuityMetrics";

export type MonitorConfig = {
  enabled: boolean;
  cron: string;
  healthyIntervalMs: number;
  recheckIntervalMs: number;
  batchSize: number;
  concurrency: number;
};

function intEnv(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(raw?.trim() || "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function domainMonitorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MonitorConfig {
  const flag = env.DOMAIN_HEALTH_MONITOR_ENABLED?.trim().toLowerCase();
  const enabled = flag ? flag !== "false" : env.NODE_ENV !== "test";
  return {
    enabled,
    cron: env.DOMAIN_HEALTH_MONITOR_CRON?.trim() || "*/2 * * * *",
    healthyIntervalMs: intEnv(env.DOMAIN_HEALTH_CHECK_INTERVAL_MIN, 10, 1, 24 * 60) * 60_000,
    recheckIntervalMs: intEnv(env.DOMAIN_HEALTH_RECHECK_INTERVAL_MIN, 2, 1, 60) * 60_000,
    batchSize: intEnv(env.DOMAIN_HEALTH_MONITOR_BATCH, 60, 1, 1_000),
    concurrency: intEnv(env.DOMAIN_HEALTH_MONITOR_CONCURRENCY, 4, 1, 32),
  };
}

export type MonitorCandidate = {
  id: string;
  userId: string;
  hostname: string;
  healthStatus: string;
  lastHealthCheckAt: Date | null;
};

/** Intervalo por estado: degradado/em baixo é re-sondado mais cedo para confirmar queda ou recuperação. */
export function healthCheckIntervalFor(status: string, cfg: Pick<MonitorConfig, "healthyIntervalMs" | "recheckIntervalMs">): number {
  return status === "degraded" || status === "down" ? cfg.recheckIntervalMs : cfg.healthyIntervalMs;
}

/** Seleciona os domínios vencidos (mais antigos primeiro; nunca sondados à frente), limitado ao lote. */
export function selectDomainsDueForHealthCheck(
  rows: MonitorCandidate[],
  now: Date,
  cfg: Pick<MonitorConfig, "healthyIntervalMs" | "recheckIntervalMs" | "batchSize">,
): MonitorCandidate[] {
  const due = rows.filter((r) => {
    if (!r.lastHealthCheckAt) return true;
    return now.getTime() - r.lastHealthCheckAt.getTime() >= healthCheckIntervalFor(r.healthStatus, cfg);
  });
  due.sort((a, b) => {
    const ta = a.lastHealthCheckAt?.getTime() ?? 0;
    const tb = b.lastHealthCheckAt?.getTime() ?? 0;
    return ta - tb;
  });
  return due.slice(0, cfg.batchSize);
}

/** Executa tarefas com teto de concorrência; erros individuais não interrompem o lote. */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  let next = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        try {
          results[i] = { ok: true, value: await worker(items[i]!) };
        } catch (error) {
          results[i] = { ok: false, error };
        }
      }
    }),
  );
  return results;
}

export type MonitorDeps = {
  now: () => Date;
  loadCandidates: () => Promise<MonitorCandidate[]>;
  claim: (candidate: MonitorCandidate, cutoff: Date) => Promise<boolean>;
  probe: (candidate: MonitorCandidate) => Promise<DomainHealthProbeResult>;
  failover: (args: { userId: string; failedDomainId: string; reason: string }) => Promise<FailoverActionResult[]>;
  recoveries: (now: Date) => Promise<FailoverActionResult[]>;
  alert: (userId: string, alert: DomainContinuityAlert) => Promise<boolean>;
};

const defaultDeps: MonitorDeps = {
  now: () => new Date(),
  loadCandidates: async () =>
    systemPrisma.customDomain.findMany({
      where: { status: "verified", isActive: true },
      select: { id: true, userId: true, hostname: true, healthStatus: true, lastHealthCheckAt: true },
      orderBy: [{ lastHealthCheckAt: { sort: "asc", nulls: "first" } }],
      take: 5_000,
    }),
  claim: async (candidate, cutoff) => {
    const r = await systemPrisma.customDomain.updateMany({
      where: {
        id: candidate.id,
        OR: [{ lastHealthCheckAt: null }, { lastHealthCheckAt: { lt: cutoff } }],
      },
      data: { lastHealthCheckAt: new Date() },
    });
    return r.count === 1;
  },
  probe: (candidate) => runDomainHealthProbeAndUpdate({ domainId: candidate.id, userId: candidate.userId }),
  failover: executeFailoverForDownDomain,
  recoveries: processPendingAutoRecoveries,
  alert: dispatchDomainContinuityAlert,
};

export type MonitorTickResult = {
  candidates: number;
  checked: number;
  failures: number;
  skippedClaim: number;
  errors: number;
  alerts: number;
  failovers: FailoverActionResult[];
  recoveries: FailoverActionResult[];
  durationMs: number;
};

function groupActions(actions: FailoverActionResult[], kinds: FailoverActionResult["kind"][]) {
  const groups = new Map<string, FailoverActionResult[]>();
  for (const a of actions) {
    if (!kinds.includes(a.kind)) continue;
    const key = `${a.userId}:${a.kind.endsWith("failover") ? a.fromDomainId : a.toDomainId}`;
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  return [...groups.values()];
}

export async function runDomainHealthMonitorTick(
  cfg: MonitorConfig = domainMonitorConfigFromEnv(),
  deps: MonitorDeps = defaultDeps,
): Promise<MonitorTickResult> {
  const started = Date.now();
  const now = deps.now();
  const all = await deps.loadCandidates();
  const due = selectDomainsDueForHealthCheck(all, now, cfg);

  let checked = 0;
  let failures = 0;
  let skippedClaim = 0;
  let errors = 0;
  let alerts = 0;
  const failovers: FailoverActionResult[] = [];
  /** Failovers só depois de todas as sondagens do ciclo: o destino escolhido já reflete o estado deste tick. */
  const pendingFailovers: Array<{ candidate: MonitorCandidate; reason: string }> = [];

  await runWithConcurrency(due, cfg.concurrency, async (candidate) => {
    const cutoff = new Date(now.getTime() - healthCheckIntervalFor(candidate.healthStatus, cfg) + 1_000);
    try {
      if (!(await deps.claim(candidate, cutoff))) {
        skippedClaim += 1;
        return;
      }
      const t0 = Date.now();
      const result = await deps.probe(candidate);
      checked += 1;
      recordProbeOutcome(candidate.id, result.ok, Date.now() - t0);
      if (!result.ok) failures += 1;

      const healthAlert = decideDomainHealthAlert({
        previousStatus: result.previousStatus,
        nextStatus: result.healthStatus,
      });
      if (healthAlert === "domain_down") {
        if (await deps.alert(candidate.userId, {
          kind: "domain_down",
          domainId: candidate.id,
          hostname: candidate.hostname,
          error: result.error,
          failedLayer: result.failedLayer,
        })) {
          alerts += 1;
          recordAlertSent();
        }
      } else if (healthAlert === "domain_recovered") {
        if (await deps.alert(candidate.userId, {
          kind: "domain_recovered",
          domainId: candidate.id,
          hostname: candidate.hostname,
        })) {
          alerts += 1;
          recordAlertSent();
        }
      }

      if (result.shouldTriggerFailover && result.healthStatus === "down") {
        pendingFailovers.push({ candidate, reason: result.error || "falhas consecutivas" });
      }
    } catch (err) {
      errors += 1;
      recordProbeError();
      console.warn(
        "[domain-monitor] check falhou:",
        candidate.hostname,
        err instanceof Error ? err.message : err,
      );
    }
  });

  for (const { candidate, reason } of pendingFailovers) {
    try {
      const actions = await deps.failover({ userId: candidate.userId, failedDomainId: candidate.id, reason });
      if (actions.length > 0) {
        recordFailover(candidate.id);
        failovers.push(...actions);
      }
    } catch (err) {
      errors += 1;
      console.warn(
        "[domain-monitor] failover falhou:",
        candidate.hostname,
        err instanceof Error ? err.message : err,
      );
    }
  }

  let recoveries: FailoverActionResult[] = [];
  try {
    recoveries = await deps.recoveries(now);
    for (let i = 0; i < recoveries.length; i++) recordRecovery();
  } catch (err) {
    errors += 1;
    console.warn("[domain-monitor] auto-recovery falhou:", err instanceof Error ? err.message : err);
  }

  for (const group of groupActions(failovers, ["account_failover", "presell_failover"])) {
    const first = group[0]!;
    if (await deps.alert(first.userId, {
      kind: "failover",
      domainId: first.fromDomainId,
      fromHostname: first.fromHostname,
      toHostname: group.find((a) => a.kind === "account_failover")?.toHostname ?? first.toHostname,
      presellCount: group.filter((a) => a.kind === "presell_failover").length,
      accountLevel: group.some((a) => a.kind === "account_failover"),
    }).catch(() => false)) {
      alerts += 1;
      recordAlertSent();
    }
  }
  for (const group of groupActions(recoveries, ["account_recovery", "presell_recovery"])) {
    const first = group[0]!;
    if (await deps.alert(first.userId, {
      kind: "recovery",
      domainId: first.toDomainId,
      fromHostname: first.fromHostname,
      toHostname: first.toHostname,
      presellCount: group.filter((a) => a.kind === "presell_recovery").length,
      accountLevel: group.some((a) => a.kind === "account_recovery"),
    }).catch(() => false)) {
      alerts += 1;
      recordAlertSent();
    }
  }

  const durationMs = Date.now() - started;
  recordTick({
    durationMs,
    candidates: due.length,
    checked,
    failures,
    skippedClaim,
    errors,
    alerts,
    failovers: failovers.length,
    recoveries: recoveries.length,
  });
  return { candidates: due.length, checked, failures, skippedClaim, errors, alerts, failovers, recoveries, durationMs };
}

let tickInFlight = false;

/** Guarda de sobreposição: um tick lento nunca corre em paralelo com o seguinte no mesmo processo. */
export async function runGuardedMonitorTick(
  cfg: MonitorConfig = domainMonitorConfigFromEnv(),
  deps: MonitorDeps = defaultDeps,
): Promise<MonitorTickResult | null> {
  if (tickInFlight) {
    recordTickSkippedOverlap();
    return null;
  }
  tickInFlight = true;
  try {
    return await runDomainHealthMonitorTick(cfg, deps);
  } finally {
    tickInFlight = false;
  }
}

export function registerDomainHealthMonitor(): cron.ScheduledTask | null {
  const cfg = domainMonitorConfigFromEnv();
  if (!cfg.enabled) {
    console.info("[domain-monitor] desativado (DOMAIN_HEALTH_MONITOR_ENABLED=false)");
    return null;
  }
  const expr = cron.validate(cfg.cron) ? cfg.cron : "*/2 * * * *";
  const task = cron.schedule(
    expr,
    async () => {
      try {
        const r = await runGuardedMonitorTick(cfg);
        if (r && (r.checked > 0 || r.errors > 0)) {
          console.log(
            "[domain-monitor] tick",
            JSON.stringify({
              checked: r.checked,
              failures: r.failures,
              errors: r.errors,
              alerts: r.alerts,
              failovers: r.failovers.length,
              recoveries: r.recoveries.length,
              duration_ms: r.durationMs,
            }),
          );
        }
      } catch (e) {
        console.error("[domain-monitor] tick_error", e instanceof Error ? e.message : e);
      }
    },
    { timezone: "UTC", name: "domain-health-monitor" },
  );
  console.info(
    `[domain-monitor] cron «${expr}» · intervalo ${cfg.healthyIntervalMs / 60_000}min · re-check ${cfg.recheckIntervalMs / 60_000}min · lote ${cfg.batchSize} · concorrência ${cfg.concurrency}`,
  );
  return task;
}
