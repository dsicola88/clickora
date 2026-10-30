import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocatePeriodSpendByClicks, sumAllocatedCost } from "./allocateSpendByClicks";

describe("allocatePeriodSpendByClicks", () => {
  it("sem spend → cost/profit/roas null", () => {
    const out = allocatePeriodSpendByClicks([{ clicks: 10, revenue: 50 }], null, 10);
    assert.equal(out[0]!.cost, null);
    assert.equal(out[0]!.profit, null);
    assert.equal(out[0]!.roas, null);
  });

  it("atribui só a fatia do tráfego no rotador", () => {
    const out = allocatePeriodSpendByClicks(
      [
        { clicks: 40, revenue: 80 },
        { clicks: 10, revenue: 20 },
      ],
      100,
      100,
    );
    assert.equal(out[0]!.cost, 40);
    assert.equal(out[0]!.profit, 40);
    assert.equal(out[0]!.roas, 2);
    assert.equal(out[1]!.cost, 10);
    assert.equal(out[1]!.profit, 10);
    assert.equal(sumAllocatedCost(out), 50);
  });

  it("não inventa custo se entryClicks = 0", () => {
    const out = allocatePeriodSpendByClicks([{ clicks: 5, revenue: 10 }], 50, 0);
    assert.equal(out[0]!.cost, null);
  });

  it("soma dos custos = poolSpend após arredondamento", () => {
    const out = allocatePeriodSpendByClicks(
      [
        { clicks: 1, revenue: 3 },
        { clicks: 1, revenue: 3 },
        { clicks: 1, revenue: 3 },
      ],
      10,
      3,
    );
    // pool = 10; cada um ~3.33; soma exacta 10
    assert.equal(sumAllocatedCost(out), 10);
    assert.ok(out.every((r) => r.cost != null && r.cost > 0));
  });

  it("poolClicks > entryClicks é limitado a 100% do spend", () => {
    const out = allocatePeriodSpendByClicks([{ clicks: 50, revenue: 100 }], 20, 10);
    assert.equal(out[0]!.cost, 20);
    assert.equal(out[0]!.profit, 80);
  });
});
