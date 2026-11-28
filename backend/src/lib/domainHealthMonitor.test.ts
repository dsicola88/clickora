import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  domainMonitorConfigFromEnv,
  healthCheckIntervalFor,
  runDomainHealthMonitorTick,
  runGuardedMonitorTick,
  runWithConcurrency,
  selectDomainsDueForHealthCheck,
  type MonitorCandidate,
  type MonitorConfig,
  type MonitorDeps,
} from "./domainHealthMonitor";
import { evaluateDomainHealthTransition, type DomainHealthProbeResult } from "./domainRoutingService";
import { planAccountFailover, planAutoRecoveries, type FailoverActionResult } from "./domainFailover";
import { getDomainContinuitySnapshot, resetDomainContinuityMetricsForTests } from "./domainContinuityMetrics";

const cfg: MonitorConfig = {
  enabled: true,
  cron: "*/2 * * * *",
  healthyIntervalMs: 10 * 60_000,
  recheckIntervalMs: 2 * 60_000,
  batchSize: 60,
  concurrency: 4,
};

function candidate(id: string, partial: Partial<MonitorCandidate> = {}): MonitorCandidate {
  return { id, userId: "u1", hostname: `${id}.example`, healthStatus: "healthy", lastHealthCheckAt: null, ...partial };
}

function probeResult(partial: Partial<DomainHealthProbeResult> = {}): DomainHealthProbeResult {
  return {
    ok: true,
    healthStatus: "healthy",
    previousStatus: "healthy",
    httpStatus: 200,
    error: null,
    failedLayer: null,
    consecutiveFailures: 0,
    shouldTriggerFailover: false,
    eligibleForAutoRecovery: false,
    ...partial,
  };
}

function fakeDeps(overrides: Partial<MonitorDeps> = {}): MonitorDeps {
  return {
    now: () => new Date("2026-11-28T12:00:00Z"),
    loadCandidates: async () => [],
    claim: async () => true,
    probe: async () => probeResult(),
    failover: async () => [],
    recoveries: async () => [],
    alert: async () => true,
    ...overrides,
  };
}

beforeEach(() => resetDomainContinuityMetricsForTests());

describe("configuração do monitor", () => {
  it("defaults seguros e desligado em NODE_ENV=test salvo opt-in explícito", () => {
    const def = domainMonitorConfigFromEnv({ NODE_ENV: "production" });
    assert.equal(def.enabled, true);
    assert.equal(def.healthyIntervalMs, 10 * 60_000);
    assert.equal(def.recheckIntervalMs, 2 * 60_000);
    assert.equal(def.concurrency, 4);
    assert.equal(domainMonitorConfigFromEnv({ NODE_ENV: "test" }).enabled, false);
    assert.equal(domainMonitorConfigFromEnv({ NODE_ENV: "production", DOMAIN_HEALTH_MONITOR_ENABLED: "false" }).enabled, false);
    const clamped = domainMonitorConfigFromEnv({ DOMAIN_HEALTH_MONITOR_CONCURRENCY: "999", DOMAIN_HEALTH_MONITOR_BATCH: "0" });
    assert.equal(clamped.concurrency, 32);
    assert.equal(clamped.batchSize, 1);
  });

  it("degraded/down são re-sondados mais cedo", () => {
    assert.equal(healthCheckIntervalFor("healthy", cfg), cfg.healthyIntervalMs);
    assert.equal(healthCheckIntervalFor("unknown", cfg), cfg.healthyIntervalMs);
    assert.equal(healthCheckIntervalFor("degraded", cfg), cfg.recheckIntervalMs);
    assert.equal(healthCheckIntervalFor("down", cfg), cfg.recheckIntervalMs);
  });
});

describe("selectDomainsDueForHealthCheck", () => {
  it("nunca sondados primeiro, depois os mais antigos; respeita intervalo por estado e lote", () => {
    const now = new Date("2026-11-28T12:00:00Z");
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    const rows = [
      candidate("fresh", { lastHealthCheckAt: ago(1) }),
      candidate("old", { lastHealthCheckAt: ago(30) }),
      candidate("never"),
      candidate("degraded-recent", { healthStatus: "degraded", lastHealthCheckAt: ago(3) }),
      candidate("down-too-recent", { healthStatus: "down", lastHealthCheckAt: ago(1) }),
    ];
    const due = selectDomainsDueForHealthCheck(rows, now, cfg).map((r) => r.id);
    assert.deepEqual(due, ["never", "old", "degraded-recent"]);
    assert.equal(selectDomainsDueForHealthCheck(rows, now, { ...cfg, batchSize: 1 }).length, 1);
  });
});

describe("runWithConcurrency", () => {
  it("nunca excede o teto e isola erros por item", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);
    const res = await runWithConcurrency(items, 5, async (i) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      if (i % 10 === 0) throw new Error(`boom ${i}`);
      return i * 2;
    });
    assert.ok(peak <= 5);
    assert.equal(res.filter((r) => !r.ok).length, 5);
    assert.equal(res.filter((r) => r.ok).length, 45);
  });
});

describe("runDomainHealthMonitorTick", () => {
  it("alerta na queda, dispara failover e regista métricas", async () => {
    const alerts: string[] = [];
    const failoverCalls: string[] = [];
    const actions: FailoverActionResult[] = [
      { kind: "account_failover", userId: "u1", presellId: null, fromDomainId: "a", toDomainId: "b", fromHostname: "a.example", toHostname: "b.example" },
      { kind: "presell_failover", userId: "u1", presellId: "p1", fromDomainId: "a", toDomainId: "b", fromHostname: "a.example", toHostname: "b.example" },
    ];
    const r = await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("a", { healthStatus: "degraded" })],
        probe: async () =>
          probeResult({
            ok: false,
            previousStatus: "degraded",
            healthStatus: "down",
            error: "HTTP: upstream_5xx",
            failedLayer: "http",
            consecutiveFailures: 3,
            shouldTriggerFailover: true,
          }),
        failover: async (args) => {
          failoverCalls.push(args.failedDomainId);
          return actions;
        },
        alert: async (_u, alert) => {
          alerts.push(alert.kind);
          return true;
        },
      }),
    );
    assert.deepEqual(failoverCalls, ["a"]);
    assert.deepEqual(alerts, ["domain_down", "failover"]);
    assert.equal(r.checked, 1);
    assert.equal(r.failures, 1);
    assert.equal(r.failovers.length, 2);
    const snap = getDomainContinuitySnapshot();
    assert.equal(snap.failovers, 1);
    assert.equal(snap.alerts_sent, 2);
    assert.equal(snap.last_tick?.checked, 1);
  });

  it("failover só corre depois de todas as sondagens do ciclo (destino com estado fresco)", async () => {
    const order: string[] = [];
    await runDomainHealthMonitorTick(
      { ...cfg, concurrency: 1 },
      fakeDeps({
        loadCandidates: async () => [candidate("primary", { healthStatus: "degraded" }), candidate("backup")],
        probe: async (c) => {
          order.push(`probe:${c.id}`);
          return probeResult({
            ok: false,
            previousStatus: c.healthStatus as DomainHealthProbeResult["previousStatus"],
            healthStatus: c.id === "primary" ? "down" : "degraded",
            consecutiveFailures: c.id === "primary" ? 2 : 1,
            shouldTriggerFailover: c.id === "primary",
          });
        },
        failover: async ({ failedDomainId }) => {
          order.push(`failover:${failedDomainId}`);
          return [];
        },
      }),
    );
    assert.deepEqual(order, ["probe:primary", "probe:backup", "failover:primary"]);
  });

  it("failover que rebenta conta como erro e não interrompe o ciclo", async () => {
    const r = await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("a", { healthStatus: "degraded" })],
        probe: async () =>
          probeResult({ ok: false, previousStatus: "degraded", healthStatus: "down", shouldTriggerFailover: true }),
        failover: async () => {
          throw new Error("db offline");
        },
      }),
    );
    assert.equal(r.checked, 1);
    assert.equal(r.errors, 1);
    assert.equal(r.failovers.length, 0);
  });

  it("checks saudáveis repetidos não geram alertas nem failover", async () => {
    let alerts = 0;
    let failovers = 0;
    const r = await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("a"), candidate("b")],
        failover: async () => {
          failovers += 1;
          return [];
        },
        alert: async () => {
          alerts += 1;
          return true;
        },
      }),
    );
    assert.equal(r.checked, 2);
    assert.equal(alerts, 0);
    assert.equal(failovers, 0);
  });

  it("degraded (abaixo do limiar) não alerta nem faz failover", async () => {
    let alerts = 0;
    let failovers = 0;
    await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("a")],
        probe: async () => probeResult({ ok: false, healthStatus: "degraded", previousStatus: "healthy", consecutiveFailures: 1 }),
        failover: async () => {
          failovers += 1;
          return [];
        },
        alert: async () => {
          alerts += 1;
          return true;
        },
      }),
    );
    assert.equal(alerts, 0);
    assert.equal(failovers, 0);
  });

  it("resiliência: probe que rebenta, timeout de alerta e recoveries com erro não param o lote", async () => {
    const r = await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("boom"), candidate("ok1"), candidate("ok2")],
        probe: async (c) => {
          if (c.id === "boom") throw new Error("ECONNRESET");
          return probeResult();
        },
        recoveries: async () => {
          throw new Error("db timeout");
        },
      }),
    );
    assert.equal(r.checked, 2);
    assert.equal(r.errors, 2);
    assert.equal(getDomainContinuitySnapshot().probe_errors, 1);
  });

  it("multi-réplica: domínio já reclamado por outra instância é saltado", async () => {
    let probes = 0;
    const r = await runDomainHealthMonitorTick(
      cfg,
      fakeDeps({
        loadCandidates: async () => [candidate("a"), candidate("b")],
        claim: async (c) => c.id === "a",
        probe: async () => {
          probes += 1;
          return probeResult();
        },
      }),
    );
    assert.equal(probes, 1);
    assert.equal(r.skippedClaim, 1);
  });

  it("guarda de sobreposição: um segundo tick concorrente é ignorado", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const slow = fakeDeps({
      loadCandidates: async () => {
        await gate;
        return [];
      },
    });
    const first = runGuardedMonitorTick(cfg, slow);
    const second = await runGuardedMonitorTick(cfg, slow);
    assert.equal(second, null);
    release();
    assert.ok(await first);
    assert.equal(getDomainContinuitySnapshot().ticks_skipped_overlap, 1);
  });
});

describe("carga: monitor com 2 000 domínios", () => {
  it("processa só o lote, mantém a concorrência e termina rápido com latência simulada", async () => {
    const rows = Array.from({ length: 2_000 }, (_, i) => candidate(`d${i}`, { userId: `u${i % 200}` }));
    let inFlight = 0;
    let peak = 0;
    const loadCfg = { ...cfg, batchSize: 400, concurrency: 16 };
    const started = Date.now();
    const r = await runDomainHealthMonitorTick(
      loadCfg,
      fakeDeps({
        loadCandidates: async () => rows,
        probe: async (c) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((res) => setTimeout(res, 2));
          inFlight -= 1;
          const n = Number(c.id.slice(1));
          return n % 50 === 0
            ? probeResult({ ok: false, healthStatus: "degraded", previousStatus: "healthy", consecutiveFailures: 1 })
            : probeResult();
        },
      }),
    );
    const elapsed = Date.now() - started;
    assert.equal(r.candidates, 400);
    assert.equal(r.checked, 400);
    assert.equal(r.failures, 8);
    assert.ok(peak <= 16, `peak ${peak}`);
    assert.ok(elapsed < 5_000, `tick demorou ${elapsed}ms`);
  });
});

describe("E2E continuidade: queda → failover → recuperação automática", () => {
  it("simula o ciclo completo com estado em memória, sem tocar em anúncios", async () => {
    type Dom = { id: string; isDefault: boolean; routingRole: string; healthStatus: string; consecutiveFailures: number };
    const store: Record<string, Dom> = {
      main: { id: "main", isDefault: true, routingRole: "primary", healthStatus: "healthy", consecutiveFailures: 0 },
      bk: { id: "bk", isDefault: false, routingRole: "backup", healthStatus: "healthy", consecutiveFailures: 0 },
    };
    const events: Array<{ id: string; eventType: string; scope: string; presellId: null; previousDomainId: string; targetDomainId: string; createdAt: Date }> = [];
    const adsMutations: string[] = [];
    let clock = new Date("2026-11-28T12:00:00Z");
    let mainUp = true;

    const asFailover = (d: Dom) => ({
      id: d.id,
      status: "verified",
      purpose: "both",
      isDefault: d.isDefault,
      routingRole: d.routingRole,
      healthStatus: d.healthStatus,
      isActive: true,
      routingPriority: d.isDefault ? 10 : 50,
      autoRecover: true,
    });
    const swapPrimary = (to: string, kind: "auto_failover" | "auto_recovery") => {
      const from = Object.values(store).find((d) => d.isDefault)!;
      from.isDefault = false;
      from.routingRole = "backup";
      store[to]!.isDefault = true;
      store[to]!.routingRole = "primary";
      events.push({ id: `e${events.length}`, eventType: kind, scope: "domain", presellId: null, previousDomainId: from.id, targetDomainId: to, createdAt: clock });
      return { from: from.id, to };
    };

    const deps: MonitorDeps = {
      now: () => clock,
      loadCandidates: async () => [candidate("main", { healthStatus: store.main!.healthStatus })],
      claim: async () => true,
      probe: async () => {
        const d = store.main!;
        const t = evaluateDomainHealthTransition({
          currentStatus: d.healthStatus,
          consecutiveFailures: d.consecutiveFailures,
          autoRecover: true,
          probeOk: mainUp,
          failThreshold: 3,
        });
        const prev = d.healthStatus;
        d.healthStatus = t.nextStatus;
        d.consecutiveFailures = t.consecutiveFailures;
        return probeResult({
          ok: mainUp,
          previousStatus: prev as DomainHealthProbeResult["previousStatus"],
          healthStatus: t.nextStatus,
          consecutiveFailures: t.consecutiveFailures,
          shouldTriggerFailover: t.shouldTriggerFailover,
        });
      },
      failover: async ({ failedDomainId }) => {
        const plan = planAccountFailover({ failedDomainId, domains: Object.values(store).map(asFailover) });
        if (!plan.ok) return [];
        const s = swapPrimary(plan.targetDomainId, "auto_failover");
        return [{ kind: "account_failover", userId: "u1", presellId: null, fromDomainId: s.from, toDomainId: s.to, fromHostname: null, toHostname: null }];
      },
      recoveries: async (now) => {
        const plans = planAutoRecoveries({
          events,
          domainsById: new Map(Object.values(store).map((d) => [d.id, asFailover(d)])),
          currentPrimaryByScope: new Map([["domain", Object.values(store).find((d) => d.isDefault)!.id]]),
          now,
          holdMs: 10 * 60_000,
        });
        return plans.map((p) => {
          const s = swapPrimary(p.toDomainId, "auto_recovery");
          return { kind: "account_recovery" as const, userId: "u1", presellId: null, fromDomainId: s.from, toDomainId: s.to, fromHostname: null, toHostname: null };
        });
      },
      alert: async () => true,
    };
    const tick = async (minutes: number) => {
      clock = new Date(clock.getTime() + minutes * 60_000);
      return runDomainHealthMonitorTick(cfg, deps);
    };

    mainUp = false;
    assert.equal((await tick(2)).failovers.length, 0); // 1 falha → degraded
    assert.equal((await tick(2)).failovers.length, 0); // 2 falhas → degraded
    const third = await tick(2); // 3 falhas → down → failover
    assert.equal(third.failovers.length, 1);
    assert.equal(store.bk!.isDefault, true);
    assert.equal((await tick(2)).failovers.length, 0); // idempotente: continua down, sem 2.º failover

    mainUp = true;
    const backUp = await tick(2); // healthy de novo, mas dentro da janela anti-flapping
    assert.equal(backUp.recoveries.length, 0);
    assert.equal(store.bk!.isDefault, true);

    const recovered = await tick(10); // passou a janela → recupera
    assert.equal(recovered.recoveries.length, 1);
    assert.equal(store.main!.isDefault, true);
    assert.equal((await tick(2)).recoveries.length, 0); // não repete

    assert.deepEqual(
      events.map((e) => e.eventType),
      ["auto_failover", "auto_recovery"],
    );
    assert.equal(adsMutations.length, 0);
    const snap = getDomainContinuitySnapshot();
    assert.equal(snap.failovers, 1);
    assert.equal(snap.recoveries, 1);
    assert.equal(snap.failover_latency.samples, 1);
  });
});
