import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGoogleCriterionId, normalizeGoogleNumericId } from "./google-ads-ids";

describe("normalizeGoogleCriterionId", () => {
  it("aceita criterion_id puro", () => {
    assert.equal(normalizeGoogleCriterionId("2488848910271"), "2488848910271");
  });

  it("extrai a parte após ~ (resource adGroupCriteria)", () => {
    assert.equal(normalizeGoogleCriterionId("9876543210~2488848910271"), "2488848910271");
    assert.equal(
      normalizeGoogleCriterionId("customers/123/adGroupCriteria/9876543210~2488848910271"),
      "2488848910271",
    );
  });

  it("não concatena ag+crit (evita Invalid number na GAQL)", () => {
    const bad = "9876543210~2488848910271".replace(/\D/g, "");
    assert.notEqual(normalizeGoogleCriterionId("9876543210~2488848910271"), bad);
    assert.ok(bad.length > 19);
  });

  it("rejeita vazio / lixo", () => {
    assert.equal(normalizeGoogleCriterionId(""), null);
    assert.equal(normalizeGoogleCriterionId("abc"), null);
    assert.equal(normalizeGoogleCriterionId("0"), null);
  });
});

describe("normalizeGoogleNumericId", () => {
  it("lê ad group de ag~crit", () => {
    assert.equal(normalizeGoogleNumericId("9876543210~2488848910271"), "9876543210");
  });
});
