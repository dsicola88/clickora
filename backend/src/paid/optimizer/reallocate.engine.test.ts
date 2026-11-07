import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { proposeBudgetReallocations } from "./reallocate.engine";

const KEYS = ["PAID_OPTIMIZER_SCALE_ROAS_MIN", "PAID_OPTIMIZER_SCALE_BUDGET_FRACTION"] as const;

describe("proposeBudgetReallocations", () => {
  let prev: Record<string, string | undefined>;

  afterEach(() => {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("move orçamento do laggard para o vencedor na mesma rede", () => {
    prev = {};
    for (const k of KEYS) prev[k] = process.env[k];
    process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN = "2";
    process.env.PAID_OPTIMIZER_SCALE_BUDGET_FRACTION = "0.2";

    const out = proposeBudgetReallocations([
      {
        campaignId: "winner",
        platform: "google_ads",
        spendUsd: 50,
        revenueUsd: 200,
        dailyBudgetUsd: 40,
        wouldPause: false,
      },
      {
        campaignId: "laggard",
        platform: "google_ads",
        spendUsd: 40,
        revenueUsd: 20,
        dailyBudgetUsd: 50,
        wouldPause: false,
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0]!.receiverCampaignId, "winner");
    assert.equal(out[0]!.donorCampaignId, "laggard");
    assert.equal(out[0]!.decisionType, "reallocate_budget");
    assert.equal(out[0]!.transferUsd, 10); // 20% de 50
  });

  it("não cruza plataformas", () => {
    prev = {};
    for (const k of KEYS) prev[k] = process.env[k];
    process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN = "2";

    const out = proposeBudgetReallocations([
      {
        campaignId: "g-win",
        platform: "google_ads",
        spendUsd: 50,
        revenueUsd: 200,
        dailyBudgetUsd: 40,
        wouldPause: false,
      },
      {
        campaignId: "m-lag",
        platform: "meta_ads",
        spendUsd: 40,
        revenueUsd: 10,
        dailyBudgetUsd: 50,
        wouldPause: false,
      },
    ]);
    assert.equal(out.length, 0);
  });

  it("ignora dador elegível a pausa", () => {
    prev = {};
    for (const k of KEYS) prev[k] = process.env[k];
    process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN = "2";

    const out = proposeBudgetReallocations([
      {
        campaignId: "winner",
        platform: "meta_ads",
        spendUsd: 50,
        revenueUsd: 200,
        dailyBudgetUsd: 40,
        wouldPause: false,
      },
      {
        campaignId: "dying",
        platform: "meta_ads",
        spendUsd: 40,
        revenueUsd: 0,
        dailyBudgetUsd: 50,
        wouldPause: true,
      },
    ]);
    assert.equal(out.length, 0);
  });
});
