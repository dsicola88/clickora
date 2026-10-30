import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOAuthPendingToken, loadPaidToken, storePaidToken } from "./tokenSecrets";

describe("paid tokenSecrets", () => {
  it("estado OAuth permanece em claro e é detectado", () => {
    const state = "state:abc|project:p1";
    assert.equal(storePaidToken(state), state);
    assert.equal(loadPaidToken(state), state);
    assert.equal(isOAuthPendingToken(state), true);
  });

  it("sem ENCRYPTION_KEY, round-trip em texto claro (dev)", () => {
    const prev = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const plain = "oauth-refresh-token-demo";
      const stored = storePaidToken(plain);
      assert.equal(stored, plain);
      assert.equal(loadPaidToken(stored), plain);
      assert.equal(isOAuthPendingToken(plain), false);
    } finally {
      if (prev != null) process.env.ENCRYPTION_KEY = prev;
    }
  });
});
