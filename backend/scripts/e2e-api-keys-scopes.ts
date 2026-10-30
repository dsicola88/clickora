/**
 * E2E ponta-a-ponta Public API v1 (scopes).
 *
 * Sempre: BD + middleware real (authenticate → scope → session gate).
 * Opcional HTTP: E2E_BASE=http://127.0.0.1:PORT
 *
 *   cd backend && npx tsx scripts/e2e-api-keys-scopes.ts
 */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateApiKeyPlain, hashApiKey } from "../src/lib/apiKeys";
import {
  apiKeyHasScope,
  normalizeApiKeyScopes,
  scopeRequiredForHttpMethod,
} from "../src/lib/apiKeyScopes";
import { authenticateJwtOrApiKey } from "../src/middleware/authenticateJwtOrApiKey";
import {
  enforceApiKeyHttpScope,
  requireSessionJwt,
} from "../src/middleware/requireApiKeyScope";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

type MockRes = Response & {
  statusCode: number;
  body: unknown;
};

function mockReq(init: {
  method: string;
  authorization?: string;
}): Request {
  return {
    method: init.method,
    headers: init.authorization ? { authorization: init.authorization } : {},
  } as unknown as Request;
}

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as MockRes;
}

function runMw(
  mw: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: MockRes,
): Promise<"next" | "ended"> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const next: NextFunction = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve("next");
    };
    const origJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      const out = origJson(payload);
      if (!settled) {
        settled = true;
        resolve("ended");
      }
      return out;
    }) as MockRes["json"];
    void Promise.resolve(mw(req, res, next)).catch(reject);
  });
}

async function runAuthStack(args: {
  method: string;
  bearer: string;
  sessionGate?: boolean;
}): Promise<{ status: number; body: unknown; authVia?: string; scopes?: string[] }> {
  const req = mockReq({
    method: args.method,
    authorization: `Bearer ${args.bearer}`,
  });
  const res = mockRes();
  const authEnded = await runMw(authenticateJwtOrApiKey, req, res);
  if (authEnded === "ended") {
    return { status: res.statusCode, body: res.body };
  }
  if (args.sessionGate) {
    const gateEnded = await runMw(requireSessionJwt, req, res);
    if (gateEnded === "ended") {
      return { status: res.statusCode, body: res.body, authVia: req.authVia };
    }
  } else {
    const scopeEnded = await runMw(enforceApiKeyHttpScope, req, res);
    if (scopeEnded === "ended") {
      return {
        status: res.statusCode,
        body: res.body,
        authVia: req.authVia,
        scopes: req.apiKeyScopes,
      };
    }
  }
  return {
    status: 200,
    body: { ok: true },
    authVia: req.authVia,
    scopes: req.apiKeyScopes,
  };
}

async function main() {
  record(
    "contrato scopes (write⇒read, métodos)",
    apiKeyHasScope(["write"], "read") &&
      !apiKeyHasScope(["read"], "write") &&
      scopeRequiredForHttpMethod("GET") === "read" &&
      scopeRequiredForHttpMethod("POST") === "write",
    "ok",
  );

  const stamp = Date.now().toString(36);
  const email = `e2e-apikey-${stamp}@clickora.test`;
  const password = "e2e-apikey-pass";
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      email,
      password: await bcrypt.hash(password, 4),
      fullName: "E2E API Keys",
    },
  });

  const readPlain = generateApiKeyPlain();
  const writePlain = generateApiKeyPlain();
  const writeOnlyPlain = generateApiKeyPlain();
  const revokedPlain = generateApiKeyPlain();

  try {
    await prisma.apiKey.createMany({
      data: [
        {
          id: randomUUID(),
          userId,
          name: "read-only",
          keyPrefix: readPlain.prefix,
          keyHash: await hashApiKey(readPlain.plain),
          scopes: ["read"],
        },
        {
          id: randomUUID(),
          userId,
          name: "read-write",
          keyPrefix: writePlain.prefix,
          keyHash: await hashApiKey(writePlain.plain),
          scopes: ["read", "write"],
        },
        {
          id: randomUUID(),
          userId,
          name: "write-only",
          keyPrefix: writeOnlyPlain.prefix,
          keyHash: await hashApiKey(writeOnlyPlain.plain),
          scopes: ["write"],
        },
        {
          id: randomUUID(),
          userId,
          name: "revoked",
          keyPrefix: revokedPlain.prefix,
          keyHash: await hashApiKey(revokedPlain.plain),
          scopes: ["read", "write"],
          revokedAt: new Date(),
        },
      ],
    });

    const rows = await prisma.apiKey.findMany({ where: { userId } });
    record(
      "chaves BD: 3 activas + 1 revogada",
      rows.filter((r) => !r.revokedAt).length === 3 && rows.some((r) => r.revokedAt != null),
      `total=${rows.length} active=${rows.filter((r) => !r.revokedAt).length}`,
    );
    record(
      "scopes normalizados na BD",
      rows
        .filter((r) => !r.revokedAt)
        .every((r) => normalizeApiKeyScopes(r.scopes).length >= 1),
      "ok",
    );

    const getRead = await runAuthStack({ method: "GET", bearer: readPlain.plain });
    record(
      "MW: read key GET → next (200)",
      getRead.status === 200 && getRead.authVia === "api_key" && getRead.scopes?.includes("read"),
      `status=${getRead.status} via=${getRead.authVia} scopes=${getRead.scopes?.join(",")}`,
    );

    const postRead = await runAuthStack({ method: "POST", bearer: readPlain.plain });
    const postReadCode = (postRead.body as { code?: string } | null)?.code;
    record(
      "MW: read key POST → 403 api_key_scope_denied",
      postRead.status === 403 && postReadCode === "api_key_scope_denied",
      `status=${postRead.status} code=${postReadCode}`,
    );

    const getWriteOnly = await runAuthStack({ method: "GET", bearer: writeOnlyPlain.plain });
    record(
      "MW: write-only key GET → next (write implica read)",
      getWriteOnly.status === 200 && getWriteOnly.authVia === "api_key",
      `status=${getWriteOnly.status}`,
    );

    const postWrite = await runAuthStack({ method: "POST", bearer: writePlain.plain });
    record(
      "MW: write key POST → next",
      postWrite.status === 200 && postWrite.authVia === "api_key",
      `status=${postWrite.status}`,
    );

    const sessionGate = await runAuthStack({
      method: "GET",
      bearer: writePlain.plain,
      sessionGate: true,
    });
    const sessionCode = (sessionGate.body as { code?: string } | null)?.code;
    record(
      "MW: API key em gestão de chaves → session_required",
      sessionGate.status === 403 && sessionCode === "session_required",
      `status=${sessionGate.status} code=${sessionCode}`,
    );

    const revoked = await runAuthStack({ method: "GET", bearer: revokedPlain.plain });
    record(
      "MW: chave revogada → 401",
      revoked.status === 401,
      `status=${revoked.status} body=${JSON.stringify(revoked.body).slice(0, 80)}`,
    );

    const invalid = await runAuthStack({
      method: "GET",
      bearer: "ck_live_this_is_not_a_real_key_zzzz",
    });
    record("MW: chave inválida → 401", invalid.status === 401, `status=${invalid.status}`);

    const base = (process.env.E2E_BASE || "").replace(/\/+$/, "");
    if (!base) {
      record("HTTP (opcional)", true, "skipped — defina E2E_BASE para testar rotas Express");
    } else {
      const sessionDenied = await fetch(`${base}/api/enterprise/api-keys`, {
        headers: { authorization: `Bearer ${readPlain.plain}` },
      });
      const sessionDeniedBody = (await sessionDenied.json().catch(() => ({}))) as { code?: string };
      record(
        "HTTP: API key não lista chaves (session_required)",
        sessionDenied.status === 403 && sessionDeniedBody.code === "session_required",
        `status=${sessionDenied.status} code=${sessionDeniedBody.code}`,
      );

      const dashRead = await fetch(`${base}/api/analytics/dashboard`, {
        headers: { authorization: `Bearer ${readPlain.plain}` },
      });
      const dashBody = (await dashRead.json().catch(() => ({}))) as { code?: string };
      record(
        "HTTP: read key GET dashboard ≠ scope_denied",
        dashRead.status !== 403 || dashBody.code !== "api_key_scope_denied",
        `status=${dashRead.status} code=${dashBody.code ?? "—"}`,
      );

      const createBlocked = await fetch(`${base}/api/campaigns`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${readPlain.plain}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "should-fail" }),
      });
      const blockedBody = (await createBlocked.json().catch(() => ({}))) as { code?: string };
      record(
        "HTTP: read key POST campaigns → scope_denied",
        createBlocked.status === 403 && blockedBody.code === "api_key_scope_denied",
        `status=${createBlocked.status} code=${blockedBody.code}`,
      );

      const funnelRead = await fetch(`${base}/api/analytics/funnel`, {
        headers: { authorization: `Bearer ${writePlain.plain}` },
      });
      const funnelBody = (await funnelRead.json().catch(() => ({}))) as { code?: string };
      record(
        "HTTP: write key GET funnel ≠ scope_denied",
        funnelRead.status !== 403 || funnelBody.code !== "api_key_scope_denied",
        `status=${funnelRead.status}`,
      );

      const createWrite = await fetch(`${base}/api/campaigns`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${writePlain.plain}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: `e2e-api-${stamp}` }),
      });
      const createWriteBody = (await createWrite.json().catch(() => ({}))) as { code?: string };
      record(
        "HTTP: write key POST campaigns ≠ scope_denied",
        createWriteBody.code !== "api_key_scope_denied",
        `status=${createWrite.status} code=${createWriteBody.code ?? "—"}`,
      );
    }
  } finally {
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.affiliateCampaign.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.subscription.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
