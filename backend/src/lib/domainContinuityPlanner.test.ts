import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPresellRisk,
  computeUptimeFromTransitions,
  extractPresellRefFromPath,
  planFinalUrlContinuitySuggestion,
  type ContinuityDomain,
  type ContinuityPresellInfo,
  type PresellPathRef,
} from "./domainContinuityPlanner";

const now = new Date("2026-11-28T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("computeUptimeFromTransitions", () => {
  it("sem eventos usa o estado atual (unknown → null)", () => {
    const base = { events: [], windowStart: hoursAgo(24), now };
    assert.equal(computeUptimeFromTransitions({ ...base, currentStatus: "healthy" }), 1);
    assert.equal(computeUptimeFromTransitions({ ...base, currentStatus: "down" }), 0);
    assert.equal(computeUptimeFromTransitions({ ...base, currentStatus: "unknown" }), null);
  });

  it("conta só o tempo em down (degraded conta como disponível)", () => {
    const uptime = computeUptimeFromTransitions({
      windowStart: hoursAgo(24),
      now,
      currentStatus: "healthy",
      events: [
        { createdAt: hoursAgo(12), eventType: "health_check_degraded", metadata: { previous_status: "healthy", next_status: "degraded" } },
        { createdAt: hoursAgo(11), eventType: "health_check_failed", metadata: { previous_status: "degraded", next_status: "down" } },
        { createdAt: hoursAgo(5), eventType: "health_check_failed", metadata: { previous_status: "down", next_status: "down" } },
        { createdAt: hoursAgo(5), eventType: "health_check_passed", metadata: { previous_status: "down", next_status: "healthy" } },
      ],
    });
    assert.equal(uptime, 0.75);
  });

  it("queda ainda em curso conta até agora; eventos antigos sem metadata usam o tipo", () => {
    const uptime = computeUptimeFromTransitions({
      windowStart: hoursAgo(10),
      now,
      currentStatus: "down",
      events: [{ createdAt: hoursAgo(5), eventType: "health_check_failed" }],
    });
    assert.equal(uptime, 0.5);
  });
});

describe("extractPresellRefFromPath", () => {
  it("reconhece raiz, slug, /p/ e /l/", () => {
    assert.deepEqual(extractPresellRefFromPath("/"), { kind: "root" });
    assert.deepEqual(extractPresellRefFromPath("/oferta-vision"), { kind: "slug", value: "oferta-vision" });
    assert.deepEqual(extractPresellRefFromPath("/p/minha-presell"), { kind: "slug", value: "minha-presell" });
    assert.deepEqual(extractPresellRefFromPath("/l/0F8FAD5B-D9CB-469F-A165-70867728950E"), {
      kind: "id",
      value: "0f8fad5b-d9cb-469f-a165-70867728950e",
    });
    assert.equal(extractPresellRefFromPath("/api/track/r/x"), null);
    assert.equal(extractPresellRefFromPath("/a/b/c"), null);
  });
});

describe("planFinalUrlContinuitySuggestion", () => {
  const domains: ContinuityDomain[] = [
    { id: "main", hostname: "main.example", status: "verified", purpose: "both", isActive: true, healthStatus: "down" },
    { id: "bk", hostname: "backup.example", status: "verified", purpose: "hosting", isActive: true, healthStatus: "healthy" },
    { id: "paused", hostname: "paused.example", status: "verified", purpose: "both", isActive: false, healthStatus: "healthy" },
    { id: "trk", hostname: "go.example", status: "verified", purpose: "tracking", isActive: true, healthStatus: "healthy" },
  ];
  const presells: Record<string, ContinuityPresellInfo> = {
    "visiflo": { id: "p1", title: "Visiflo", status: "published", canonicalDomainId: "bk" },
    "draft-page": { id: "p2", title: "Rascunho", status: "draft", canonicalDomainId: "bk" },
  };
  const resolvePresell = (ref: PresellPathRef) => (ref.kind === "slug" ? presells[ref.value] ?? null : null);
  const plan = (finalUrl: string, accountCanonicalDomainId: string | null = "bk") =>
    planFinalUrlContinuitySuggestion({
      finalUrl,
      domains,
      accountCanonicalDomainId,
      resolvePresell,
      isPlatformHost: (h) => h === "dclickora.com" || h === "www.dclickora.com",
    });

  it("domínio down → crítico, sugere o mesmo path/query no domínio canónico e remove gclid", () => {
    const s = plan("https://main.example/visiflo?utm_source=google&gclid=abc123");
    assert.ok(s);
    assert.equal(s.issue, "domain_down");
    assert.equal(s.severity, "critical");
    assert.equal(s.presellId, "p1");
    assert.equal(s.suggestedHost, "backup.example");
    assert.equal(s.suggestedUrl, "https://backup.example/visiflo?utm_source=google");
  });

  it("domínio pausado → aviso; host desconhecido → aviso; nunca sugere domínio só de tracking", () => {
    const paused = plan("https://paused.example/visiflo");
    assert.equal(paused?.issue, "domain_paused");
    assert.equal(paused?.suggestedHost, "backup.example");
    const unknown = plan("https://antigo-removido.example/visiflo");
    assert.equal(unknown?.issue, "unknown_host");
    assert.notEqual(unknown?.suggestedHost, "go.example");
  });

  it("nunca sugere destino degradado; `unknown` só na falta de domínio saudável", () => {
    const base: ContinuityDomain[] = [
      { id: "main", hostname: "main.example", status: "verified", purpose: "both", isActive: true, healthStatus: "down" },
      { id: "deg", hostname: "deg.example", status: "verified", purpose: "both", isActive: true, healthStatus: "degraded" },
    ];
    const run = (domains: ContinuityDomain[], canonical: string) =>
      planFinalUrlContinuitySuggestion({
        finalUrl: "https://main.example/visiflo?utm_source=google",
        domains,
        accountCanonicalDomainId: canonical,
        resolvePresell: (ref) => (ref.kind === "slug" ? { id: "p1", title: "V", status: "published", canonicalDomainId: canonical } : null),
        isPlatformHost: () => false,
      });
    const onlyDegraded = run(base, "deg");
    assert.equal(onlyDegraded?.issue, "domain_down");
    assert.equal(onlyDegraded?.suggestedUrl, null);

    const withUnknown = run(
      [...base, { id: "new", hostname: "new.example", status: "verified", purpose: "both", isActive: true, healthStatus: "unknown" }],
      "deg",
    );
    assert.equal(withUnknown?.suggestedHost, "new.example");

    const withHealthy = run(
      [
        ...base,
        { id: "new", hostname: "new.example", status: "verified", purpose: "both", isActive: true, healthStatus: "unknown" },
        { id: "ok", hostname: "ok.example", status: "verified", purpose: "both", isActive: true, healthStatus: "healthy" },
      ],
      "deg",
    );
    assert.equal(withHealthy?.suggestedHost, "ok.example");
  });

  it("presell não publicada → crítico sem sugestão de host (é a página que tem de ser publicada)", () => {
    const s = plan("https://backup.example/draft-page");
    assert.equal(s?.issue, "presell_unpublished");
    assert.equal(s?.suggestedUrl, null);
  });

  it("domínio down com caminho de presell inexistente → sem Final URL inventada (não sugere 404)", () => {
    const s = plan("https://main.example/slug-que-nao-existe?gclid=abc");
    assert.equal(s?.issue, "domain_down");
    assert.equal(s?.presellId, null);
    assert.equal(s?.suggestedUrl, null);
  });

  it("URL saudável e canónica → sem sugestão; plataforma principal e URLs inválidas são ignoradas", () => {
    assert.equal(plan("https://backup.example/visiflo"), null);
    assert.equal(plan("https://www.dclickora.com/p/abc"), null);
    assert.equal(plan("not a url"), null);
    assert.equal(plan("javascript:alert(1)"), null);
  });

  it("domínio saudável mas não canónico (após failover) → informativo, a página continua a servir", () => {
    const healthyDomains = domains.map((d) => (d.id === "main" ? { ...d, healthStatus: "healthy" } : d));
    const s = planFinalUrlContinuitySuggestion({
      finalUrl: "https://main.example/visiflo",
      domains: healthyDomains,
      accountCanonicalDomainId: "bk",
      resolvePresell,
      isPlatformHost: () => false,
    });
    assert.equal(s?.issue, "not_canonical");
    assert.equal(s?.severity, "info");
    assert.equal(s?.suggestedUrl, "https://backup.example/visiflo");
  });

  it("sem domínio de destino utilizável não inventa URL", () => {
    const onlyDown: ContinuityDomain[] = [
      { id: "main", hostname: "main.example", status: "verified", purpose: "both", isActive: true, healthStatus: "down" },
    ];
    const s = planFinalUrlContinuitySuggestion({
      finalUrl: "https://main.example/x",
      domains: onlyDown,
      accountCanonicalDomainId: "main",
      resolvePresell: () => null,
      isPlatformHost: () => false,
    });
    assert.equal(s?.issue, "domain_down");
    assert.equal(s?.suggestedUrl, null);
  });
});

describe("classifyPresellRisk", () => {
  it("primário configurado em baixo é risco mesmo havendo backup selecionado", () => {
    assert.equal(
      classifyPresellRisk({ hasSelectedDomain: true, primary: { healthStatus: "down", isActive: true }, usedFailover: true }),
      "primary_down",
    );
  });
  it("sem domínio utilizável → no_domain tem prioridade", () => {
    assert.equal(
      classifyPresellRisk({ hasSelectedDomain: false, primary: { healthStatus: "down", isActive: true }, usedFailover: false }),
      "no_domain",
    );
  });
  it("primário pausado, a servir pelo backup e saudável", () => {
    assert.equal(
      classifyPresellRisk({ hasSelectedDomain: true, primary: { healthStatus: "healthy", isActive: false }, usedFailover: true }),
      "primary_paused",
    );
    assert.equal(
      classifyPresellRisk({ hasSelectedDomain: true, primary: { healthStatus: "healthy", isActive: true }, usedFailover: true }),
      "on_backup",
    );
    assert.equal(
      classifyPresellRisk({ hasSelectedDomain: true, primary: { healthStatus: "healthy", isActive: true }, usedFailover: false }),
      "ok",
    );
    assert.equal(classifyPresellRisk({ hasSelectedDomain: true, primary: null, usedFailover: false }), "ok");
  });
});
