import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { respondSessionAuthError } from "./authenticate";
import { SessionRevokedError, SessionUserGoneError } from "../lib/workspaceSessionGuard";

function fakeRes() {
  const out: { status?: number; body?: { code?: string } } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: { code?: string }) {
      out.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, out };
}

test("respondSessionAuthError: token inválido/expirado e sessão revogada → 401", () => {
  for (const err of [
    new jwt.JsonWebTokenError("invalid signature"),
    new jwt.TokenExpiredError("jwt expired", new Date()),
    new SessionUserGoneError(),
  ]) {
    const { res, out } = fakeRes();
    respondSessionAuthError(err, res);
    assert.equal(out.status, 401);
  }
  const { res, out } = fakeRes();
  respondSessionAuthError(new SessionRevokedError(), res);
  assert.equal(out.status, 401);
  assert.equal(out.body?.code, "SESSION_REVOKED");
});

test("respondSessionAuthError: falha de BD → 503 sem terminar a sessão", () => {
  const original = console.error;
  console.error = () => {};
  try {
    const { res, out } = fakeRes();
    respondSessionAuthError(new Error("Can't reach database server"), res);
    assert.equal(out.status, 503);
    assert.equal(out.body?.code, "AUTH_UNAVAILABLE");
  } finally {
    console.error = original;
  }
});
