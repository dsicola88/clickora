import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSpendUsd } from "./metrics.service";

describe("resolveSpendUsd", () => {
  it("Google usa micros → USD", () => {
    assert.equal(
      resolveSpendUsd({
        platform: "google_ads",
        googleCostMicros: 12_500_000,
        metaSpendUsd: null,
        tiktokSpendUsd: null,
      }),
      12.5,
    );
  });

  it("Meta usa spend USD directo", () => {
    assert.equal(
      resolveSpendUsd({
        platform: "meta_ads",
        googleCostMicros: null,
        metaSpendUsd: 8.2,
        tiktokSpendUsd: 99,
      }),
      8.2,
    );
  });

  it("TikTok usa spend da report API", () => {
    assert.equal(
      resolveSpendUsd({
        platform: "tiktok_ads",
        googleCostMicros: null,
        metaSpendUsd: null,
        tiktokSpendUsd: 33.1,
      }),
      33.1,
    );
  });

  it("sem gasto conhecido → null (não inventa)", () => {
    assert.equal(
      resolveSpendUsd({
        platform: "tiktok_ads",
        googleCostMicros: null,
        metaSpendUsd: null,
        tiktokSpendUsd: null,
      }),
      null,
    );
  });
});
