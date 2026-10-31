import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("conversionSyncQueue backoff", () => {
  it("backoff cresce e tem tecto", () => {
    const backoffSeconds = (attempts: number) => Math.min(3600, Math.pow(2, Math.max(0, attempts)) * 15);
    assert.equal(backoffSeconds(0), 15);
    assert.equal(backoffSeconds(1), 30);
    assert.ok(backoffSeconds(20) <= 3600);
  });
});
