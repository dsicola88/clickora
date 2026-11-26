import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Request } from "express";
import { publicSpaPresellUrl, resolvePublicAppOrigin } from "./publicSpaOrigin";

function fakeReq(partial: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  host?: string;
  protocol?: string;
}): Request {
  const headers = partial.headers || {};
  return {
    query: partial.query || {},
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    hostname: (partial.host || headers.host || "").split(":")[0],
    protocol: partial.protocol || "http",
    get(name: string) {
      const key = name.toLowerCase();
      if (key === "host") return partial.host || headers.host || "";
      return headers[key] || headers[name] || "";
    },
  } as unknown as Request;
}

const ENV_KEYS = ["PUBLIC_APP_URL", "FRONTEND_URL", "APP_PUBLIC_URL"] as const;

describe("publicSpaOrigin", () => {
  /** Determinístico: o resultado não pode depender do `.env` local. */
  const saved: Record<string, string | undefined> = {};
  before(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  after(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("usa spa_origin da query em pedido directo à API", () => {
    const req = fakeReq({
      host: "localhost:3001",
      query: { spa_origin: "http://localhost:8080" },
    });
    assert.equal(resolvePublicAppOrigin(req), "http://localhost:8080");
    assert.equal(
      publicSpaPresellUrl(req, "11111111-1111-4111-8111-111111111111"),
      "http://localhost:8080/p/11111111-1111-4111-8111-111111111111",
    );
  });

  it("redirect lite no tenant com slug usa path bare", () => {
    const req = fakeReq({
      host: "offer.tenant.com",
      query: { spa_origin: "https://offer.tenant.com" },
      headers: { "x-forwarded-host": "offer.tenant.com", "x-forwarded-proto": "https" },
    });
    const url = publicSpaPresellUrl(req, "11111111-1111-4111-8111-111111111111", "kerassentials");
    assert.match(url, /\/kerassentials$/);
    assert.doesNotMatch(url, /\/p\//);
  });

  it("com rewrite same-host devolve origem do host", () => {
    const req = fakeReq({
      host: "www.dclickora.com",
      protocol: "https",
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "www.dclickora.com" },
    });
    assert.equal(resolvePublicAppOrigin(req), "https://www.dclickora.com");
  });

  const ID = "11111111-1111-4111-8111-111111111111";

  it("rewrite Vercel→Railway: host do visitante (tenant) vem de x-vercel-forwarded-host → /{slug} relativo", () => {
    const req = fakeReq({
      host: "clickora-production.up.railway.app",
      headers: {
        "x-vercel-forwarded-host": "oferta.tenant.com",
        "x-forwarded-host": "clickora-production.up.railway.app",
      },
    });
    assert.equal(publicSpaPresellUrl(req, ID, "kerassentials"), "/kerassentials");
  });

  it("tenant sem slug → /p/:id no mesmo host (sem saltar para dclickora.com)", () => {
    const req = fakeReq({
      host: "clickora-production.up.railway.app",
      headers: { "x-vercel-forwarded-host": "oferta.tenant.com" },
    });
    assert.equal(publicSpaPresellUrl(req, ID, null), `/p/${ID}`);
  });

  it("site principal nunca usa slug (não resolve fora do domínio do assinante)", () => {
    const req = fakeReq({
      host: "clickora-production.up.railway.app",
      headers: { "x-vercel-forwarded-host": "www.dclickora.com", "x-forwarded-proto": "https" },
    });
    const url = publicSpaPresellUrl(req, ID, "kerassentials");
    assert.match(url, new RegExp(`/p/${ID}$`));
    assert.doesNotMatch(url, /kerassentials/);
  });

  it("slug que é UUID não é usado como path bare", () => {
    const req = fakeReq({ host: "x", headers: { "x-vercel-forwarded-host": "oferta.tenant.com" } });
    assert.equal(publicSpaPresellUrl(req, ID, ID), `/p/${ID}`);
  });
});
