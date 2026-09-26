/**
 * Selos «E2E Production Verified» — SuperPresell ponta a ponta (só API, sem Prisma).
 *
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   npx tsx scripts/e2e-superpresell-production-verified.ts
 *
 * Regista utilizadores efémeros via /auth/register, corre a cadeia, apaga páginas/rotador.
 * Postback token vem do endpoint autenticado (não precisa JWT_SECRET local = prod).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);
const STAMP = Date.now();
/** Conta Pro com webhook (recomendado). Sem isto, regista signup free → postback BLOCKED. */
const EXISTING_EMAIL = (process.env.E2E_EMAIL || "").trim();
const EXISTING_PASS = (process.env.E2E_PASSWORD || "").trim();
const EMAIL_A = EXISTING_EMAIL || `e2e-spv-a-${STAMP}@dclickora.local`;
const EMAIL_B = `e2e-spv-b-${STAMP}@dclickora.local`;
const PASS = EXISTING_PASS || "E2eSpvAudit!99Xx";
const OFFER = "https://www.digistore24.com/redir/e2e-product/demo/";
const EXT_IMG = "https://www.google.com/favicon.ico";
const USE_EXISTING = Boolean(EXISTING_EMAIL && EXISTING_PASS);

type Status = "PASS" | "FAIL" | "GAP" | "BLOCKED";
type Row = { id: string; status: Status; detail: string };
const rows: Row[] = [];

function rec(id: string, status: Status, detail: string) {
  rows.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
}

async function waitHealth(ms = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) return;
    } catch {
      /* */
    }
    await sleep(800);
  }
  throw new Error(`health timeout ${BASE}`);
}

function mirrorHtml(img = EXT_IMG) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E</title></head><body>
<h1>Produto E2E SuperPresell</h1>
<img src="${img}" alt="pack" width="32" height="32">
<a href="${OFFER}">Buy Now</a>
<p>${"x".repeat(220)}</p>
</body></html>`;
}

async function jsonFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const r = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(60_000) });
  let body: Record<string, unknown> = {};
  try {
    body = (await r.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: r.status, body };
}

async function register(email: string) {
  const { status, body } = await jsonFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASS,
      full_name: "E2E SuperPresell",
      accept_policies: true,
    }),
  });
  // alguns ambientes devolvem 201; outros 200; conflito 409 se email existir
  if (status >= 400 && status !== 409) {
    throw new Error(`register ${email} → ${status} ${JSON.stringify(body)}`);
  }
}

async function login(email: string): Promise<string> {
  const { status, body } = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASS }),
  });
  assert.equal(status, 200, `login ${status} ${JSON.stringify(body)}`);
  const token = String(body.token || body.access_token || "");
  assert.ok(token, "token");
  return token;
}

async function main() {
  console.log(`\n=== E2E Production Verified (API-only) ===\nAPI=${BASE}\n`);
  await waitHealth();

  {
    const { status } = await jsonFetch("/presells");
    rec(
      "auth.unauthorized",
      status === 401 || status === 403 ? "PASS" : "FAIL",
      `GET /presells → ${status}`,
    );
  }

  if (!USE_EXISTING) {
    await register(EMAIL_A);
  }
  await register(EMAIL_B);
  const auth = await login(EMAIL_A);
  const authB = await login(EMAIL_B);
  rec(
    "auth.session",
    "PASS",
    USE_EXISTING ? `login existente ${EMAIL_A}` : "register+login A/B",
  );

  let pageA = "";
  let pageB = "";
  let rotatorId = "";

  try {
    const createPage = async (title: string, type: string) => {
      const slug = `e2e-${type}-${Date.now().toString(36)}`;
      const { status, body } = await jsonFetch("/presells", {
        method: "POST",
        token: auth,
        body: JSON.stringify({
          title,
          slug,
          type,
          status: "published",
          language: "pt-BR",
          content: {
            title,
            affiliateLink: OFFER,
            importMirrorSrcDoc: mirrorHtml(),
            ctaText: "Buy",
          },
          settings: {},
          tracking: { offerUrl: OFFER },
        }),
      });
      assert.ok(status < 300 && body.id, `create ${title} ${status} ${JSON.stringify(body)}`);
      return body as { id: string; content?: { importMirrorSrcDoc?: string } };
    };

    const a = await createPage("Lander A", "tsl");
    pageA = a.id;
    rec("import.create_lander_a", "PASS", pageA.slice(0, 8));
    const mirrorOk =
      typeof a.content?.importMirrorSrcDoc === "string" && a.content.importMirrorSrcDoc.length > 200;
    rec("mirror.persisted", mirrorOk ? "PASS" : "FAIL", mirrorOk ? "mirror ok" : "mirror short");

    /** Editor save + R2 reconcile */
    {
      const dirty = mirrorHtml(EXT_IMG);
      const { status, body } = await jsonFetch(`/presells/${pageA}`, {
        method: "PUT",
        token: auth,
        body: JSON.stringify({
          content: {
            title: "Lander A",
            affiliateLink: OFFER,
            importMirrorSrcDoc: dirty,
            ctaText: "Buy",
          },
        }),
      });
      assert.ok(status < 300, `save ${status}`);
      const html = String((body.content as { importMirrorSrcDoc?: string } | undefined)?.importMirrorSrcDoc || "");
      const n = Number(body.mirror_images_rehosted || 0);
      const hasPath = /presell-mirror\//i.test(html);
      // Se o código novo ainda não fez deploy, mirror_images_rehosted fica undefined e n=0
      const fieldPresent = Object.prototype.hasOwnProperty.call(body, "mirror_images_rehosted");
      rec("editor.save", "PASS", "PUT mirror");
      if (hasPath || n > 0) {
        rec("rehost.save_editor", "PASS", `rehosted=${n} path=${hasPath}`);
      } else if (!fieldPresent) {
        rec(
          "rehost.save_editor",
          "BLOCKED",
          "API ainda sem mirror_images_rehosted no response — redeploy pendente ou R2 off",
        );
      } else {
        rec(
          "rehost.save_editor",
          "BLOCKED",
          `R2 off ou fetch da imagem falhou (mirror_images_rehosted=${n})`,
        );
      }
    }

    {
      const { status } = await jsonFetch(`/presells/${pageA}`, {
        method: "PUT",
        token: auth,
        body: JSON.stringify({
          content: {
            title: "Lander A",
            affiliateLink: OFFER,
            importMirrorSrcDoc: mirrorHtml(EXT_IMG),
            ctaText: "Buy",
          },
        }),
      });
      rec("reimport.save", status < 300 ? "PASS" : "FAIL", `status=${status}`);
    }

    /** Cloak */
    {
      await jsonFetch(`/presells/${pageA}`, {
        method: "PUT",
        token: auth,
        body: JSON.stringify({
          settings: {
            enterpriseCloak: true,
            cloakSafeTitle: "Safe E2E",
            cloakSafeBody: "Página segura.",
            cloakGeoDeny: "CN",
          },
        }),
      });

      const bot = await fetch(`${BASE}/public/presells/id/${pageA}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(20_000),
      });
      const botJ = (await bot.json()) as { cloak_safe?: boolean };
      rec(
        "cloak.bot",
        bot.ok && botJ.cloak_safe === true ? "PASS" : "FAIL",
        `cloak_safe=${botJ.cloak_safe}`,
      );

      const human = await fetch(`${BASE}/public/presells/id/${pageA}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(20_000),
      });
      const humanJ = (await human.json()) as { cloak_safe?: boolean };
      rec("cloak.human", human.ok && humanJ.cloak_safe !== true ? "PASS" : "FAIL", `cloak_safe=${humanJ.cloak_safe}`);

      await jsonFetch(`/presells/${pageA}`, {
        method: "PUT",
        token: auth,
        body: JSON.stringify({ settings: { enterpriseCloak: false } }),
      });
    }

    const b = await createPage("Lander B", "review");
    pageB = b.id;
    rec("import.create_lander_b", "PASS", pageB.slice(0, 8));

    const rot = await jsonFetch("/traffic-rotators", {
      method: "POST",
      token: auth,
      body: JSON.stringify({
        name: "E2E A/B",
        slug: `e2e-ab-${STAMP.toString(36)}`,
        mode: "sequential",
        context_presell_id: pageA,
        is_active: true,
        arms: [
          { destination_url: `https://example.com/a?pid=${pageA}`, label: "A", order_index: 0, weight: 50 },
          { destination_url: `https://example.com/b?pid=${pageB}`, label: "B", order_index: 1, weight: 50 },
        ],
      }),
    });
    assert.ok(rot.status < 300 && rot.body.id, `rotator ${rot.status} ${JSON.stringify(rot.body)}`);
    rotatorId = String(rot.body.id);
    rec("rotator.create", "PASS", rotatorId.slice(0, 8));

    async function rotatorHop() {
      const r = await fetch(`${BASE}/track/rot/${rotatorId}?utm_source=e2e`, {
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      assert.equal(r.status, 302, `rot ${r.status}`);
      const loc = r.headers.get("location") || "";
      const parentId = new URL(loc).searchParams.get("clickora_click_id");
      return parentId;
    }

    const parentA = await rotatorHop();
    const parentB = await rotatorHop();
    rec(
      "rotator.clicks",
      parentA && parentB && parentA !== parentB ? "PASS" : "FAIL",
      `A=${parentA?.slice(0, 8)} B=${parentB?.slice(0, 8)}`,
    );

    async function offerClick(presellId: string, parentId: string) {
      const u = new URL(`${BASE}/track/r/${presellId}`);
      u.searchParams.set("to", OFFER);
      u.searchParams.set("parent_click_id", parentId);
      const r = await fetch(u.toString(), { redirect: "manual", signal: AbortSignal.timeout(20_000) });
      assert.equal(r.status, 302, `r ${r.status}`);
      return new URL(r.headers.get("location")!).searchParams.get("clickora_click_id")!;
    }

    assert.ok(parentA && parentB);
    const clickA = await offerClick(pageA, parentA!);
    const clickB = await offerClick(pageB, parentB!);
    rec("tracking.offer_clicks", "PASS", "parent_click_id A/B");

    /** Postback URL from account */
    const hook = await jsonFetch("/integrations/affiliate-webhook-info", { token: auth });
    if (hook.status === 403) {
      rec(
        "postback.sales",
        "BLOCKED",
        `Webhook não activo no plano (${hook.body.code || hook.status}). Use E2E_EMAIL/E2E_PASSWORD de conta Pro.`,
      );
      rec("abStats.clicks", "PASS", "cliques rotator já provados acima");
      rec("abStats.sales", "BLOCKED", "depende de postback no plano Pro");
    } else {
      const rawHook = String(hook.body.hook_url || hook.body.url || "");
      assert.ok(rawHook.includes("token="), `hook ${hook.status} ${JSON.stringify(hook.body)}`);
      /** Postback tem de bater na mesma API/DB do E2E (hook_url público pode ser dclickora.com). */
      const hookParsed = new URL(rawHook);
      const apiBase = new URL(BASE.endsWith("/") ? BASE : `${BASE}/`);
      hookParsed.protocol = apiBase.protocol;
      hookParsed.host = apiBase.host;
      // BASE = …/api → path do hook já inclui /api/integrations/…
      const hookUrl = hookParsed.toString();

      async function sale(clickId: string, amount: string) {
        const u = new URL(hookUrl);
        u.searchParams.set("clickora_click_id", clickId);
        u.searchParams.set("amount", amount);
        u.searchParams.set("currency", "USD");
        u.searchParams.set("status", "approved");
        u.searchParams.set("transaction_id", randomUUID());
        const r = await fetch(u.toString(), { signal: AbortSignal.timeout(20_000) });
        return r.status;
      }

      const sA = await sale(clickA, "49.00");
      const sB = await sale(clickB, "59.00");
      rec("postback.sales", sA < 400 && sB < 400 ? "PASS" : "FAIL", `A=${sA} B=${sB}`);

      const stats = await jsonFetch(`/traffic-rotators/${rotatorId}/ab-stats?lookback_days=7`, {
        token: auth,
      });
      if (stats.status >= 400) {
        rec("abStats.clicks", "FAIL", `ab-stats → ${stats.status} ${JSON.stringify(stats.body)}`);
        rec("abStats.sales", "FAIL", "depende de ab-stats OK");
      } else {
        const arms =
          (stats.body.arms as { label: string | null; clicks: number; conversions: number }[]) || [];
        const armA = arms.find((x) => x.label === "A");
        const armB = arms.find((x) => x.label === "B");
        const clicksOk = !!armA && !!armB && armA.clicks >= 1 && armB.clicks >= 1;
        const salesOk =
          !!armA && !!armB && armA.conversions >= 1 && armB.conversions >= 1;
        rec(
          "abStats.clicks",
          clicksOk ? "PASS" : "FAIL",
          `A c=${armA?.clicks} B c=${armB?.clicks}`,
        );
        rec(
          "abStats.sales",
          salesOk ? "PASS" : "FAIL",
          `A cv=${armA?.conversions} B cv=${armB?.conversions}`,
        );
      }
    }

    {
      const { status } = await jsonFetch("/analytics/dashboard", { token: auth });
      rec("analytics.session", status === 200 ? "PASS" : "FAIL", `→ ${status}`);
    }

    {
      const { status } = await jsonFetch(`/presells/${pageA}`, {
        method: "PUT",
        token: authB,
        body: JSON.stringify({ title: "hack" }),
      });
      rec("tenant.isolation", status === 404 || status === 403 ? "PASS" : "FAIL", `B→A ${status}`);
    }

    {
      const r = await fetch(`${BASE}/public/presells/id/${pageA}`, { signal: AbortSignal.timeout(15_000) });
      rec("public.no_auth", r.status === 200 ? "PASS" : "FAIL", `→ ${r.status}`);
    }
  } finally {
    if (rotatorId) {
      await jsonFetch(`/traffic-rotators/${rotatorId}`, { method: "DELETE", token: auth }).catch(() => undefined);
    }
    if (pageA) await jsonFetch(`/presells/${pageA}`, { method: "DELETE", token: auth }).catch(() => undefined);
    if (pageB) await jsonFetch(`/presells/${pageB}`, { method: "DELETE", token: auth }).catch(() => undefined);
  }

  const counts = { PASS: 0, FAIL: 0, GAP: 0, BLOCKED: 0 };
  for (const r of rows) counts[r.status]++;
  const verified = counts.FAIL === 0 && counts.GAP === 0 && counts.BLOCKED === 0;
  console.log("\n=== RESUMO ===");
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} GAP=${counts.GAP} BLOCKED=${counts.BLOCKED}`);
  console.log(verified ? "SELO: E2E Production Verified" : "SELO: incompleto (FAIL/GAP/BLOCKED)");
  console.log("\n__JSON__");
  console.log(JSON.stringify({ api: BASE, counts, verified, rows, ts: new Date().toISOString() }));
  if (!verified) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
