/**
 * Verifica domínio custom + (opcional) HTTPS live.
 *
 *   E2E_API_BASE=https://…/api E2E_EMAIL=… E2E_PASSWORD=… \
 *   npx tsx scripts/e2e-custom-domain-verified.ts
 *
 * Opcional: E2E_CUSTOM_DOMAIN=lando.example.com — tenta GET https://domínio/
 */
import assert from "node:assert/strict";

const BASE = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(/\/$/, "");
const EMAIL = (process.env.E2E_EMAIL || "").trim();
const PASS = (process.env.E2E_PASSWORD || "").trim();
const DOMAIN = (process.env.E2E_CUSTOM_DOMAIN || "").trim().toLowerCase();

async function jf(path: string, init: RequestInit & { token?: string } = {}) {
  const h = new Headers(init.headers);
  if (init.token) h.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  const r = await fetch(`${BASE}${path}`, { ...init, headers: h, signal: AbortSignal.timeout(30_000) });
  let body: Record<string, unknown> = {};
  try {
    body = (await r.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  return { status: r.status, body };
}

async function main() {
  assert.ok(EMAIL && PASS, "E2E_EMAIL + E2E_PASSWORD obrigatórios");
  const login = await jf("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = String(login.body.token || "");
  assert.ok(token, "token");

  const list = await jf("/custom-domain", { token });
  assert.ok(list.status < 300, `list ${list.status}`);
  const rows = Array.isArray(list.body) ? list.body : (list.body.domains as unknown[]) || [];
  console.log(`[INFO] domains=${rows.length}`);

  if (DOMAIN) {
    const match = (rows as { hostname?: string; status?: string; id?: string }[]).find(
      (d) => (d.hostname || "").toLowerCase() === DOMAIN,
    );
    if (!match) {
      console.log(`[FAIL] Domínio ${DOMAIN} não está na conta`);
      process.exitCode = 1;
      return;
    }
    const verify = await jf(`/custom-domain/${match.id}/verify`, { method: "POST", token });
    console.log(`[INFO] verify → ${verify.status} ${JSON.stringify(verify.body).slice(0, 200)}`);
    const https = await fetch(`https://${DOMAIN}/`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    }).catch((e: Error) => ({ ok: false, status: 0, error: e.message }));
    const st = "status" in https ? https.status : 0;
    console.log(`[INFO] https://${DOMAIN}/ → ${st}`);
    if (st >= 200 && st < 500) {
      console.log("[PASS] Domínio responde em HTTPS");
    } else {
      console.log("[FAIL] HTTPS sem resposta útil — confirme DNS/CNAME/SSL Vercel");
      process.exitCode = 1;
    }
  } else {
    console.log("[PASS] API custom-domain acessível (defina E2E_CUSTOM_DOMAIN para prova HTTPS)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
