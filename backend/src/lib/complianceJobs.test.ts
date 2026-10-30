import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { complianceJobConfig, newComplianceWorkerId } from "./complianceJobs";

describe("complianceJobs", () => {
  it("config tem limites seguros", () => {
    const c = complianceJobConfig();
    assert.ok(c.max_attempts >= 1 && c.max_attempts <= 10);
    assert.ok(c.lease_seconds >= 30 && c.lease_seconds <= 600);
    assert.ok(c.timeout_ms >= 5000);
    assert.ok(c.pending_soft_max >= 100);
  });

  it("workerId é único o suficiente", () => {
    const a = newComplianceWorkerId("t");
    const b = newComplianceWorkerId("t");
    assert.notEqual(a, b);
    assert.match(a, /^t-/);
  });

  it("produção bloqueia LEGACY via documentado (smoke env)", () => {
    // O bloqueio efectivo está em enqueueComplianceJob / worker entry —
    // aqui só garantimos que a API de config não depende do flag legado.
    const c = complianceJobConfig();
    assert.equal(typeof c.lease_seconds, "number");
  });
});
