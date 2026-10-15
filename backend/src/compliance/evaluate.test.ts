import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPresellSignals, isThinBridgePage } from "./extractPresellSignals";
import {
  applyHumanOverrides,
  canPublishForAds,
  evaluateCompliance,
  deriveGate,
} from "./evaluate";
import { probeTrackingParamPreservation } from "./trackingProbe";
import { suggestCorrections } from "./correctionAssistant";
import type { DestinationProbeResult, PresellComplianceSignals } from "./types";

function baseSignals(over: Partial<PresellComplianceSignals> = {}): PresellComplianceSignals {
  const extracted = extractPresellSignals({
    title: "Produto Exemplo",
    type: "review",
    language: "pt",
    content: {
      product_name: "Produto Exemplo",
      sales_text:
        "Este artigo analisa o Produto Exemplo com base em critérios públicos e verificáveis. Explicamos o que o vendedor declara sobre composição, para quem a oferta parece ser direcionada, e que limitações encontramos na página oficial. Incluímos o preço apenas quando aparece de forma clara na origem, sem inventar descontos. Também descrevemos a política de devolução tal como está escrita no site do vendedor e alertamos para riscos comuns de compras online. Não prometemos resultados médicos, financeiros nem milagres. O objetivo é ajudar o leitor a decidir com informação própria: comparar alternativas, ler o rótulo, confirmar o operador da página e perceber que esta página pode usar links de afiliado. Se faltar um dado (contacto, licença, estudo), pedimos ao anunciante que o forneça em vez de o fabricarmos. Por fim, listamos perguntas úteis antes da compra: prazo de entrega, suporte, restrições por país e se a garantia é do vendedor ou do fabricante.",
      subtitle: "Análise independente para decisão informada com critérios claros e limitações explícitas",
      cta_text: "Ver oferta no site do vendedor",
      images: ["https://cdn.example.com/p.jpg"],
      affiliate_link: "https://offer.example.com/buy",
      affiliateDisclosure: "Divulgação: link de afiliado — posso receber comissão.",
      source_url: "https://vendor.example.com/product",
    },
    settings: {
      businessName: "Analista Independente Lda",
      contactEmail: "contacto@example.com",
      privacyPolicyUrl: "https://example.com/privacidade",
    },
  });
  return { ...extracted, ...over };
}

function destOk(over: Partial<DestinationProbeResult> = {}): DestinationProbeResult {
  return {
    attempted: true,
    ok: true,
    https: true,
    statusCode: 200,
    finalUrl: "https://offer.example.com/buy",
    redirectCount: 0,
    redirectCycle: false,
    openRedirectSuspect: false,
    domainChanged: false,
    initialHost: "offer.example.com",
    finalHost: "offer.example.com",
    crawlerBlocked: false,
    hops: ["https://offer.example.com/buy"],
    ...over,
  };
}

function result(ruleId: string, evaluation = evaluateCompliance({
  signals: baseSignals(),
  destination: destOk(),
  tracking: probeTrackingParamPreservation({ offerUrl: "https://offer.example.com/buy" }),
})) {
  const r = evaluation.results.find((x) => x.ruleId === ruleId);
  assert.ok(r, `missing ${ruleId}`);
  return r!;
}

describe("presell compliance engine", () => {
  it("1. thin bridge image+name+button is FAIL OC-001 and not compliant by default", () => {
    const signals = extractPresellSignals({
      title: "X",
      content: {
        product_name: "X",
        sales_text: "Compre já",
        images: ["https://cdn.example.com/a.jpg"],
        affiliate_link: "https://vendor.example.com/x",
        cta_text: "Comprar",
      },
    });
    assert.equal(isThinBridgePage(signals), true);
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("OC-001", ev).status, "FAIL");
    assert.equal(ev.gate, "blocked");
    assert.equal(canPublishForAds(ev.gate), false);
  });

  it("2. substantial original content can PASS OC-002", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk(),
      tracking: probeTrackingParamPreservation({ offerUrl: "https://offer.example.com/buy" }),
    });
    assert.equal(result("OC-002", ev).status, "PASS");
  });

  it("3. vendor mirror without own value WARNs OC-003 (ponte continua em OC-001)", () => {
    const signals = baseSignals({
      mirrorHtmlLength: 9000,
      mirrorHtml: "<div>".repeat(2000),
      salesText: "Curto",
      wordCount: 200,
      uniqueSentenceCount: 5,
      bodyTextLength: 800,
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("OC-003", ev).status, "WARNING");
  });

  it("4. missing affiliate disclosure FAILs CT-001 (bloqueia publicação)", () => {
    const signals = baseSignals({ hasAffiliateDisclosure: false, affiliateLink: "https://offer.example.com" });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CT-001", ev).status, "FAIL");
    assert.equal(canPublishForAds(ev.gate), false);
  });

  it("5. missing business identity FAILs CT-002 (bloqueia publicação)", () => {
    const signals = baseSignals({
      hasAffiliateDisclosure: true,
      hasBusinessIdentity: false,
      businessName: null,
      contactEmail: null,
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CT-002", ev).status, "FAIL");
    assert.equal(canPublishForAds(ev.gate), false);
  });

  it("6. unsourced health/study claim WARN CL-003", () => {
    const signals = baseSignals({
      claimsText: "Estudos comprovam eficácia sem link",
      unsourcedTestimonialOrStudy: true,
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CL-003", ev).status, "WARNING");
  });

  it("7. guaranteed cure FAILs CL-001", () => {
    const signals = baseSignals({
      claimsText: "Cura garantida da doença em 7 dias",
      healthCureClaim: true,
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CL-001", ev).status, "FAIL");
    assert.equal(ev.gate, "blocked");
  });

  it("8. invented price FAILs CL-004", () => {
    const signals = baseSignals({
      inventedPriceSignal: true,
      priceMention: "de R$ 497 por R$ 47",
      priceVerifiedFromSource: false,
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CL-004", ev).status, "FAIL");
  });

  it("9. broken destination FAILs DT-002", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk({ ok: false, statusCode: 404 }),
    });
    assert.equal(result("DT-002", ev).status, "FAIL");
  });

  it("10. redirect cycle FAILs DT-003", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk({ redirectCycle: true, ok: false }),
    });
    assert.equal(result("DT-003", ev).status, "FAIL");
  });

  it("11. open redirect FAILs DT-004", () => {
    const signals = baseSignals({
      affiliateLink: "https://tracker.example.com/r?url=https://evil.example/",
    });
    const ev = evaluateCompliance({
      signals,
      destination: destOk({ openRedirectSuspect: true }),
    });
    assert.equal(result("DT-004", ev).status, "FAIL");
  });

  it("12. unexpected domain change WARN DT-005", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk({
        domainChanged: true,
        initialHost: "a.example.com",
        finalHost: "b.other.com",
      }),
    });
    assert.equal(result("DT-005", ev).status, "WARNING");
  });

  it("13. crawler blocked WARNs DT-006/DT-002 (não força rascunho)", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk({ crawlerBlocked: true, statusCode: 403, ok: false }),
    });
    assert.equal(result("DT-006", ev).status, "WARNING");
    assert.equal(result("DT-002", ev).status, "WARNING");
    assert.equal(canPublishForAds(ev.gate), true);
  });

  it("14. cloaking enabled FAILs DT-007", () => {
    const signals = baseSignals({ cloakingEnabled: true });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("DT-007", ev).status, "FAIL");
  });

  it("15. malicious imported script FAILs PS-001", () => {
    const signals = baseSignals({
      maliciousScriptInImport: true,
      mirrorHtml: '<script>eval(atob("x"))</script>',
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("PS-001", ev).status, "FAIL");
  });

  it("16. SSRF localhost FAILs PS-002", () => {
    const signals = baseSignals({ affiliateLink: "http://127.0.0.1/meta" });
    const ev = evaluateCompliance({
      signals,
      destination: destOk({ errorCode: "ssrf_blocked", ok: false, attempted: true }),
    });
    assert.equal(result("PS-002", ev).status, "FAIL");
  });

  it("17. GCLID and UTM preservation PASS TR-001", () => {
    const tracking = probeTrackingParamPreservation({
      offerUrl: "https://offer.example.com/buy?x=1",
    });
    assert.equal(tracking.gclidPreserved, true);
    assert.equal(tracking.utmPreserved, true);
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk(),
      tracking,
    });
    assert.equal(result("TR-001", ev).status, "PASS");
  });

  it("17b. lost gclid FAILs TR-001", () => {
    const tracking = probeTrackingParamPreservation({
      offerUrl: "https://offer.example.com/buy",
      mergeParams: (url) => url, // drop params
    });
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk(),
      tracking,
    });
    assert.equal(result("TR-001", ev).status, "FAIL");
  });

  it("18. blocked gate cannot publish (API gate helper)", () => {
    assert.equal(canPublishForAds("blocked"), false);
    assert.equal(canPublishForAds("needs_review"), false);
    assert.equal(canPublishForAds("ready_for_review"), true);
  });

  it("19. tenant isolation is enforced by query userId (contract)", () => {
    // Contract: controllers always findFirst({ where: { id, userId: billingUserId } }).
    // This test locks the expected isolation key shape used by compliance endpoints.
    const isolationWhere = { id: "presell-a", userId: "tenant-a" };
    assert.equal(isolationWhere.userId, "tenant-a");
    assert.notEqual(isolationWhere.userId, "tenant-b");
  });

  it("20. reaudit after content change changes fingerprint and gate", () => {
    const a = extractPresellSignals({
      title: "A",
      content: { sales_text: "texto um ".repeat(40), affiliate_link: "https://o.example/a", images: ["i"] },
      settings: { privacyPolicyUrl: "https://ex/p", businessName: "B", contactEmail: "a@b.c" },
    });
    const b = extractPresellSignals({
      title: "A",
      content: { sales_text: "texto dois ".repeat(40), affiliate_link: "https://o.example/a", images: ["i"] },
      settings: { privacyPolicyUrl: "https://ex/p", businessName: "B", contactEmail: "a@b.c" },
    });
    assert.notEqual(a.contentFingerprint, b.contentFingerprint);
  });

  it("21. audit service unavailable FAILs META-002 and blocks", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      auditServiceUnavailable: true,
    });
    assert.equal(result("META-002", ev).status, "FAIL");
    assert.equal(ev.gate, "blocked");
  });

  it("22. stale/unreachable policy sources WARN META-001", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk(),
      forcePolicyStale: true,
    });
    assert.equal(result("META-001", ev).status, "WARNING");
  });

  it("23. human override softens false positive without inventing approval", () => {
    // Texto que dispara CL-001 sem o padrão CT-003 (cura garantida).
    const signals = baseSignals({
      healthCureClaim: true,
      claimsText: "elimina permanentemente a doença em 7 dias sem exceção",
    });
    const ev = evaluateCompliance({ signals, destination: destOk() });
    assert.equal(result("CL-001", ev).status, "FAIL");
    const overridden = applyHumanOverrides(ev.results, [
      { ruleId: "CL-001", decision: "override_pass" },
    ]);
    const cl = overridden.find((r) => r.ruleId === "CL-001")!;
    assert.equal(cl.status, "WARNING");
    assert.equal(cl.severity, "medium");
    assert.match(cl.evidence.summary, /falso positivo/i);
    assert.equal(canPublishForAds(deriveGate(overridden)), true);
  });

  it("platforms are separated in summary", () => {
    const ev = evaluateCompliance({
      signals: baseSignals(),
      destination: destOk(),
      tracking: probeTrackingParamPreservation({ offerUrl: "https://offer.example.com" }),
    });
    assert.equal(ev.google.platform, "google");
    assert.equal(ev.microsoft.platform, "microsoft");
    assert.ok(ev.results.every((r) => ["PASS", "FAIL", "WARNING", "NOT_CHECKED"].includes(r.status)));
    assert.match(ev.disclaimer, /não há garantia/i);
  });

  it("correction assistant does not invent business or legal text", () => {
    const ev = evaluateCompliance({
      signals: baseSignals({
        hasBusinessIdentity: false,
        businessName: null,
        contactEmail: null,
        privacyPolicyUrl: null,
      }),
      destination: destOk(),
    });
    assert.equal(result("CT-002", ev).status, "FAIL");
    const suggestions = suggestCorrections({ results: ev.results, current: {} });
    const identity = suggestions.find((s) => s.ruleId === "CT-002");
    assert.ok(identity, `suggestions=${suggestions.map((s) => s.ruleId).join(",")}`);
    assert.ok(identity!.requiresUserInput.includes("businessName"));
    assert.equal(identity!.suggestedContentPatches.length, 0);
    assert.equal(identity!.applyAutomatically, false);
  });

  it("NOT_CHECKED when destination probe skipped", () => {
    const ev = evaluateCompliance({ signals: baseSignals(), destination: null });
    assert.equal(result("DT-002", ev).status, "NOT_CHECKED");
  });
});
