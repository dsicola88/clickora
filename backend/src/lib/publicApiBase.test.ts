import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import { isPlatformMainApiBase, sameOriginTrackApiBase } from "./publicApiBase";

function fakeReq(headers: Record<string, string>, hostname = "clickora-production.up.railway.app"): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: lower,
    query: {},
    hostname,
    protocol: "https",
    get: (name: string) => lower[name.toLowerCase()],
    header: (name: string) => lower[name.toLowerCase()],
  } as unknown as Request;
}

describe("isPlatformMainApiBase", () => {
  it("domínio principal do SaaS (bloqueado no edge para /track/r|rot)", () => {
    assert.equal(isPlatformMainApiBase("https://www.dclickora.com/api"), true);
    assert.equal(isPlatformMainApiBase("https://dclickora.com/api"), true);
  });
  it("domínios de assinante, Railway e localhost continuam utilizáveis", () => {
    assert.equal(isPlatformMainApiBase("https://wellformulas.store/api"), false);
    assert.equal(isPlatformMainApiBase("https://go.marca.com/api"), false);
    assert.equal(isPlatformMainApiBase("https://clickora-production.up.railway.app/api"), false);
    assert.equal(isPlatformMainApiBase("http://localhost:3001/api"), false);
    assert.equal(isPlatformMainApiBase("lixo"), false);
  });
});

describe("sameOriginTrackApiBase (rota lite /l/)", () => {
  it("spaUrl relativo em domínio de assinante → /api no host do visitante (não lança)", () => {
    const req = fakeReq({ "x-forwarded-host": "wellformulas.store" });
    assert.equal(sameOriginTrackApiBase(req, "/visivra-pc-cahw"), "https://wellformulas.store/api");
  });
  it("spaUrl absoluto (domínio técnico) → origem desse URL", () => {
    const req = fakeReq({});
    assert.equal(
      sameOriginTrackApiBase(req, "https://presell.exemplo.net/p/c2e3caf4-de15-48bd-aeca-3f69b07a0358"),
      "https://presell.exemplo.net/api",
    );
  });
  it("localhost usa http", () => {
    const req = fakeReq({ "x-forwarded-host": "localhost" }, "localhost");
    assert.equal(sameOriginTrackApiBase(req, "/p/x"), "http://localhost/api");
  });
});
