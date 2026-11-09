import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicSafeTenantBrandName } from "./tenantBrandingPublic";

describe("isPublicSafeTenantBrandName", () => {
  it("rejeita nomes de papel interno", () => {
    assert.equal(isPublicSafeTenantBrandName("Daniel Super Admin"), false);
    assert.equal(isPublicSafeTenantBrandName("Admin"), false);
    assert.equal(isPublicSafeTenantBrandName("Clickora"), false);
  });

  it("aceita marca comercial normal", () => {
    assert.equal(isPublicSafeTenantBrandName("Honest Verdict Guide"), true);
    assert.equal(isPublicSafeTenantBrandName("Visivra Reviews"), true);
  });
});
