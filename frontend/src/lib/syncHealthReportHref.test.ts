import { describe, expect, it } from "vitest";
import { syncHealthReportHref, syncHealthReportLabel } from "./syncHealthReportHref";

describe("syncHealthReportHref", () => {
  it("vai a sem-gclid quando só skipped_no_gclid", () => {
    const href = syncHealthReportHref({
      period_days: 7,
      google_ads_failed: 0,
      google_ads_skipped_no_gclid: 4,
      meta_capi_failed: 0,
    });
    expect(href).toBe("/resultados/relatorios/sem-gclid");
    expect(syncHealthReportLabel(href)).toBe("Relatórios → Sem ID Google");
  });

  it("vai a conversões com falhas API ou outros skips", () => {
    expect(
      syncHealthReportHref({
        period_days: 7,
        google_ads_failed: 1,
        google_ads_skipped_no_gclid: 2,
        meta_capi_failed: 0,
      }),
    ).toBe("/resultados/relatorios/conversoes");
    expect(
      syncHealthReportHref({
        period_days: 7,
        google_ads_failed: 0,
        google_ads_skipped_no_gclid: 1,
        meta_capi_failed: 0,
        meta_capi_skipped_no_fbclid: 1,
      }),
    ).toBe("/resultados/relatorios/conversoes");
  });
});
