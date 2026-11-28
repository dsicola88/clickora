import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  decideDomainHealthAlert,
  domainAlertsEnabled,
  formatDomainContinuityAlert,
  resetAlertCooldownsForTests,
  shouldSendAlertNow,
} from "./domainContinuityAlerts";
import {
  probeDomainDns,
  shouldRecordHealthEvent,
  summarizeDomainProbeLayers,
} from "./domainRoutingService";

beforeEach(() => resetAlertCooldownsForTests());

describe("decideDomainHealthAlert", () => {
  it("só alerta na entrada em down e na saída de down", () => {
    assert.equal(decideDomainHealthAlert({ previousStatus: "degraded", nextStatus: "down" }), "domain_down");
    assert.equal(decideDomainHealthAlert({ previousStatus: "healthy", nextStatus: "down" }), "domain_down");
    assert.equal(decideDomainHealthAlert({ previousStatus: "down", nextStatus: "down" }), null);
    assert.equal(decideDomainHealthAlert({ previousStatus: "down", nextStatus: "healthy" }), "domain_recovered");
    assert.equal(decideDomainHealthAlert({ previousStatus: "healthy", nextStatus: "degraded" }), null);
    assert.equal(decideDomainHealthAlert({ previousStatus: "degraded", nextStatus: "healthy" }), null);
  });
});

describe("cooldown e configuração", () => {
  it("cooldown por domínio/tipo evita tempestade de alertas em flapping", () => {
    const t0 = 1_000_000;
    assert.equal(shouldSendAlertNow("d1:domain_down", t0), true);
    assert.equal(shouldSendAlertNow("d1:domain_down", t0 + 60_000), false);
    assert.equal(shouldSendAlertNow("d1:domain_recovered", t0 + 60_000), true);
    assert.equal(shouldSendAlertNow("d2:domain_down", t0 + 60_000), true);
    assert.equal(shouldSendAlertNow("d1:domain_down", t0 + 31 * 60_000), true);
  });

  it("alertas ligados por omissão e desligáveis por env", () => {
    assert.equal(domainAlertsEnabled({}), true);
    assert.equal(domainAlertsEnabled({ DOMAIN_HEALTH_ALERTS_ENABLED: "false" }), false);
  });
});

describe("formatDomainContinuityAlert", () => {
  it("lembra sempre que os anúncios não foram alterados", () => {
    const down = formatDomainContinuityAlert({
      kind: "domain_down",
      domainId: "d1",
      hostname: "main.example",
      error: "HTTP: upstream_5xx",
      failedLayer: "http",
    });
    assert.match(down.subject, /main\.example/);
    assert.ok(down.lines.some((l) => /não foram alterados/.test(l)));
    const failover = formatDomainContinuityAlert({
      kind: "failover",
      domainId: "d1",
      fromHostname: "main.example",
      toHostname: "backup.example",
      presellCount: 2,
      accountLevel: true,
    });
    assert.match(failover.subject, /main\.example → backup\.example/);
    assert.ok(failover.lines.some((l) => /Sem redirects nem cloaking/.test(l)));
    assert.ok(failover.lines.some((l) => /não foram alterados/.test(l)));
  });
});

describe("camadas DNS → SSL → HTTP", () => {
  it("a primeira camada que falha explica o erro", () => {
    const http = { healthy: true, status: 200, reason: null };
    assert.deepEqual(
      summarizeDomainProbeLayers({ dns: { ok: false, error: "ENOTFOUND" }, ssl: null, http }),
      { ok: false, failedLayer: "dns", error: "DNS: ENOTFOUND" },
    );
    assert.equal(
      summarizeDomainProbeLayers({
        dns: { ok: true, error: null },
        ssl: { httpsReachable: false, vercelMisconfigured: null },
        http,
      }).failedLayer,
      "ssl",
    );
    assert.equal(
      summarizeDomainProbeLayers({
        dns: { ok: true, error: null },
        ssl: { httpsReachable: true, vercelMisconfigured: false },
        http: { healthy: false, status: 503, reason: "upstream_5xx" },
      }).error,
      "HTTP: upstream_5xx",
    );
    assert.deepEqual(
      summarizeDomainProbeLayers({ dns: { ok: true, error: null }, ssl: null, http }),
      { ok: true, failedLayer: null, error: null },
    );
  });

  it("histórico compacto: grava falhas, transições e checks manuais; ignora healthy→healthy automático", () => {
    assert.equal(shouldRecordHealthEvent({ previousStatus: "healthy", nextStatus: "healthy", probeOk: true, manual: false }), false);
    assert.equal(shouldRecordHealthEvent({ previousStatus: "healthy", nextStatus: "healthy", probeOk: true, manual: true }), true);
    assert.equal(shouldRecordHealthEvent({ previousStatus: "down", nextStatus: "healthy", probeOk: true, manual: false }), true);
    assert.equal(shouldRecordHealthEvent({ previousStatus: "degraded", nextStatus: "degraded", probeOk: false, manual: false }), true);
  });

  it("probeDomainDns aceita qualquer registo A/AAAA/CNAME e devolve o código de erro", async () => {
    const enotfound = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    const ok = await probeDomainDns("www.example.com", {
      resolve4: async () => [],
      resolve6: async () => {
        throw enotfound;
      },
      resolveCname: async () => ["cname.vercel-dns.com"],
    } as never);
    assert.deepEqual(ok, { ok: true, error: null });
    const fail = await probeDomainDns("gone.example", {
      resolve4: async () => {
        throw enotfound;
      },
      resolve6: async () => {
        throw enotfound;
      },
      resolveCname: async () => {
        throw enotfound;
      },
    } as never);
    assert.deepEqual(fail, { ok: false, error: "ENOTFOUND" });
  });
});
