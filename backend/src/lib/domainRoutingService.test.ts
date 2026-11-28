import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkHostnameClaim,
  pickReplacementPrimaryDomain,
  domainFailThresholdFromEnv,
  domainHealthHttpTimeoutMsFromEnv,
  evaluateDomainHealthTransition,
  probeDomainHttpWithRetry,
  isRequestHostAllowedForPresellBindings,
  planPrimaryDomainSwap,
  planRollbackTarget,
  selectAuthorizedDomainForPresell,
  type RoutingDomainCandidate,
  type PresellBindingCandidate,
} from "./domainRoutingService";

function makeDomain(partial: Partial<RoutingDomainCandidate> & { id: string; hostname: string }): RoutingDomainCandidate {
  return {
    userId: "u1",
    status: "verified",
    purpose: "both",
    isDefault: false,
    isDefaultTracking: false,
    routingRole: "backup",
    healthStatus: "healthy",
    consecutiveFailures: 0,
    autoRecover: true,
    isActive: true,
    routingPriority: 100,
    vercelDomainRegistered: false,
    httpsReachableCached: true,
    ...partial,
  };
}

describe("selectAuthorizedDomainForPresell", () => {
  it("escolhe domínio primary saudável e ativo", () => {
    const domains = [
      makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", isDefault: true }),
      makeDomain({ id: "d2", hostname: "b.example", routingRole: "backup" }),
    ];
    const bindings: PresellBindingCandidate[] = [
      { customDomainId: "d1", role: "primary", priority: 10, isActive: true },
      { customDomainId: "d2", role: "backup", priority: 20, isActive: true },
    ];
    const res = selectAuthorizedDomainForPresell({ domains, bindings, legacyCustomDomainId: "d1" });
    assert.equal(res.domain?.id, "d1");
    assert.equal(res.usedFailover, false);
  });

  it("faz failover determinístico para backup saudável quando primary está down ou desativado", () => {
    const domains = [
      makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", healthStatus: "down" }),
      makeDomain({ id: "d2", hostname: "b.example", routingRole: "backup", healthStatus: "healthy" }),
      makeDomain({ id: "d3", hostname: "c.example", routingRole: "backup", healthStatus: "healthy" }),
    ];
    const bindings: PresellBindingCandidate[] = [
      { customDomainId: "d1", role: "primary", priority: 10, isActive: true },
      { customDomainId: "d3", role: "backup", priority: 50, isActive: true },
      { customDomainId: "d2", role: "backup", priority: 20, isActive: true },
    ];
    const res = selectAuthorizedDomainForPresell({ domains, bindings, legacyCustomDomainId: "d1" });
    assert.equal(res.domain?.id, "d2");
    assert.equal(res.usedFailover, true);
  });

  it("ignora domínios tracking-only, pendentes, inativos ou standby no roteamento de presell", () => {
    const domains = [
      makeDomain({ id: "d1", hostname: "go.example", purpose: "tracking", routingRole: "primary" }),
      makeDomain({ id: "d2", hostname: "pend.example", status: "pending", routingRole: "backup" }),
      makeDomain({ id: "d3", hostname: "off.example", isActive: false, routingRole: "backup" }),
      makeDomain({ id: "d4", hostname: "standby.example", routingRole: "standby" }),
      makeDomain({ id: "d5", hostname: "ok.example", purpose: "hosting", routingRole: "backup" }),
    ];
    const bindings: PresellBindingCandidate[] = [
      { customDomainId: "d1", role: "primary", priority: 10, isActive: true },
      { customDomainId: "d2", role: "backup", priority: 20, isActive: true },
      { customDomainId: "d3", role: "backup", priority: 30, isActive: true },
      { customDomainId: "d4", role: "standby", priority: 40, isActive: true },
      { customDomainId: "d5", role: "backup", priority: 50, isActive: true },
    ];
    const res = selectAuthorizedDomainForPresell({ domains, bindings });
    assert.equal(res.domain?.id, "d5");
  });

  it("bindings todos indisponíveis → cai para o domínio padrão da conta (nunca pior que o legado)", () => {
    const domains = [
      makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", healthStatus: "down" }),
      makeDomain({ id: "d2", hostname: "b.example", routingRole: "primary", isDefault: true }),
      makeDomain({ id: "d3", hostname: "c.example", routingRole: "standby" }),
    ];
    const bindings: PresellBindingCandidate[] = [{ customDomainId: "d1", role: "primary", priority: 10, isActive: true }];
    const res = selectAuthorizedDomainForPresell({ domains, bindings, legacyCustomDomainId: "d1" });
    assert.equal(res.domain?.id, "d2");
    assert.equal(res.usedFailover, true);
    assert.equal(res.reason, "account_fallback");
  });

  it("sem nenhum domínio utilizável na conta → none_available", () => {
    const domains = [makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", healthStatus: "down" })];
    const res = selectAuthorizedDomainForPresell({
      domains,
      bindings: [{ customDomainId: "d1", role: "primary", priority: 10, isActive: true }],
    });
    assert.equal(res.domain, null);
    assert.equal(res.reason, "none_available");
  });

  it("mantém compatibilidade com presell legada sem bindings usando legacyCustomDomainId / default", () => {
    const domains = [
      makeDomain({ id: "d1", hostname: "a.example", isDefault: true, routingRole: "primary" }),
      makeDomain({ id: "d2", hostname: "b.example", isDefault: false, routingRole: "backup" }),
    ];
    const res = selectAuthorizedDomainForPresell({
      domains,
      bindings: [],
      legacyCustomDomainId: "d2",
    });
    assert.equal(res.domain?.id, "d2");
    assert.equal(res.usedFailover, false);
  });
});

describe("evaluateDomainHealthTransition", () => {
  it("passa healthy -> degraded (1 falha) -> down (2+ falhas) -> healthy (auto-recovery)", () => {
    const f1 = evaluateDomainHealthTransition({
      currentStatus: "healthy",
      consecutiveFailures: 0,
      autoRecover: true,
      probeOk: false,
      error: "HTTP 502",
      failThreshold: 2,
    });
    assert.equal(f1.nextStatus, "degraded");
    assert.equal(f1.consecutiveFailures, 1);
    assert.equal(f1.shouldTriggerFailover, false);
    assert.equal(f1.eventType, "health_check_degraded");

    const f2 = evaluateDomainHealthTransition({
      currentStatus: f1.nextStatus,
      consecutiveFailures: f1.consecutiveFailures,
      autoRecover: true,
      probeOk: false,
      error: "HTTP 502",
      failThreshold: 2,
    });
    assert.equal(f2.nextStatus, "down");
    assert.equal(f2.consecutiveFailures, 2);
    assert.equal(f2.shouldTriggerFailover, true);
    assert.equal(f2.eventType, "health_check_failed");

    const rec = evaluateDomainHealthTransition({
      currentStatus: f2.nextStatus,
      consecutiveFailures: f2.consecutiveFailures,
      autoRecover: true,
      probeOk: true,
    });
    assert.equal(rec.nextStatus, "healthy");
    assert.equal(rec.consecutiveFailures, 0);
    assert.equal(rec.recoveredFromFailure, true);
    assert.equal(rec.eligibleForAutoRecovery, true);
    assert.equal(rec.eventType, "health_check_passed");
  });

  it("limiar por omissão é 3 falhas e configurável por env (1–20)", () => {
    assert.equal(domainFailThresholdFromEnv({}), 3);
    assert.equal(domainFailThresholdFromEnv({ DOMAIN_HEALTH_FAIL_THRESHOLD: "5" }), 5);
    assert.equal(domainFailThresholdFromEnv({ DOMAIN_HEALTH_FAIL_THRESHOLD: "0" }), 1);
    assert.equal(domainFailThresholdFromEnv({ DOMAIN_HEALTH_FAIL_THRESHOLD: "999" }), 20);
    assert.equal(domainFailThresholdFromEnv({ DOMAIN_HEALTH_FAIL_THRESHOLD: "x" }), 3);
    const twoFails = evaluateDomainHealthTransition({
      currentStatus: "degraded",
      consecutiveFailures: 1,
      autoRecover: true,
      probeOk: false,
    });
    assert.equal(twoFails.nextStatus, "degraded");
  });

  it("recuperação de degraded não é elegível para auto-recovery de routing (só de down)", () => {
    const rec = evaluateDomainHealthTransition({
      currentStatus: "degraded",
      consecutiveFailures: 1,
      autoRecover: true,
      probeOk: true,
    });
    assert.equal(rec.recoveredFromFailure, true);
    assert.equal(rec.eligibleForAutoRecovery, false);
  });
});

describe("planPrimaryDomainSwap & planRollbackTarget & binding host check", () => {
  it("planeia swap de primary para backup saudável e rollback para o domínio anterior", () => {
    const d1 = makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", isDefault: true });
    const d2 = makeDomain({ id: "d2", hostname: "b.example", routingRole: "backup", healthStatus: "healthy" });
    const dDown = makeDomain({ id: "d3", hostname: "c.example", routingRole: "backup", healthStatus: "down" });

    const swap = planPrimaryDomainSwap({ currentPrimary: d1, target: d2, scope: "hosting" });
    assert.equal(swap.ok, true);
    if (swap.ok) {
      assert.equal(swap.previousDomainId, "d1");
      assert.equal(swap.targetDomainId, "d2");
    }

    const badSwap = planPrimaryDomainSwap({ currentPrimary: d1, target: dDown, scope: "hosting" });
    assert.equal(badSwap.ok, false);

    const rb = planRollbackTarget({
      currentPrimaryId: "d2",
      events: [
        { eventType: "manual_swap", previousDomainId: "d1", targetDomainId: "d2" },
      ],
      domains: [d1, d2],
    });
    assert.equal(rb.ok, true);
    if (rb.ok) assert.equal(rb.targetDomainId, "d1");
  });

  it("rollback após failover + recuperação automática volta ao backup (troca mais recente), não ao domínio antigo", () => {
    const x = makeDomain({ id: "x", hostname: "x.example" });
    const p = makeDomain({ id: "p", hostname: "p.example", routingRole: "primary", isDefault: true });
    const b = makeDomain({ id: "b", hostname: "b.example" });
    const events = [
      { eventType: "auto_recovery", previousDomainId: "b", targetDomainId: "p" },
      { eventType: "health_check_passed", previousDomainId: null, targetDomainId: null },
      { eventType: "auto_failover", previousDomainId: "p", targetDomainId: "b" },
      { eventType: "manual_swap", previousDomainId: "x", targetDomainId: "p" },
    ];
    const rb = planRollbackTarget({ currentPrimaryId: "p", events, domains: [x, p, b] });
    assert.deepEqual(rb, { ok: true, targetDomainId: "b" });
  });

  it("rollback só considera a troca mais recente: se ela já aponta para o atual, não salta para trocas antigas", () => {
    const x = makeDomain({ id: "x", hostname: "x.example" });
    const p = makeDomain({ id: "p", hostname: "p.example", routingRole: "primary", isDefault: true });
    const rb = planRollbackTarget({
      currentPrimaryId: "p",
      events: [
        { eventType: "manual_swap", previousDomainId: "p", targetDomainId: "p" },
        { eventType: "manual_swap", previousDomainId: "x", targetDomainId: "p" },
      ],
      domains: [x, p],
    });
    assert.equal(rb.ok, false);
  });

  it("checkHostnameClaim bloqueia a variante www/apex de outra conta e permite a própria", () => {
    const existing = [{ hostname: "marca.example", userId: "userA" }];
    assert.deepEqual(checkHostnameClaim({ hostname: "www.marca.example", userId: "userB", existing }), {
      ok: false,
      reason: "variant_other",
      conflictHostname: "marca.example",
    });
    assert.deepEqual(checkHostnameClaim({ hostname: "www.marca.example", userId: "userA", existing }), { ok: true });
    assert.equal(
      (checkHostnameClaim({ hostname: "marca.example", userId: "userB", existing }) as { reason?: string }).reason,
      "taken_other",
    );
    assert.equal(
      (checkHostnameClaim({ hostname: "MARCA.example", userId: "userA", existing }) as { reason?: string }).reason,
      "taken_self",
    );
    assert.deepEqual(checkHostnameClaim({ hostname: "lp.marca.example", userId: "userB", existing }), { ok: true });
  });

  it("pickReplacementPrimaryDomain: só verificado/ativo/não-down/hosting, saudável primeiro", () => {
    const pending = makeDomain({ id: "pending", hostname: "p.example", status: "pending" });
    const paused = makeDomain({ id: "paused", hostname: "pa.example", isActive: false });
    const down = makeDomain({ id: "down", hostname: "d.example", healthStatus: "down" });
    const tracking = makeDomain({ id: "trk", hostname: "t.example", purpose: "tracking" });
    const unknown = makeDomain({ id: "unknown", hostname: "u.example", healthStatus: "unknown", routingPriority: 1 });
    const healthy = makeDomain({ id: "healthy", hostname: "h.example", healthStatus: "healthy", routingPriority: 100 });
    assert.equal(pickReplacementPrimaryDomain([pending, paused, down, tracking, unknown, healthy])?.id, "healthy");
    assert.equal(pickReplacementPrimaryDomain([pending, paused, down, tracking, unknown])?.id, "unknown");
    assert.equal(pickReplacementPrimaryDomain([pending, paused, down, tracking]), null);
  });

  it("swap manual recusa destino degradado ou sem HTTPS (SSL inválido/expirado) com motivo claro", () => {
    const d1 = makeDomain({ id: "d1", hostname: "a.example", routingRole: "primary", isDefault: true });
    const degraded = makeDomain({
      id: "d2",
      hostname: "b.example",
      healthStatus: "degraded",
      lastHealthError: "SSL/TLS: certificado ou edge mal configurado.",
    });
    const sslBroken = makeDomain({ id: "d3", hostname: "c.example", healthStatus: "unknown", httpsReachableCached: false });
    const fresh = makeDomain({ id: "d4", hostname: "d.example", healthStatus: "unknown", httpsReachableCached: null });

    const r1 = planPrimaryDomainSwap({ currentPrimary: d1, target: degraded, scope: "hosting" });
    assert.equal(r1.ok, false);
    if (!r1.ok) {
      assert.match(r1.error, /degradado/);
      assert.match(r1.error, /SSL\/TLS/);
    }
    const r2 = planPrimaryDomainSwap({ currentPrimary: d1, target: sslBroken, scope: "hosting" });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.match(r2.error, /HTTPS/);
    // Domínio novo ainda por sondar e sem falha de HTTPS registada: escolha explícita do dono é permitida.
    assert.equal(planPrimaryDomainSwap({ currentPrimary: d1, target: fresh, scope: "hosting" }).ok, true);
  });

  it("rollback para domínio offline, degradado ou com SSL falhado é recusado sem alterar estado", () => {
    const current = makeDomain({ id: "cur", hostname: "now.example", routingRole: "primary", isDefault: true });
    const events = [{ eventType: "auto_failover", previousDomainId: "old", targetDomainId: "cur" }];
    const cases: Array<[Partial<RoutingDomainCandidate>, RegExp]> = [
      [{ healthStatus: "down", lastHealthError: "DNS: ENOTFOUND" }, /indisponível \(down\).*ENOTFOUND/],
      [{ healthStatus: "degraded" }, /degradado/],
      [{ healthStatus: "unknown", httpsReachableCached: false }, /SSL inválido, expirado/],
    ];
    for (const [partial, re] of cases) {
      const old = makeDomain({ id: "old", hostname: "old.example", ...partial });
      const rb = planRollbackTarget({ currentPrimaryId: "cur", events, domains: [current, old] });
      assert.equal(rb.ok, false);
      if (!rb.ok) {
        assert.match(rb.error, /^Rollback recusado: o domínio anterior \(old\.example\)/);
        assert.match(rb.error, re);
        assert.match(rb.error, /O domínio atual mantém-se\.$/);
      }
    }
  });

  it("isRequestHostAllowedForPresellBindings nunca bloqueia Final URLs em outros domínios do dono", () => {
    assert.equal(
      isRequestHostAllowedForPresellBindings({
        requestHost: "anything.example",
        bindings: [],
      }),
      true,
    );

    const bindings = [
      { hostname: "bound-ok.example", isActive: true, domainIsActive: true, domainStatus: "verified" as const },
      { hostname: "paused-domain.example", isActive: true, domainIsActive: false, domainStatus: "verified" as const },
      { hostname: "disabled-binding.example", isActive: false, domainIsActive: true, domainStatus: "verified" as const },
    ];
    assert.equal(
      isRequestHostAllowedForPresellBindings({ requestHost: "www.bound-ok.example", bindings }),
      true,
    );
    // Domínio pausado na conta: sai do routing, mas continua a servir (Final URL já publicada).
    assert.equal(
      isRequestHostAllowedForPresellBindings({ requestHost: "paused-domain.example", bindings }),
      true,
    );
    // Outro domínio verificado do dono sem binding (ex.: Final URL antiga no Ads) continua a abrir.
    assert.equal(
      isRequestHostAllowedForPresellBindings({ requestHost: "other-owner-domain.example", bindings }),
      true,
    );
    // Só a desativação explícita do binding para esta presell recusa o host.
    assert.equal(
      isRequestHostAllowedForPresellBindings({ requestHost: "disabled-binding.example", bindings }),
      false,
    );
  });
});

describe("sonda HTTP de saúde — timeout e nova tentativa", () => {
  it("timeout por defeito 8 s, configurável e limitado a 1–30 s", () => {
    assert.equal(domainHealthHttpTimeoutMsFromEnv({}), 8_000);
    assert.equal(domainHealthHttpTimeoutMsFromEnv({ DOMAIN_HEALTH_HTTP_TIMEOUT_MS: "5000" }), 5_000);
    assert.equal(domainHealthHttpTimeoutMsFromEnv({ DOMAIN_HEALTH_HTTP_TIMEOUT_MS: "100" }), 1_000);
    assert.equal(domainHealthHttpTimeoutMsFromEnv({ DOMAIN_HEALTH_HTTP_TIMEOUT_MS: "999999" }), 30_000);
    assert.equal(domainHealthHttpTimeoutMsFromEnv({ DOMAIN_HEALTH_HTTP_TIMEOUT_MS: "abc" }), 8_000);
  });

  function scriptedProbe(results: Array<{ healthy: boolean; status: number | null; reason?: string }>) {
    const calls: Array<{ url: string; timeoutMs?: number; bypassCache?: boolean }> = [];
    const probe = async (url: string, opts?: { timeoutMs?: number; bypassCache?: boolean }) => {
      calls.push({ url, timeoutMs: opts?.timeoutMs, bypassCache: opts?.bypassCache });
      return results[Math.min(calls.length - 1, results.length - 1)]!;
    };
    return { probe, calls };
  }

  it("timeout pontual seguido de sucesso conta como saudável", async () => {
    const { probe, calls } = scriptedProbe([
      { healthy: false, status: null, reason: "timeout" },
      { healthy: true, status: 200 },
    ]);
    const r = await probeDomainHttpWithRetry("https://a.test/", 8_000, probe);
    assert.equal(r.healthy, true);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.timeoutMs === 8_000 && c.bypassCache === true));
  });

  it("erro de rede repetido continua a falhar (sem mascarar domínio em baixo)", async () => {
    const { probe, calls } = scriptedProbe([{ healthy: false, status: null, reason: "network" }]);
    const r = await probeDomainHttpWithRetry("https://a.test/", 8_000, probe);
    assert.equal(r.healthy, false);
    assert.equal(calls.length, 2);
  });

  it("resposta HTTP 5xx não repete", async () => {
    const { probe, calls } = scriptedProbe([{ healthy: false, status: 503, reason: "http_503" }]);
    const r = await probeDomainHttpWithRetry("https://a.test/", 8_000, probe);
    assert.equal(r.healthy, false);
    assert.equal(calls.length, 1);
  });

  it("sucesso à primeira não repete", async () => {
    const { probe, calls } = scriptedProbe([{ healthy: true, status: 200 }]);
    await probeDomainHttpWithRetry("https://a.test/", 8_000, probe);
    assert.equal(calls.length, 1);
  });
});
