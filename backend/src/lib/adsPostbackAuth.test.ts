import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { resolveAdsPostbackAuth } from "./adsPostbackAuth";
import { createPostbackToken, verifyPostbackToken } from "./postbackToken";

function fakeReq(partial: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}): Request {
  return {
    headers: partial.headers ?? {},
    query: partial.query ?? {},
    body: partial.body ?? {},
  } as unknown as Request;
}

describe("resolveAdsPostbackAuth", () => {
  it("token global exige user_id", () => {
    const r = resolveAdsPostbackAuth(
      fakeReq({ headers: { "x-postback-token": "secret" }, body: { presell_id: "p1" } }),
      "secret",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  });

  it("token global + user_id → ok", () => {
    const r = resolveAdsPostbackAuth(
      fakeReq({
        headers: { "x-postback-token": "secret" },
        body: { user_id: "user-a", presell_id: "p1" },
      }),
      "secret",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.userId, "user-a");
  });

  it("token global errado → 401", () => {
    const r = resolveAdsPostbackAuth(
      fakeReq({
        headers: { "x-postback-token": "wrong" },
        body: { user_id: "user-a" },
      }),
      "secret",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 401);
  });

  it("token JWT por conta continua aceite com token global definido", () => {
    const token = createPostbackToken("user-jwt");
    assert.ok(token);
    const r = resolveAdsPostbackAuth(fakeReq({ query: { token: token! } }), "secret");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.userId, "user-jwt");
  });

  it("token de postback antigo com exp vencido continua aceite", () => {
    const old = jwt.sign(
      { userId: "user-old", purpose: "postback", exp: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET || "changeme",
    );
    assert.deepEqual(verifyPostbackToken(old), { userId: "user-old" });
  });

  it("sem env token e sem header → 401", () => {
    const r = resolveAdsPostbackAuth(fakeReq({ body: {} }), undefined);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 401);
  });
});
