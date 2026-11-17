import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureGoogleConsentModeDefaults,
  resetGoogleConsentModeForTests,
  signalsForMarketingConsent,
  updateGoogleConsentMode,
} from "./googleConsentMode";

type GcmWindow = Window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
  gtag?: (...args: unknown[]) => void;
};

function layer(): unknown[] {
  return ((window as GcmWindow).dataLayer || []) as unknown[];
}

describe("googleConsentMode", () => {
  beforeEach(() => {
    resetGoogleConsentModeForTests();
    const w = window as GcmWindow;
    w.dataLayer = [];
    delete w.gtag;
  });

  it("signalsForMarketingConsent mapeia Aceitar/Fechar", () => {
    expect(signalsForMarketingConsent(true).ad_storage).toBe("granted");
    expect(signalsForMarketingConsent(false).analytics_storage).toBe("denied");
  });

  it("aplica default denied uma vez e update para granted", () => {
    ensureGoogleConsentModeDefaults({ defaultDenied: true });
    ensureGoogleConsentModeDefaults({ defaultDenied: true });
    const defaults = layer().filter(
      (row) => Array.isArray(row) && row[0] === "consent" && row[1] === "default",
    );
    expect(defaults).toHaveLength(1);
    expect((defaults[0] as unknown[])[2]).toMatchObject({ ad_storage: "denied" });

    updateGoogleConsentMode(true);
    const updates = layer().filter(
      (row) => Array.isArray(row) && row[0] === "consent" && row[1] === "update",
    );
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect((updates[updates.length - 1] as unknown[])[2]).toMatchObject({
      ad_storage: "granted",
    });
  });

  it("update para essential fica denied", () => {
    ensureGoogleConsentModeDefaults({ defaultDenied: true });
    updateGoogleConsentMode(false);
    const updates = layer().filter(
      (row) => Array.isArray(row) && row[0] === "consent" && row[1] === "update",
    );
    expect((updates[updates.length - 1] as unknown[])[2]).toMatchObject({
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });
});
