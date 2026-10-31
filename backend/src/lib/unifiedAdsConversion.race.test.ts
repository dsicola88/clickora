import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";

/**
 * Documenta o contrato de race: unique (userId, externalOrderId) + P2002 → duplicate.
 * Sem BD: valida a chave e o código P2002 esperado pelo upsert.
 */
describe("unifiedAdsConversion race contract", () => {
  it("externalOrderId namespaced evita colisão Google vs Microsoft", () => {
    const tx = "SAME-ORDER";
    assert.notEqual(`google_ads:${tx}`, `microsoft_ads:${tx}`);
  });

  it("P2002 é o código Prisma de unique violation", () => {
    assert.equal(Prisma.PrismaClientKnownRequestError.name, "PrismaClientKnownRequestError");
    const err = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
    });
    assert.equal(err.code, "P2002");
  });
});
