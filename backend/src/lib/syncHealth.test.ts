import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptySyncHealth,
  formatSyncHealthDetail,
  syncHealthIssueTotal,
  type SyncHealth,
} from "./syncHealth";

describe("syncHealth helpers", () => {
  it("emptySyncHealth tem total 0", () => {
    assert.equal(syncHealthIssueTotal(emptySyncHealth(7)), 0);
  });

  it("conta failed + skipped click-ids", () => {
    const sh: SyncHealth = {
      ...emptySyncHealth(7),
      google_ads_skipped_no_gclid: 2,
      meta_capi_skipped_no_fbclid: 1,
      tiktok_events_failed: 3,
    };
    assert.equal(syncHealthIssueTotal(sh), 6);
    const detail = formatSyncHealthDetail(sh);
    assert.match(detail, /sem gclid/);
    assert.match(detail, /sem fbclid/);
    assert.match(detail, /falha\(s\) TikTok/);
  });
});
