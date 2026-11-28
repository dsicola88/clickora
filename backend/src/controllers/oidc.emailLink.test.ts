import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { oidcEmailLinkDecision, oidcEmailVerified } from "./oidc.controller";

describe("oidc: e-mail verificado e ligação por sub", () => {
  it("só aceita email_verified verdadeiro", () => {
    assert.equal(oidcEmailVerified({ email_verified: true }), true);
    assert.equal(oidcEmailVerified({ email_verified: "true" }), true);
    assert.equal(oidcEmailVerified({ email_verified: false }), false);
    assert.equal(oidcEmailVerified({ email_verified: "false" }), false);
    assert.equal(oidcEmailVerified({}), false);
  });

  it("conta ligada a outro sub não entra por e-mail", () => {
    assert.equal(oidcEmailLinkDecision(null, "sub-a"), "link");
    assert.equal(oidcEmailLinkDecision("sub-a", "sub-a"), "linked");
    assert.equal(oidcEmailLinkDecision("sub-a", "sub-b"), "conflict");
  });
});
