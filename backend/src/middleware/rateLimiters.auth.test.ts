import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import express, { type Request } from "express";
import {
  authAccountKey,
  authClientIpKey,
  createAuthCredentialLimiter,
  resolveAuthCredentialLimiterOptions,
} from "./rateLimiters";

function fakeReq(headers: Record<string, string>, remoteAddress: string, body?: unknown): Request {
  return { headers, socket: { remoteAddress }, body } as unknown as Request;
}

describe("authClientIpKey", () => {
  it("ignora o XFF mais à esquerda escrito pelo cliente", () => {
    const a = fakeReq({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }, "100.64.0.2");
    const b = fakeReq({ "x-forwarded-for": "8.8.8.8, 203.0.113.9" }, "100.64.0.2");
    assert.equal(authClientIpKey(a), "203.0.113.9");
    assert.equal(authClientIpKey(b), authClientIpKey(a));
  });
});

describe("authAccountKey", () => {
  it("e-mail sem distinção de maiúsculas; MFA por token; sem corpo = null", () => {
    const k1 = authAccountKey(fakeReq({}, "", { email: " John@X.com " }));
    const k2 = authAccountKey(fakeReq({}, "", { email: "john@x.com" }));
    assert.ok(k1?.startsWith("email:"));
    assert.equal(k1, k2);
    assert.ok(authAccountKey(fakeReq({}, "", { mfa_token: "abc.def.ghi" }))?.startsWith("mfa:"));
    assert.equal(authAccountKey(fakeReq({}, "", {})), null);
  });
});

describe("resolveAuthCredentialLimiterOptions", () => {
  it("defaults e pisos", () => {
    assert.deepEqual(resolveAuthCredentialLimiterOptions({}), {
      windowMs: 15 * 60 * 1000,
      ipMax: 80,
      accountMax: 10,
    });
    assert.equal(resolveAuthCredentialLimiterOptions({ AUTH_ACCOUNT_RATE_LIMIT_MAX: "1" }).accountMax, 5);
  });
});

describe("createAuthCredentialLimiter", () => {
  async function withServer(fn: (base: string) => Promise<void>) {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.post(
      "/login",
      createAuthCredentialLimiter({ windowMs: 60_000, ipMax: 1000, accountMax: 5 }),
      (req, res) => {
        if (req.body?.password === "ok") return res.json({ ok: true });
        return res.status(401).json({ error: "E-mail ou senha incorretos" });
      },
    );
    const server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    const { port } = server.address() as AddressInfo;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }

  const post = (base: string, body: unknown, xff: string) =>
    fetch(`${base}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": xff },
      body: JSON.stringify(body),
    });

  it("tecto por conta não se contorna rodando o XFF", async () => {
    await withServer(async (base) => {
      for (let i = 0; i < 5; i++) {
        const r = await post(base, { email: "victim@x.com", password: "bad" }, `10.0.0.${i}, 198.51.100.${i}`);
        assert.equal(r.status, 401);
      }
      const blocked = await post(base, { email: "VICTIM@x.com", password: "bad" }, "9.9.9.9");
      assert.equal(blocked.status, 429);
      const other = await post(base, { email: "other@x.com", password: "bad" }, "9.9.9.9");
      assert.equal(other.status, 401);
    });
  });

  it("logins bem-sucedidos não gastam o tecto por conta", async () => {
    await withServer(async (base) => {
      for (let i = 0; i < 8; i++) {
        const r = await post(base, { email: "me@x.com", password: "ok" }, "203.0.113.5");
        assert.equal(r.status, 200);
      }
    });
  });
});
