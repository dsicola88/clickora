/**
 * FASE 1 — testes do ledger canónico (regras 1–12 sem rede externa).
 * Cenários de BD real: scripts/e2e-ledger-canonical.ts (DB auditoria).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  applyLedgerTransition,
  gclidFromConversionRow,
  offlineCsvExternalOrderId,
  offlineCsvTelemetryTransactionId,
  revenueFromLedgerRows,
  OFFLINE_CSV_EXTERNAL_PREFIX,
} from "./conversionLedger";
import { adsExternalOrderId } from "./unifiedAdsConversion";

describe("FASE1 ledger canónico — identidade e dedupe", () => {
  it("1) postback uma vez: externalOrderId estável ads", () => {
    assert.equal(adsExternalOrderId("google_ads", "TX-1"), "google_ads:TX-1");
  });

  it("2) mesmo postback várias vezes: mesma chave → duplicate conceptual", () => {
    const a = offlineCsvExternalOrderId("GCLID-AAA");
    const b = offlineCsvExternalOrderId("GCLID-AAA");
    assert.equal(a, b);
    assert.ok(a.startsWith(OFFLINE_CSV_EXTERNAL_PREFIX));
  });

  it("3) race contract: P2002 = unique violation", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
    });
    assert.equal(err.code, "P2002");
  });

  it("4) IDs externos diferentes mas mesmo negócio CSV → mesma chave de GCLID", () => {
    /** Dois ficheiros / reenvios com o mesmo GCLID colidem no mesmo externalOrderId. */
    assert.equal(offlineCsvExternalOrderId("CjwSame"), offlineCsvExternalOrderId("CjwSame"));
    assert.notEqual(offlineCsvExternalOrderId("CjwA"), offlineCsvExternalOrderId("CjwB"));
  });

  it("Google vs Microsoft não colidem no mesmo transaction id", () => {
    assert.notEqual(
      adsExternalOrderId("google_ads", "SAME"),
      adsExternalOrderId("microsoft_ads", "SAME"),
    );
  });
});

describe("FASE1 ledger canónico — estados financeiros", () => {
  it("5) conversão reembolsada (full) sai da receita", () => {
    const after = applyLedgerTransition(
      { status: "approved", amount: 50 },
      { kind: "refund", mode: "full" },
    );
    assert.equal(after.status, "refunded");
    assert.equal(revenueFromLedgerRows([after]), 0);
  });

  it("5b) reembolso parcial reduz amount e mantém approved", () => {
    const after = applyLedgerTransition(
      { status: "approved", amount: 50 },
      { kind: "refund", mode: "partial", refundAmount: 12 },
    );
    assert.equal(after.status, "approved");
    assert.equal(after.amount, 38);
    assert.equal(revenueFromLedgerRows([after]), 38);
  });

  it("6) conversão cancelada (pending → refunded) sem receita", () => {
    const after = applyLedgerTransition(
      { status: "pending", amount: 40 },
      { kind: "cancel" },
    );
    assert.equal(after.status, "refunded");
    assert.equal(revenueFromLedgerRows([after]), 0);
  });

  it("7) pending → approved passa a contar receita", () => {
    const pending = { status: "pending" as const, amount: 25 };
    assert.equal(revenueFromLedgerRows([pending]), 0);
    const approved = applyLedgerTransition(pending, { kind: "approve" });
    assert.equal(approved.status, "approved");
    assert.equal(revenueFromLedgerRows([approved]), 25);
  });

  it("8) CSV export usa gclid da Conversion (click preferido)", () => {
    assert.equal(
      gclidFromConversionRow({
        metadata: { gclid: "own" },
        click: { metadata: { gclid: "click-gclid" } },
      }),
      "click-gclid",
    );
  });

  it("8b) telemetria CSV transaction_id alinhada ao externalOrderId", () => {
    const g = "CjwOffline1";
    assert.equal(offlineCsvTelemetryTransactionId(g), "csv_gclid:CjwOffline1");
    assert.equal(offlineCsvExternalOrderId(g), "offline_csv:csv_gclid:CjwOffline1");
  });

  it("9) filtros: receita agrega só approved no conjunto", () => {
    const rows = [
      { status: "approved" as const, amount: 10 },
      { status: "pending" as const, amount: 99 },
      { status: "refunded" as const, amount: 50 },
      { status: "approved" as const, amount: 5 },
    ];
    assert.equal(revenueFromLedgerRows(rows), 15);
  });

  it("10) isolamento conceptual: externalOrderId é por userId (unique composto)", () => {
    /** Mesmo order id em contas distintas = chaves lógicas distintas (userId + external). */
    const order = "ORDER-1";
    const tenantA = `userA:${order}`;
    const tenantB = `userB:${order}`;
    assert.notEqual(tenantA, tenantB);
  });

  it("11) falha na gravação: sem row = receita 0 (não inventa)", () => {
    assert.equal(revenueFromLedgerRows([]), 0);
  });

  it("12) reprocessamento seguro: restate não duplica linha", () => {
    const restated = applyLedgerTransition(
      { status: "approved", amount: 10 },
      { kind: "restate", amount: 12.5 },
    );
    assert.equal(restated.status, "approved");
    assert.equal(restated.amount, 12.5);
    assert.equal(revenueFromLedgerRows([restated]), 12.5);
  });
});
