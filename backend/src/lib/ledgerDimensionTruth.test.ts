import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeDimensionClicksWithSales,
  reconcileDimensionAgainstLedger,
} from "./ledgerDimensionTruth";

describe("ledgerDimensionTruth — confiança comercial", () => {
  it("funde cliques e vendas sem inventar linhas a mais", () => {
    const merged = mergeDimensionClicksWithSales(
      [
        { key: "US", clicks: 10 },
        { key: "PT", clicks: 3 },
      ],
      [
        { key: "US", sales: 2, revenue: 40 },
        { key: "(sem país)", sales: 1, revenue: 15 },
      ],
    );
    assert.equal(merged.length, 3);
    const us = merged.find((r) => r.key === "US");
    const loose = merged.find((r) => r.key === "(sem país)");
    assert.deepEqual(us, { key: "US", clicks: 10, sales: 2, revenue: 40 });
    assert.deepEqual(loose, { key: "(sem país)", clicks: 0, sales: 1, revenue: 15 });
  });

  it("Σ dimensões = total do ledger (invariante)", () => {
    const rows = [
      { sales: 2, revenue: 40 },
      { sales: 1, revenue: 15.5 },
    ];
    const ok = reconcileDimensionAgainstLedger(rows, { sales: 3, revenue: 55.5 });
    assert.equal(ok.ok, true);
    assert.equal(ok.sales_sum, 3);
    assert.equal(ok.revenue_sum, 55.5);
  });

  it("detecta divergência de vendas unattributed esquecidas", () => {
    const rows = [{ sales: 2, revenue: 40 }];
    const bad = reconcileDimensionAgainstLedger(rows, { sales: 3, revenue: 55 });
    assert.equal(bad.ok, false);
    assert.equal(bad.sales_delta, -1);
  });
});
