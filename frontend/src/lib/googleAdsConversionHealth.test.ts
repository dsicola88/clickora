import { describe, expect, it } from "vitest";
import {
  alignGoogleCustomers,
  bucketGoogleAdsSync,
  conversionFunnelStatus,
  summarizeGoogleAdsSyncHealth,
} from "./googleAdsConversionHealth";

describe("googleAdsConversionHealth", () => {
  it("alinha customers ignorando hífens", () => {
    expect(alignGoogleCustomers("123-456-7890", "1234567890")).toBe("match");
    expect(alignGoogleCustomers("111", "222")).toBe("mismatch");
    expect(alignGoogleCustomers(null, "222")).toBe("unknown");
  });

  it("classifica sync ledger", () => {
    expect(bucketGoogleAdsSync("sent")).toBe("ok");
    expect(bucketGoogleAdsSync("failed")).toBe("failed");
    expect(bucketGoogleAdsSync("skipped_no_gclid")).toBe("no_gclid");
    expect(bucketGoogleAdsSync(null)).toBe("pending");
  });

  it("resume saúde recente", () => {
    const s = summarizeGoogleAdsSyncHealth([
      { google_ads_sync: "sent" },
      { google_ads_sync: "failed" },
      { google_ads_sync: "skipped_no_gclid" },
      { google_ads_sync: null },
    ]);
    expect(s).toEqual({ total: 4, ok: 1, failed: 1, pending: 1, no_gclid: 1, disabled: 0 });
  });

  it("funnel status honesto", () => {
    expect(
      conversionFunnelStatus({ canUpload: true, paidCustomerId: "1", uploadCustomerId: "1" }),
    ).toBe("ready");
    expect(
      conversionFunnelStatus({ canUpload: false, paidCustomerId: "1", uploadCustomerId: "1" }),
    ).toBe("upload_incomplete");
    expect(
      conversionFunnelStatus({ canUpload: true, paidCustomerId: "1", uploadCustomerId: "2" }),
    ).toBe("customer_mismatch");
    expect(
      conversionFunnelStatus({ canUpload: null, paidCustomerId: null, uploadCustomerId: null }),
    ).toBe("settings_unknown");
  });
});
