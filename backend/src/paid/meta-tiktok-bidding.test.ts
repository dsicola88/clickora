import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  metaGraphAdsetBiddingFields,
  storedMetaBiddingFromPlanInput,
  storedTikTokBiddingFromPlanInput,
  tiktokAdgroupBidExtras,
} from "./meta-tiktok-bidding";

describe("storedMetaBiddingFromPlanInput", () => {
  it("persiste valor USD para bid cap", () => {
    const o = storedMetaBiddingFromPlanInput({
      meta_bidding_strategy: "bid_cap_usd",
      meta_bid_amount_usd: 3.5,
    });
    assert.equal(o.meta.strategy, "bid_cap_usd");
    assert.equal(o.meta.bid_amount_usd, 3.5);
  });
});

describe("metaGraphAdsetBiddingFields", () => {
  it("LOWEST_COST_WITHOUT_CAP por defeito", () => {
    const b = metaGraphAdsetBiddingFields({}, "OUTCOME_TRAFFIC");
    assert.deepEqual(b, { bid_strategy: "LOWEST_COST_WITHOUT_CAP" });
  });

  it("bid_cap_usd → LOWEST_COST_WITH_BID_CAP em centavos", () => {
    const b = metaGraphAdsetBiddingFields(
      { meta: { strategy: "bid_cap_usd", bid_amount_usd: 3 } },
      "OUTCOME_TRAFFIC",
    );
    assert.equal(b.bid_strategy, "LOWEST_COST_WITH_BID_CAP");
    assert.equal(b.bid_amount, "300");
  });

  it("cost_cap com OUTCOME_TRAFFIC faz downgrade para bid cap", () => {
    const b = metaGraphAdsetBiddingFields(
      { meta: { strategy: "cost_cap_usd", bid_amount_usd: 40 } },
      "OUTCOME_TRAFFIC",
    );
    assert.equal(b.bid_strategy, "LOWEST_COST_WITH_BID_CAP");
    assert.equal(b.bid_amount, "4000");
  });

  it("cost_cap com OUTCOME_SALES usa COST_CAP", () => {
    const b = metaGraphAdsetBiddingFields(
      { meta: { strategy: "cost_cap_usd", bid_amount_usd: 25 } },
      "OUTCOME_SALES",
    );
    assert.equal(b.bid_strategy, "COST_CAP");
    assert.equal(b.bid_amount, "2500");
  });
});

describe("tiktokAdgroupBidExtras", () => {
  it("vazio sem estratégia bid cap", () => {
    assert.deepEqual(tiktokAdgroupBidExtras({}), {});
  });

  it("bid_cap define bid_type e bid_price", () => {
    const x = tiktokAdgroupBidExtras({
      tiktok: { strategy: "bid_cap_usd", bid_amount_usd: 2.25 },
    });
    assert.equal(x.bid_type, "BID_TYPE_CUSTOM");
    assert.equal(x.bid_price, 2.25);
  });
});

describe("storedTikTokBiddingFromPlanInput", () => {
  it("persiste TikTok bid cap", () => {
    const o = storedTikTokBiddingFromPlanInput({
      tiktok_bidding_strategy: "bid_cap_usd",
      tiktok_bid_amount_usd: 5,
    });
    assert.equal(o.tiktok.strategy, "bid_cap_usd");
    assert.equal(o.tiktok.bid_amount_usd, 5);
  });
});
