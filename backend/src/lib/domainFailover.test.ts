import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoFailoverEnabled,
  autoRecoveryHoldMs,
  confirmFailoverTargetLive,
  planAccountFailover,
  planAutoRecoveries,
  planPresellFailovers,
  type FailoverDomain,
  type RoutingEventForRecovery,
} from "./domainFailover";

function dom(partial: Partial<FailoverDomain> & { id: string }): FailoverDomain {
  return {
    status: "verified",
    purpose: "both",
    isDefault: false,
    routingRole: "standby",
    healthStatus: "healthy",
    isActive: true,
    routingPriority: 100,
    autoRecover: true,
    ...partial,
  };
}

describe("planAccountFailover", () => {
  it("promove o melhor backup explícito quando o principal da conta está down", () => {
    const domains = [
      dom({ id: "main", isDefault: true, routingRole: "primary", healthStatus: "down" }),
      dom({ id: "bk-degraded", routingRole: "backup", healthStatus: "degraded", routingPriority: 10 }),
      dom({ id: "bk-healthy", routingRole: "backup", healthStatus: "healthy", routingPriority: 50 }),
      dom({ id: "standby", routingRole: "standby", healthStatus: "healthy", routingPriority: 1 }),
    ];
    const plan = planAccountFailover({ failedDomainId: "main", domains });
    assert.deepEqual(plan, { ok: true, targetDomainId: "bk-healthy" });
  });

  it("é opt-in: sem domínios com papel backup não há failover (standby nunca é alvo)", () => {
    const domains = [
      dom({ id: "main", isDefault: true, healthStatus: "down" }),
      dom({ id: "standby", routingRole: "standby" }),
    ];
    assert.deepEqual(planAccountFailover({ failedDomainId: "main", domains }), {
      ok: false,
      reason: "no_backup_available",
    });
  });

  it("ignora backups pausados, por verificar, só-tracking ou também down", () => {
    const domains = [
      dom({ id: "main", isDefault: true, healthStatus: "down" }),
      dom({ id: "paused", routingRole: "backup", isActive: false }),
      dom({ id: "pending", routingRole: "backup", status: "pending" }),
      dom({ id: "trk", routingRole: "backup", purpose: "tracking" }),
      dom({ id: "down", routingRole: "backup", healthStatus: "down" }),
    ];
    assert.equal(planAccountFailover({ failedDomainId: "main", domains }).ok, false);
  });

  it("falha simultânea: backups degradados, por sondar, com SSL falhado ou down nunca são promovidos", () => {
    const domains = [
      dom({ id: "main", isDefault: true, routingRole: "primary", healthStatus: "down" }),
      dom({ id: "bk-degraded", routingRole: "backup", healthStatus: "degraded", routingPriority: 1 }),
      dom({ id: "bk-unknown", routingRole: "backup", healthStatus: "unknown", routingPriority: 2 }),
      dom({ id: "bk-down", routingRole: "backup", healthStatus: "down", routingPriority: 3 }),
      dom({
        id: "bk-ssl",
        routingRole: "backup",
        healthStatus: "unknown",
        httpsReachableCached: false,
        routingPriority: 4,
      }),
    ];
    assert.deepEqual(planAccountFailover({ failedDomainId: "main", domains }), {
      ok: false,
      reason: "no_backup_available",
    });
  });

  it("destino rejeitado pela confirmação ao vivo é excluído e passa ao seguinte", () => {
    const domains = [
      dom({ id: "main", isDefault: true, routingRole: "primary", healthStatus: "down" }),
      dom({ id: "bk1", routingRole: "backup", routingPriority: 10 }),
      dom({ id: "bk2", routingRole: "backup", routingPriority: 20 }),
    ];
    assert.deepEqual(planAccountFailover({ failedDomainId: "main", domains, excludedIds: new Set(["bk1"]) }), {
      ok: true,
      targetDomainId: "bk2",
    });
    assert.equal(
      planAccountFailover({ failedDomainId: "main", domains, excludedIds: new Set(["bk1", "bk2"]) }).ok,
      false,
    );
  });

  it("não age quando o domínio caído não é o principal da conta ou ainda não está down", () => {
    const domains = [
      dom({ id: "secondary", healthStatus: "down" }),
      dom({ id: "main", isDefault: true, healthStatus: "degraded" }),
      dom({ id: "bk", routingRole: "backup" }),
    ];
    assert.deepEqual(planAccountFailover({ failedDomainId: "secondary", domains }), {
      ok: false,
      reason: "not_account_primary",
    });
    assert.deepEqual(planAccountFailover({ failedDomainId: "main", domains }), { ok: false, reason: "not_down" });
  });
});

describe("planPresellFailovers", () => {
  it("move só presells cujo primário é o domínio caído e que têm backup utilizável", () => {
    const domainsById = new Map(
      [
        dom({ id: "a", healthStatus: "down" }),
        dom({ id: "b" }),
        dom({ id: "c", healthStatus: "down" }),
        dom({ id: "d" }),
      ].map((d) => [d.id, d]),
    );
    const plans = planPresellFailovers({
      failedDomainId: "a",
      domainsById,
      presells: [
        {
          presellId: "p1",
          bindings: [
            { customDomainId: "a", role: "primary", priority: 10, isActive: true },
            { customDomainId: "c", role: "backup", priority: 20, isActive: true },
            { customDomainId: "b", role: "backup", priority: 30, isActive: true },
          ],
        },
        {
          presellId: "p2",
          bindings: [
            { customDomainId: "d", role: "primary", priority: 10, isActive: true },
            { customDomainId: "b", role: "backup", priority: 20, isActive: true },
          ],
        },
        {
          presellId: "p3",
          bindings: [{ customDomainId: "a", role: "primary", priority: 10, isActive: true }],
        },
        {
          presellId: "p4",
          bindings: [
            { customDomainId: "a", role: "primary", priority: 10, isActive: true },
            { customDomainId: "d", role: "backup", priority: 20, isActive: false },
          ],
        },
      ],
    });
    assert.deepEqual(plans, [{ presellId: "p1", fromDomainId: "a", targetDomainId: "b" }]);
  });

  it("primário e todos os backups em falha → nenhuma promoção (fica no estado atual)", () => {
    const domainsById = new Map(
      [
        dom({ id: "a", healthStatus: "down" }),
        dom({ id: "b", healthStatus: "degraded" }),
        dom({ id: "c", healthStatus: "down" }),
        dom({ id: "d", healthStatus: "unknown" }),
      ].map((d) => [d.id, d]),
    );
    const plans = planPresellFailovers({
      failedDomainId: "a",
      domainsById,
      presells: [
        {
          presellId: "p1",
          bindings: [
            { customDomainId: "a", role: "primary", priority: 10, isActive: true },
            { customDomainId: "b", role: "backup", priority: 20, isActive: true },
            { customDomainId: "c", role: "backup", priority: 30, isActive: true },
            { customDomainId: "d", role: "backup", priority: 40, isActive: true },
          ],
        },
      ],
    });
    assert.deepEqual(plans, []);
  });

  it("backup excluído pela confirmação ao vivo passa ao seguinte binding", () => {
    const domainsById = new Map([dom({ id: "a", healthStatus: "down" }), dom({ id: "b" }), dom({ id: "c" })].map((d) => [d.id, d]));
    const presells = [
      {
        presellId: "p1",
        bindings: [
          { customDomainId: "a", role: "primary", priority: 10, isActive: true },
          { customDomainId: "b", role: "backup", priority: 20, isActive: true },
          { customDomainId: "c", role: "backup", priority: 30, isActive: true },
        ],
      },
    ];
    assert.deepEqual(planPresellFailovers({ failedDomainId: "a", domainsById, presells, excludedIds: new Set(["b"]) }), [
      { presellId: "p1", fromDomainId: "a", targetDomainId: "c" },
    ]);
  });
});

describe("planAutoRecoveries", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  const hold = 10 * 60_000;
  const ev = (partial: Partial<RoutingEventForRecovery> & { id: string; minutesAgo: number }): RoutingEventForRecovery => ({
    eventType: "auto_failover",
    scope: "domain",
    presellId: null,
    previousDomainId: "main",
    targetDomainId: "bk",
    createdAt: new Date(now.getTime() - partial.minutesAgo * 60_000),
    ...partial,
  });

  it("repõe o domínio original quando voltou saudável, passou a janela e o primário ainda é o backup", () => {
    const domainsById = new Map([dom({ id: "main" }), dom({ id: "bk", routingRole: "primary" })].map((d) => [d.id, d]));
    const plans = planAutoRecoveries({
      events: [ev({ id: "e1", minutesAgo: 30 })],
      domainsById,
      currentPrimaryByScope: new Map([["domain", "bk"]]),
      now,
      holdMs: hold,
    });
    assert.deepEqual(plans, [
      { scope: "domain", presellId: null, fromDomainId: "bk", toDomainId: "main", failoverEventId: "e1" },
    ]);
  });

  it("anti-flapping: dentro da janela não recupera", () => {
    const domainsById = new Map([dom({ id: "main" }), dom({ id: "bk" })].map((d) => [d.id, d]));
    assert.equal(
      planAutoRecoveries({
        events: [ev({ id: "e1", minutesAgo: 3 })],
        domainsById,
        currentPrimaryByScope: new Map([["domain", "bk"]]),
        now,
        holdMs: hold,
      }).length,
      0,
    );
  });

  it("respeita autoRecover=false, domínio ainda não saudável e escolha manual posterior", () => {
    const base = { now, holdMs: hold, currentPrimaryByScope: new Map([["domain", "bk"]]) };
    assert.equal(
      planAutoRecoveries({
        ...base,
        events: [ev({ id: "e1", minutesAgo: 30 })],
        domainsById: new Map([dom({ id: "main", autoRecover: false }), dom({ id: "bk" })].map((d) => [d.id, d])),
      }).length,
      0,
    );
    assert.equal(
      planAutoRecoveries({
        ...base,
        events: [ev({ id: "e1", minutesAgo: 30 })],
        domainsById: new Map([dom({ id: "main", healthStatus: "degraded" }), dom({ id: "bk" })].map((d) => [d.id, d])),
      }).length,
      0,
    );
    // Dono trocou manualmente depois do failover → a escolha humana prevalece.
    assert.equal(
      planAutoRecoveries({
        ...base,
        events: [
          ev({ id: "e1", minutesAgo: 30 }),
          ev({ id: "e2", minutesAgo: 20, eventType: "manual_swap", previousDomainId: "bk", targetDomainId: "other" }),
        ],
        domainsById: new Map([dom({ id: "main" }), dom({ id: "bk" })].map((d) => [d.id, d])),
      }).length,
      0,
    );
    // Primário atual já não é o alvo do failover (ex.: setDefault manual) → não mexe.
    assert.equal(
      planAutoRecoveries({
        ...base,
        currentPrimaryByScope: new Map([["domain", "other"]]),
        events: [ev({ id: "e1", minutesAgo: 30 })],
        domainsById: new Map([dom({ id: "main" }), dom({ id: "bk" })].map((d) => [d.id, d])),
      }).length,
      0,
    );
  });

  it("recuperação já feita (auto_recovery posterior) não se repete; escopos de presell são independentes", () => {
    const domainsById = new Map([dom({ id: "main" }), dom({ id: "bk" })].map((d) => [d.id, d]));
    const plans = planAutoRecoveries({
      events: [
        ev({ id: "e1", minutesAgo: 60 }),
        ev({ id: "e2", minutesAgo: 40, eventType: "auto_recovery", previousDomainId: "bk", targetDomainId: "main" }),
        ev({ id: "e3", minutesAgo: 30, scope: "presell", presellId: "p1" }),
      ],
      domainsById,
      currentPrimaryByScope: new Map([
        ["domain", "main"],
        ["presell:p1", "bk"],
      ]),
      now,
      holdMs: hold,
    });
    assert.deepEqual(plans, [
      { scope: "presell", presellId: "p1", fromDomainId: "bk", toDomainId: "main", failoverEventId: "e3" },
    ]);
  });

  it("anti-flapping conta desde a última falha do original, não desde o failover", () => {
    const domainsById = new Map([dom({ id: "main" }), dom({ id: "bk" })].map((d) => [d.id, d]));
    const run = (failMinutesAgo: number) =>
      planAutoRecoveries({
        events: [ev({ id: "e1", minutesAgo: 60 })],
        domainsById,
        currentPrimaryByScope: new Map([["domain", "bk"]]),
        now,
        holdMs: hold,
        lastFailureAtByDomain: new Map([["main", new Date(now.getTime() - failMinutesAgo * 60_000)]]),
      }).length;
    assert.equal(run(4), 0);
    assert.equal(run(15), 1);
  });

  it("failovers em cadeia recuperam para o primário original; voltar ao original encerra o incidente", () => {
    const domainsById = new Map([dom({ id: "main" }), dom({ id: "bk" }), dom({ id: "c" })].map((d) => [d.id, d]));
    const chained = planAutoRecoveries({
      events: [
        ev({ id: "e1", minutesAgo: 60 }),
        ev({ id: "e2", minutesAgo: 40, previousDomainId: "bk", targetDomainId: "c" }),
      ],
      domainsById,
      currentPrimaryByScope: new Map([["domain", "c"]]),
      now,
      holdMs: hold,
    });
    assert.deepEqual(chained, [
      { scope: "domain", presellId: null, fromDomainId: "c", toDomainId: "main", failoverEventId: "e2" },
    ]);
    const backToOrigin = planAutoRecoveries({
      events: [
        ev({ id: "e1", minutesAgo: 60 }),
        ev({ id: "e2", minutesAgo: 40, previousDomainId: "bk", targetDomainId: "main" }),
      ],
      domainsById,
      currentPrimaryByScope: new Map([["domain", "main"]]),
      now,
      holdMs: hold,
    });
    assert.equal(backToOrigin.length, 0);
  });
});

describe("confirmFailoverTargetLive", () => {
  type ProbeFn = NonNullable<Parameters<typeof confirmFailoverTargetLive>[1]>;

  it("sonda sempre ao vivo, mesmo com lastHealthCheckAt recente (claim do monitor não prova saúde)", async () => {
    const calls: string[] = [];
    const probe = (async (args: { domainId: string }) => {
      calls.push(args.domainId);
      return { ok: false };
    }) as unknown as ProbeFn;
    const fresh = dom({ id: "bk", userId: "u1", routingRole: "backup", healthStatus: "healthy", lastHealthCheckAt: new Date() });
    assert.equal(await confirmFailoverTargetLive(fresh, probe), false);
    assert.deepEqual(calls, ["bk"]);
  });

  it("sem userId ou com erro na sonda → não confirma", async () => {
    const throwing = (async () => {
      throw new Error("boom");
    }) as unknown as ProbeFn;
    assert.equal(await confirmFailoverTargetLive(dom({ id: "x" }), throwing), false);
    assert.equal(await confirmFailoverTargetLive(dom({ id: "x", userId: "u1" }), throwing), false);
  });
});

describe("configuração de failover", () => {
  it("failover ativo por omissão e desligável por env; janela de recuperação 10 min (1–1440)", () => {
    assert.equal(autoFailoverEnabled({}), true);
    assert.equal(autoFailoverEnabled({ DOMAIN_AUTO_FAILOVER_ENABLED: "false" }), false);
    assert.equal(autoRecoveryHoldMs({}), 10 * 60_000);
    assert.equal(autoRecoveryHoldMs({ DOMAIN_AUTO_RECOVERY_HOLD_MINUTES: "0" }), 60_000);
    assert.equal(autoRecoveryHoldMs({ DOMAIN_AUTO_RECOVERY_HOLD_MINUTES: "99999" }), 24 * 60 * 60_000);
  });
});
