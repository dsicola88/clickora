/**
 * FASE I — E2E leve + performance de redirects (localhost isolado).
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const STAMP = Date.now().toString(36);
const N = Math.min(80, Math.max(20, Number(process.env.AUDIT_I_HITS || "40") || 40));

type Status = "VALIDADO COM EVIDÊNCIA" | "FALHOU" | "NÃO TESTADO";
type Row = { id: string; status: Status; test: string; evidence: string[]; failures: string[] };
const rows: Row[] = [];
function add(id: string, status: Status, test: string, evidence: string[] = [], failures: string[] = []) {
  rows.push({ id, status, test, evidence, failures });
}

async function api(path: string, opts: { method?: string; token?: string; body?: string } = {}) {
  const headers: Record<string, string> = { Accept: "application/json", Origin: "http://127.0.0.1:8080" };
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
  return { status: res.status, json, text };
}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i]!;
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const info = databaseHostInfo();
  console.log(JSON.stringify({ safety: { api: BASE, db_host: info.host, db_port: info.port, railway: false } }));
  if (!EMAIL || !PASSWORD) process.exit(2);

  const prisma = new PrismaClient();
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.json?.token as string;
  if (!token) process.exit(1);

  const created = await api("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FI Perf ${STAMP}`,
      slug: `fi-perf-${STAMP}`,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "FI",
        title: `FI ${STAMP}`,
        subtitle: "perf",
        sales_text:
          "Auditoria FASE I performance. Texto descritivo. Não prometemos resultados. Confirme preço no site oficial. Links de afiliado. ",
        cta_text: "Ver",
        images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        affiliate_link: "https://example.com/fi",
      },
      settings: {
        privacyPolicyUrl: "/privacidade",
        cookiePolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure: "Divulgação afiliado.",
      },
      tracking: { offerUrl: "https://example.com/fi" },
    }),
  });
  const presellId = created.json?.id as string;
  if (!presellId) process.exit(1);
  await prisma.presellPage.update({ where: { id: presellId }, data: { status: "published" } });

  // Create rotator for /rot burst
  const rot = await api("/api/traffic-rotators", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `FI Rot ${STAMP}`,
      slug: `fi-rot-${STAMP}`,
      mode: "weighted",
      context_presell_id: presellId,
      arms: [
        { destination_url: "https://example.com/fi-a", label: "A", order_index: 0, weight: 50 },
        { destination_url: "https://example.com/fi-b", label: "B", order_index: 1, weight: 50 },
      ],
    }),
  });
  const rotId = rot.json?.id as string;

  // I1 — /r/ latency burst
  const rLat: number[] = [];
  let rOk = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/track/r/${presellId}?to=${encodeURIComponent("https://example.com/fi")}`, {
      redirect: "manual",
    });
    rLat.push(performance.now() - t0);
    if (res.status === 302) rOk++;
  }
  rLat.sort((a, b) => a - b);
  const rP95 = pct(rLat, 95);
  const rOkRate = rOk / N;
  add(
    "I1",
    rOkRate >= 0.95 && rP95 < 800 ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    `/r/ burst n=${N} p95<800ms`,
    [`ok=${rOk}/${N}`, `p50=${pct(rLat, 50).toFixed(1)}ms`, `p95=${rP95.toFixed(1)}ms`, `max=${rLat[rLat.length - 1]!.toFixed(1)}ms`],
    rOkRate >= 0.95 && rP95 < 800 ? [] : ["SLO local /r/ falhou"],
  );

  // I2 — /rot latency burst
  const rotLat: number[] = [];
  let rotOk = 0;
  if (rotId) {
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      const res = await fetch(`${BASE}/api/track/rot/${rotId}`, { redirect: "manual" });
      rotLat.push(performance.now() - t0);
      if (res.status === 302) rotOk++;
    }
    rotLat.sort((a, b) => a - b);
    const p95 = pct(rotLat, 95);
    add(
      "I2",
      rotOk / N >= 0.95 && p95 < 800 ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      `/rot burst n=${N} p95<800ms`,
      [`ok=${rotOk}/${N}`, `p50=${pct(rotLat, 50).toFixed(1)}ms`, `p95=${p95.toFixed(1)}ms`],
      rotOk / N >= 0.95 && p95 < 800 ? [] : ["SLO local /rot falhou"],
    );
  } else {
    add("I2", "FALHOU", "/rot burst", [], [`create rot ${rot.status}`]);
  }

  // I3 — health ops track_redirect after burst
  {
    const h = await api("/api/health");
    const tr = h.json?.ops?.track_redirect;
    const ok = h.status === 200 && tr && typeof tr.p95_ms === "number";
    add(
      "I3",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "health.ops.track_redirect após burst",
      [`p50=${tr?.p50_ms}`, `p95=${tr?.p95_ms}`, `slo=${tr?.slo_p95_ms}`, `samples=${tr?.samples}`],
      ok ? [] : ["métricas ausentes"],
    );
  }

  // I4 — pixel + redirect + postback mini E2E
  {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    const pixel = await fetch(`${BASE}/api/track/pixel/${presellId}.gif?utm_source=fasei`);
    const redir = await fetch(`${BASE}/api/track/r/${presellId}?to=${encodeURIComponent("https://example.com/fi")}`, {
      redirect: "manual",
    });
    const loc = redir.headers.get("location") || "";
    let clickId = "";
    try {
      clickId = new URL(loc).searchParams.get("clickora_click_id") || "";
    } catch {
      /* */
    }
    const info = await api("/api/integrations/affiliate-webhook-info", { token });
    let pbToken = "";
    try {
      pbToken = new URL(info.json?.hook_url || "").searchParams.get("token") || "";
    } catch {
      /* */
    }
    const orderId = `FI-E2E-${STAMP}`;
    let pbStatus = 0;
    let convOk = false;
    if (pbToken && clickId && user) {
      const pb = await fetch(
        `${BASE}/api/integrations/affiliate-webhook?token=${encodeURIComponent(pbToken)}&platform=buygoods&status=approved&subid=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=9.99&currency=USD`,
      );
      pbStatus = pb.status;
      const conv = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
      convOk = !!conv && conv.attribution === "attributed" && conv.clickId === clickId;
    }
    const ok = pixel.status === 200 && redir.status === 302 && convOk;
    add(
      "I4",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "mini E2E pixel→click→postback attributed",
      [`pixel=${pixel.status}`, `redir=${redir.status}`, `pb=${pbStatus}`, `attributed=${convOk}`],
      ok ? [] : ["cadeia E2E falhou"],
    );
  }

  // I5 — concurrent /r/ (10 parallel)
  {
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${BASE}/api/track/r/${presellId}?to=${encodeURIComponent("https://example.com/fi")}`, { redirect: "manual" }),
      ),
    );
    const elapsed = performance.now() - t0;
    const oks = results.filter((r) => r.status === 302).length;
    add(
      "I5",
      oks === 10 && elapsed < 3000 ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "10 redirects /r/ em paralelo",
      [`ok=${oks}/10`, `wall=${elapsed.toFixed(1)}ms`],
      oks === 10 && elapsed < 3000 ? [] : ["concorrência falhou"],
    );
  }

  if (rotId) await api(`/api/traffic-rotators/${rotId}`, { method: "DELETE", token }).catch(() => undefined);
  await api(`/api/presells/${presellId}`, { method: "DELETE", token }).catch(() => undefined);
  await prisma.$disconnect();

  const summary = {
    phase: "I",
    stamp: STAMP,
    validated: rows.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: rows.filter((r) => r.status === "FALHOU").length,
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
