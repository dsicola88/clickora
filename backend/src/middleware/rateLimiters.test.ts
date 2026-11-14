import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  complianceAuditLimiter,
  presellWriteLimiter,
  resolvePresellWriteLimitMax,
  resolvePresellWriteLimitWindowMs,
} from "./rateLimiters";

describe("presellWriteLimiter env", () => {
  it("usa default 120 / 15min sem env", () => {
    assert.equal(resolvePresellWriteLimitMax({}), 120);
    assert.equal(resolvePresellWriteLimitWindowMs({}), 15 * 60 * 1000);
  });

  it("respeita PRESELL_CREATE_RATE_LIMIT_* em staging", () => {
    assert.equal(
      resolvePresellWriteLimitMax({ PRESELL_CREATE_RATE_LIMIT_MAX: "5000" }),
      5000,
    );
    assert.equal(
      resolvePresellWriteLimitWindowMs({ PRESELL_CREATE_RATE_LIMIT_WINDOW_MS: "60000" }),
      60_000,
    );
  });

  it("não desce abaixo do piso anti-abuso", () => {
    assert.equal(resolvePresellWriteLimitMax({ PRESELL_CREATE_RATE_LIMIT_MAX: "5" }), 20);
    assert.equal(
      resolvePresellWriteLimitWindowMs({ PRESELL_CREATE_RATE_LIMIT_WINDOW_MS: "1000" }),
      60_000,
    );
  });

  it("env inválido cai no default seguro", () => {
    assert.equal(resolvePresellWriteLimitMax({ PRESELL_CREATE_RATE_LIMIT_MAX: "abc" }), 120);
    assert.equal(
      resolvePresellWriteLimitWindowMs({ PRESELL_CREATE_RATE_LIMIT_WINDOW_MS: "nope" }),
      15 * 60 * 1000,
    );
  });
});

describe("buckets separados create vs auditoria", () => {
  it("usa middlewares distintos (contadores independentes)", () => {
    assert.notEqual(presellWriteLimiter, complianceAuditLimiter);
  });
});
