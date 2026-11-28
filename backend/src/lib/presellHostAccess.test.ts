import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { Request } from "express";
import { signToken } from "./jwt";
import { evaluatePublicPresellAccess, pickExactHostnameMatch } from "./presellHostAccess";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function req(host: string, authToken?: string, ua = "Mozilla/5.0"): Request {
  const headers: Record<string, string> = {
    "x-vercel-forwarded-host": host,
    host: "clickora-production.up.railway.app",
    "user-agent": ua,
  };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  return { headers, query: {}, hostname: "clickora-production.up.railway.app" } as unknown as Request;
}

describe("evaluatePublicPresellAccess — domínio principal", () => {
  for (const host of ["www.dclickora.com", "dclickora.com"]) {
    it(`${host}: anónimo → bloqueado`, async () => {
      const r = await evaluatePublicPresellAccess(req(host), OWNER);
      assert.deepEqual(r, { allowed: false, reason: "main_host" });
    });

    it(`${host}: AdsBot / Googlebot → bloqueado (igual a qualquer visitante)`, async () => {
      for (const ua of [
        "Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ]) {
        const r = await evaluatePublicPresellAccess(req(host, undefined, ua), OWNER);
        assert.deepEqual(r, { allowed: false, reason: "main_host" });
      }
    });
  }

  it("token inválido → bloqueado (não é 401, só não é dono)", async () => {
    const r = await evaluatePublicPresellAccess(req("www.dclickora.com", "nao-e-um-jwt"), OWNER);
    assert.deepEqual(r, { allowed: false, reason: "main_host" });
  });

  it("sessão do dono → preview privado", async () => {
    const token = signToken({ userId: OWNER, email: "dono@example.com", purpose: "session" });
    const r = await evaluatePublicPresellAccess(req("www.dclickora.com", token), OWNER);
    assert.deepEqual(r, { allowed: true, ownerPreview: true });
  });

  it("sessão de OUTRA conta → bloqueado", async () => {
    const token = signToken({ userId: OTHER, email: "outro@example.com", purpose: "session" });
    const r = await evaluatePublicPresellAccess(req("www.dclickora.com", token), OWNER);
    assert.deepEqual(r, { allowed: false, reason: "main_host" });
  });

  it("token MFA / recuperação de senha nunca vale como sessão", async () => {
    for (const purpose of ["mfa", "password_reset"] as const) {
      const token = signToken({ userId: OWNER, email: "dono@example.com", purpose });
      const r = await evaluatePublicPresellAccess(req("www.dclickora.com", token), OWNER);
      assert.deepEqual(r, { allowed: false, reason: "main_host" });
    }
  });
});

describe("pickExactHostnameMatch", () => {
  const rows = [
    { hostname: "loja.com", userId: "apex" },
    { hostname: "www.loja.com", userId: "www" },
  ];
  it("prefere o hostname exacto do pedido, independentemente da ordem da BD", () => {
    assert.equal(pickExactHostnameMatch(rows, ["www.loja.com", "loja.com"])?.userId, "www");
    assert.equal(pickExactHostnameMatch([...rows].reverse(), ["loja.com", "www.loja.com"])?.userId, "apex");
  });
  it("sem exacto cai na variante; vazio → null", () => {
    assert.equal(pickExactHostnameMatch([rows[0]], ["www.loja.com", "loja.com"])?.userId, "apex");
    assert.equal(pickExactHostnameMatch([], ["loja.com"]), null);
  });
});

describe("controller usa a política nova nas rotas públicas", () => {
  it("getPublicById e getPublicHtml passam por evaluatePublicPresellAccess", () => {
    const src = readFileSync(path.resolve(__dirname, "../controllers/presell.controller.ts"), "utf8");
    const calls = src.match(/evaluatePublicPresellAccess\(req, page\.userId\)/g) ?? [];
    assert.ok(calls.length >= 1);
    assert.match(src, /htmlAccess = await evaluatePublicPresellAccess\(req, page\.userId\)/);
    assert.match(src, /PRESELL_NOT_PUBLIC_ON_MAIN_HOST/);
  });
});
