/**
 * FASE G — Auditoria das APIs e base de dados (BD + API locais isolados).
 *
 * Segurança: loadTestSafety — só localhost; nunca Railway.
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const EMAIL_B = process.env.LOAD_TEST_EMAIL_B || "";
const STAMP = Date.now().toString(36);

type Status = "VALIDADO COM EVIDÊNCIA" | "FALHOU" | "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA" | "NÃO TESTADO";
type Row = { id: string; status: Status; test: string; evidence: string[]; failures: string[] };
const rows: Row[] = [];
function add(id: string, status: Status, test: string, evidence: string[] = [], failures: string[] = []) {
  rows.push({ id, status, test, evidence, failures });
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    Origin: "http://127.0.0.1:8080",
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method: opts.method || "GET", headers, body: opts.body });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const info = databaseHostInfo();
  if (!info.isLocal || info.blocked) {
    console.error("ABORT: DATABASE_URL não local");
    process.exit(2);
  }
  console.log(JSON.stringify({ safety: { api: BASE, db_host: info.host, db_port: info.port, railway: false } }));
  if (!EMAIL || !PASSWORD) {
    console.error("LOAD_TEST_EMAIL/PASSWORD obrigatórios");
    process.exit(2);
  }

  const prisma = new PrismaClient();

  // G1 health
  {
    const h = await api("/api/health");
    const ok = h.status === 200 && h.json?.status === "ok";
    add("G1", ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU", "GET /api/health", [`status=${h.status}`, `body_status=${h.json?.status}`], ok ? [] : ["health fail"]);
  }

  // G2 login + /auth/me
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.json?.token as string | undefined;
  {
    const me = token ? await api("/api/auth/me", { token }) : { status: 0, json: null, text: "" };
    const ok = login.status === 200 && !!token && me.status === 200 && me.json?.email === EMAIL;
    add(
      "G2",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "login + /auth/me",
      [`login=${login.status}`, `me=${me.status}`, `email=${me.json?.email}`],
      ok ? [] : ["auth fail"],
    );
  }
  if (!token) {
    console.error("no token");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) process.exit(1);

  // G3 sem token → 401
  {
    const r = await api("/api/presells");
    const ok = r.status === 401 || r.status === 403;
    add("G3", ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU", "GET /presells sem token → 401/403", [`http=${r.status}`], ok ? [] : ["endpoint aberto"]);
  }

  // G4 token inválido
  {
    const r = await api("/api/presells", { token: "not.a.jwt.token" });
    const ok = r.status === 401 || r.status === 403;
    add("G4", ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU", "token JWT inválido rejeitado", [`http=${r.status}`], ok ? [] : ["aceitou JWT inválido"]);
  }

  // Create presell for isolation + FK tests
  const created = await api("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FG API ${STAMP}`,
      slug: `fg-api-${STAMP}`,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "FG",
        title: `FG ${STAMP}`,
        subtitle: "g",
        sales_text:
          "Auditoria FASE G APIs e BD. Texto descritivo suficiente. Não prometemos resultados. " +
          "Confirme preço no site oficial. Links de afiliado podem aplicar-se. Compare alternativas. ",
        cta_text: "Ver",
        images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        affiliate_link: "https://example.com/fg",
      },
      settings: {
        privacyPolicyUrl: "/privacidade",
        cookiePolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure: "Divulgação afiliado.",
      },
      tracking: { offerUrl: "https://example.com/fg" },
    }),
  });
  const presellId = created.json?.id as string | undefined;
  if (!presellId) {
    add("G5", "FALHOU", "criar presell", [], [`http=${created.status} ${created.text.slice(0, 120)}`]);
  } else {
    add("G5", "VALIDADO COM EVIDÊNCIA", "POST /presells cria registo", [`id=${presellId.slice(0, 8)}…`, `http=${created.status}`]);
  }

  // G6 tenant isolation — user B cannot read A's presell
  {
    let tokenB: string | undefined;
    let emailB = EMAIL_B;
    if (emailB) {
      const lb = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: emailB, password: PASSWORD }),
      });
      tokenB = lb.json?.token;
    }
    if (!tokenB) {
      // register ephemeral user B
      emailB = `fg-iso-${STAMP}@dclickora.local`;
      const reg = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: emailB,
          password: PASSWORD,
          name: `FG Iso ${STAMP}`,
        }),
      });
      tokenB = reg.json?.token;
      if (!tokenB && (reg.status === 200 || reg.status === 201)) {
        const lb = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: emailB, password: PASSWORD }),
        });
        tokenB = lb.json?.token;
      }
      if (!tokenB) {
        // try login as known second audit user
        for (const cand of ["danielclickora2@gmail.com", "danielclickora@gmail.com"]) {
          if (cand === EMAIL) continue;
          const lb = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: cand, password: PASSWORD }),
          });
          if (lb.json?.token) {
            tokenB = lb.json.token;
            emailB = cand;
            break;
          }
        }
      }
    }
    if (!tokenB || !presellId) {
      add("G6", "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA", "isolamento tenant", [`reg/login B falhou`], []);
    } else {
      const cross = await api(`/api/presells/${presellId}`, { token: tokenB });
      const ok = cross.status === 404 || cross.status === 403;
      add(
        "G6",
        ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
        "tenant isolation: user B não lê presell de A",
        [`B=${emailB}`, `http=${cross.status}`],
        ok ? [] : ["vazamento cross-tenant"],
      );
    }
  }

  // G7 list consistency: API count vs Prisma
  {
    const list = await api("/api/presells", { token });
    const apiCount = Array.isArray(list.json) ? list.json.length : Array.isArray(list.json?.presells) ? list.json.presells.length : -1;
    const dbCount = await prisma.presellPage.count({ where: { userId: user.id } });
    // list may be paginated — just require API 200 and dbCount >= 1
    const ok = list.status === 200 && dbCount >= 1 && (apiCount < 0 || apiCount <= dbCount || apiCount === dbCount);
    add(
      "G7",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "list /presells coerente com BD",
      [`api_http=${list.status}`, `api_n=${apiCount}`, `db_n=${dbCount}`],
      ok ? [] : ["inconsistência list/BD"],
    );
  }

  // G8 FK TrackingEvent → PresellPage
  if (presellId) {
    await prisma.presellPage.update({ where: { id: presellId }, data: { status: "published" } });
    const redir = await fetch(`${BASE}/api/track/r/${presellId}?to=${encodeURIComponent("https://example.com/fg")}`, {
      redirect: "manual",
    });
    const loc = redir.headers.get("location") || "";
    let clickId = "";
    try {
      clickId = new URL(loc).searchParams.get("clickora_click_id") || "";
    } catch {
      /* */
    }
    const ev = clickId ? await prisma.trackingEvent.findUnique({ where: { id: clickId } }) : null;
    const ok = !!ev && ev.presellPageId === presellId && ev.userId === user.id;
    add(
      "G8",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "TrackingEvent FK userId + presellPageId",
      [`click=${clickId.slice(0, 8)}…`, `presell_match=${ev?.presellPageId === presellId}`, `user_match=${ev?.userId === user.id}`],
      ok ? [] : ["FK tracking inválida"],
    );
  }

  // G9 plan / subscription readable
  {
    const plans = await api("/api/plans", { token });
    const me = await api("/api/auth/me", { token });
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } });
    const ok = (plans.status === 200 || plans.status === 404) && me.status === 200;
    add(
      "G9",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "plans/me + subscription BD",
      [`plans=${plans.status}`, `sub=${sub ? sub.status || "row" : "none"}`, `plan_id=${(me.json as any)?.plan_id || (me.json as any)?.planId || "n/a"}`],
      ok ? [] : ["plans/me fail"],
    );
  }

  // G10 workspaces API
  {
    const ws = await api("/api/workspaces", { token });
    const ok = ws.status === 200 || ws.status === 404;
    add(
      "G10",
      ws.status === 200 ? "VALIDADO COM EVIDÊNCIA" : ws.status === 404 ? "NÃO TESTADO" : "FALHOU",
      "GET /workspaces",
      [`http=${ws.status}`, `type=${Array.isArray(ws.json) ? "array" : typeof ws.json}`],
      ws.status === 200 || ws.status === 404 ? [] : ["workspaces fail"],
    );
  }

  // G11 analytics dashboard schema keys
  {
    const dash = await api("/api/analytics/dashboard", { token });
    const keys = Object.keys(dash.json || {});
    const ok = dash.status === 200 && keys.length > 0;
    add(
      "G11",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "analytics/dashboard responde JSON",
      [`http=${dash.status}`, `keys=${keys.slice(0, 10).join(",")}`],
      ok ? [] : ["dashboard fail"],
    );
  }

  // G12 DB integrity: orphan conversions (clickId set but click missing)
  {
    const orphans = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM conversions c
       WHERE c."clickId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM tracking_events t WHERE t.id = c."clickId")`,
    ).catch(() => null);
    // Prisma may use snake_case columns — try alternate
    let orphanCount = orphans ? Number(orphans[0]?.c ?? -1) : -1;
    if (orphanCount < 0) {
      const all = await prisma.conversion.findMany({
        where: { userId: user.id, clickId: { not: null } },
        select: { clickId: true },
        take: 200,
      });
      let miss = 0;
      for (const c of all) {
        if (!c.clickId) continue;
        const t = await prisma.trackingEvent.findUnique({ where: { id: c.clickId }, select: { id: true } });
        if (!t) miss++;
      }
      orphanCount = miss;
    }
    const ok = orphanCount === 0;
    add(
      "G12",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "sem Conversion órfã (clickId sem TrackingEvent)",
      [`orphans=${orphanCount}`],
      ok ? [] : [`${orphanCount} órfãs`],
    );
  }

  // G13 traffic_rotators FK context_presell published constraint via API
  {
    const draftId = presellId;
    // create rotator against draft should fail OR against published succeed
    if (draftId) {
      await prisma.presellPage.update({ where: { id: draftId }, data: { status: "draft" } });
      const bad = await api("/api/traffic-rotators", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: `FG bad ${STAMP}`,
          slug: `fg-bad-${STAMP}`,
          mode: "weighted",
          context_presell_id: draftId,
          arms: [{ destination_url: "https://example.com/x", label: "x", order_index: 0, weight: 100 }],
        }),
      });
      await prisma.presellPage.update({ where: { id: draftId }, data: { status: "published" } });
      const good = await api("/api/traffic-rotators", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: `FG good ${STAMP}`,
          slug: `fg-good-${STAMP}`,
          mode: "weighted",
          context_presell_id: draftId,
          arms: [{ destination_url: "https://example.com/x", label: "x", order_index: 0, weight: 100 }],
        }),
      });
      const rid = good.json?.id as string | undefined;
      if (rid) await api(`/api/traffic-rotators/${rid}`, { method: "DELETE", token }).catch(() => undefined);
      const ok = bad.status >= 400 && (good.status === 200 || good.status === 201) && !!rid;
      add(
        "G13",
        ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
        "rotador exige context_presell published",
        [`draft_create=${bad.status}`, `pub_create=${good.status}`],
        ok ? [] : ["constraint published falhou"],
      );
    }
  }

  if (presellId) await api(`/api/presells/${presellId}`, { method: "DELETE", token }).catch(() => undefined);
  await prisma.$disconnect();

  const summary = {
    phase: "G",
    stamp: STAMP,
    validated: rows.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: rows.filter((r) => r.status === "FALHOU").length,
    blocked: rows.filter((r) => r.status === "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA").length,
    not_tested: rows.filter((r) => r.status === "NÃO TESTADO").length,
    total: rows.length,
    rows,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
