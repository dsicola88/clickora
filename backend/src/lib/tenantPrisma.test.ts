import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { USER_ID_MODELS } from "./tenantPrisma";

describe("tenantPrisma USER_ID_MODELS", () => {
  it("inclui modelos críticos de isolamento (Etapa 5)", () => {
    const required = [
      "presellPage",
      "affiliateCampaign",
      "trafficRotator",
      "apiKey",
      "blacklistedIp",
      "whitelistedIp",
      "trackingEvent",
      "conversion",
      "tenantBranding",
      "paidAdsProject",
      "presellComplianceAudit",
      "presellComplianceJob",
    ] as const;
    for (const m of required) {
      assert.ok((USER_ID_MODELS as readonly string[]).includes(m), `falta ${m}`);
    }
  });

  it("não tem duplicados", () => {
    assert.equal(USER_ID_MODELS.length, new Set(USER_ID_MODELS).size);
  });
});
