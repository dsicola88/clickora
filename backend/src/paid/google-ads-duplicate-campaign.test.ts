import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { duplicateGoogleCampaignBodySchema } from "./google-ads-duplicate-campaign.service";

describe("duplicateGoogleCampaignBodySchema", () => {
  it("aceita corpo vazio (defaults)", () => {
    const r = duplicateGoogleCampaignBodySchema.safeParse({});
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.publish, false);
  });

  it("rejeita orçamento negativo", () => {
    const r = duplicateGoogleCampaignBodySchema.safeParse({ daily_budget_usd: -1 });
    assert.equal(r.success, false);
  });

  it("aceita nome e orçamento válidos", () => {
    const r = duplicateGoogleCampaignBodySchema.safeParse({
      name: "Campanha cópia QA",
      daily_budget_usd: 35,
      publish: true,
    });
    assert.equal(r.success, true);
  });
});
