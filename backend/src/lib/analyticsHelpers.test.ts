import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGoogleAdsOfflineImportCellTime,
  roundGoogleAdsOfflineImportValue,
  sqlClickKeywordBucket,
} from "./analyticsHelpers";

describe("analyticsHelpers", () => {
  it("formatGoogleAdsOfflineImportCellTime UTC com offset +0000", () => {
    const d = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    assert.equal(formatGoogleAdsOfflineImportCellTime(d), "2026-01-02 03:04:05+0000");
  });

  it("roundGoogleAdsOfflineImportValue a 2 casas; NaN/Inf → 0", () => {
    assert.equal(roundGoogleAdsOfflineImportValue(1.239), 1.24);
    assert.equal(roundGoogleAdsOfflineImportValue(1.234), 1.23);
    assert.equal(roundGoogleAdsOfflineImportValue(Number.NaN), 0);
    assert.equal(roundGoogleAdsOfflineImportValue(Number.POSITIVE_INFINITY), 0);
  });

  it("sqlClickKeywordBucket rejeita alias inválido e aceita te", () => {
    assert.throws(() => sqlClickKeywordBucket("te;drop"), /alias/);
    const sql = sqlClickKeywordBucket("te");
    assert.ok(sql);
    assert.match(String(sql.strings?.join?.("") ?? sql), /utm_term|metadata|sem keyword/);
  });
});
