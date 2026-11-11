import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAllowsAffiliateWebhook } from "./planAffiliateWebhook";

describe("affiliateWebhookPlan / planAllowsAffiliateWebhook", () => {
  it("rejeita plano ausente ou desactivado", () => {
    assert.equal(planAllowsAffiliateWebhook(null), false);
    assert.equal(planAllowsAffiliateWebhook(undefined), false);
    assert.equal(planAllowsAffiliateWebhook({ affiliateWebhookEnabled: false }), false);
  });

  it("aceita plano com flag activa", () => {
    assert.equal(planAllowsAffiliateWebhook({ affiliateWebhookEnabled: true }), true);
  });
});
