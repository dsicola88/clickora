import { describe, expect, it } from "vitest";
import type { SyncHealthPayload } from "@/components/SyncHealthBanner";

/** Espelho da regra de visibilidade do banner (sem montar React). */
function shouldShowSyncHealth(sh: SyncHealthPayload | null | undefined): boolean {
  if (!sh) return false;
  const total =
    sh.google_ads_failed +
    sh.meta_capi_failed +
    (sh.tiktok_events_failed ?? 0) +
    (sh.google_ads_skipped_no_gclid ?? 0);
  return total > 0;
}

describe("SyncHealthBanner visibility", () => {
  it("esconde quando tudo zero", () => {
    expect(
      shouldShowSyncHealth({
        period_days: 7,
        google_ads_failed: 0,
        google_ads_skipped_no_gclid: 0,
        meta_capi_failed: 0,
        tiktok_events_failed: 0,
      }),
    ).toBe(false);
  });

  it("mostra skipped_no_gclid mesmo sem failed", () => {
    expect(
      shouldShowSyncHealth({
        period_days: 7,
        google_ads_failed: 0,
        google_ads_skipped_no_gclid: 3,
        meta_capi_failed: 0,
      }),
    ).toBe(true);
  });
});
