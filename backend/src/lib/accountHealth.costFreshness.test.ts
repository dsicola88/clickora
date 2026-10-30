import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COST_SYNC_STALE_MS, evaluateCostSyncFreshness } from "./accountHealth";

describe("evaluateCostSyncFreshness", () => {
  const now = Date.parse("2026-10-30T12:00:00.000Z");

  it("sem sync → não ok", () => {
    assert.deepEqual(evaluateCostSyncFreshness({ syncedAt: null, googleReady: true, nowMs: now }), {
      ok: false,
      stale: false,
    });
  });

  it("sync recente com Google → ok", () => {
    const syncedAt = new Date(now - 2 * 60 * 60 * 1000);
    assert.deepEqual(
      evaluateCostSyncFreshness({ syncedAt, googleReady: true, nowMs: now }),
      { ok: true, stale: false },
    );
  });

  it("sync >48h com Google → stale", () => {
    const syncedAt = new Date(now - COST_SYNC_STALE_MS - 1000);
    assert.deepEqual(
      evaluateCostSyncFreshness({ syncedAt, googleReady: true, nowMs: now }),
      { ok: false, stale: true },
    );
  });

  it("sync antigo sem Google → ainda ok (sem exigir freshness)", () => {
    const syncedAt = new Date(now - COST_SYNC_STALE_MS * 3);
    assert.deepEqual(
      evaluateCostSyncFreshness({ syncedAt, googleReady: false, nowMs: now }),
      { ok: true, stale: false },
    );
  });
});
