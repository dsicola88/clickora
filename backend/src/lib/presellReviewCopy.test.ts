import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeterministicReviewCopy,
  mapDisapprovalToHints,
  generatePresellReviewCopy,
  sanitizeOfferFacts,
} from "./presellReviewCopy";
import { monthlyPresellAiLimitForPlanType } from "./presellAiQuota";

describe("presellReviewCopy", () => {
  it("deterministic PT tem corpo substantivo e não promete cura", () => {
    const c = buildDeterministicReviewCopy({
      productName: "Lungora",
      language: "pt-BR",
      offerFacts: "Cápsulas descritas na oferta pública.",
    });
    assert.equal(c.source, "deterministic");
    assert.ok(c.salesText.split(/\s+/).length >= 80);
    assert.equal(/\bcura garantida\b/i.test(c.salesText), false);
    assert.match(c.salesText, /afiliado|comissão/i);
  });

  it("sem OPENAI_API_KEY generate cai no determinístico", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const c = await generatePresellReviewCopy({ productName: "Tea", language: "en" });
    if (prev) process.env.OPENAI_API_KEY = prev;
    assert.equal(c.source, "deterministic");
    assert.ok(c.salesText.length > 100);
  });

  it("mapDisapprovalToHints cobre destino e conteúdo", () => {
    const d = mapDisapprovalToHints("Destination not working 404");
    assert.ok(d.some((h) => h.code === "destination"));
    const c = mapDisapprovalToHints("Insufficient original content on landing page");
    assert.ok(c.some((h) => h.code === "content"));
  });

  it("sanitizeOfferFacts ignora artigo editorial reciclado", () => {
    assert.equal(sanitizeOfferFacts("Como avaliar a oferta de X com transparência. Conteúdo informativo independente."), "");
    assert.ok(sanitizeOfferFacts("Cápsulas descritas na oferta pública.").length > 10);
  });

  it("sanitizeOfferFacts rejeita pitch de marketing EN (cell turnover etc.)", () => {
    const pitch =
      "Cell turnover is the continuous process of shedding dead skin cells and subsequently replacing them with younger cells. This essential process makes our skin look shinier and tighter, and gets rid of fine lines.";
    assert.equal(sanitizeOfferFacts(pitch), "");
    assert.equal(sanitizeOfferFacts("Order now — breakthrough formula clinically proven to look younger"), "");
  });

  it("deterministic PT não embute pitch EN no intro", () => {
    const c = buildDeterministicReviewCopy({
      productName: "Neotonics",
      language: "pt-BR",
      offerFacts:
        "Cell turnover is the continuous process of shedding dead skin cells and subsequently replacing them with younger cells.",
      angle: "landing",
    });
    assert.equal(/cell turnover|shinier|fine line/i.test(c.article.intro), false);
    assert.match(c.article.intro, /Sem extracto detalhado|afiliado independente/i);
  });

  it("ângulos landing/review/advertorial produzem textos distintos", () => {
    const base = { productName: "Visivra", language: "pt-BR" as const };
    const landing = buildDeterministicReviewCopy({ ...base, angle: "landing" });
    const review = buildDeterministicReviewCopy({ ...base, angle: "review" });
    const adv = buildDeterministicReviewCopy({ ...base, angle: "advertorial" });
    assert.notEqual(landing.title, review.title);
    assert.notEqual(review.title, adv.title);
    assert.ok(landing.salesText.length > 80);
    assert.ok(adv.salesText.length > 80);
    assert.equal(landing.article.pillars.length, 3);
    assert.equal(review.article.pillars.length, 3);
    assert.equal(adv.article.kicker, "Artigo de afiliado");
    assert.ok(review.article.headline.includes("Visivra"));
  });
});

describe("presellAiQuota limits", () => {
  it("limites por tipo de plano", () => {
    assert.equal(monthlyPresellAiLimitForPlanType("free_trial"), 8);
    assert.equal(monthlyPresellAiLimitForPlanType("monthly"), 40);
    assert.equal(monthlyPresellAiLimitForPlanType("annual"), 120);
  });
});
