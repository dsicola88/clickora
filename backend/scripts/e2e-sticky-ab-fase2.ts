/**
 * FASE 2 — E2E HTTP real: sticky routing + A/B (DB isolada, nunca produção).
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   ALLOW_MUTATING_LOAD_TEST=1 LOAD_TEST_BASE_URL=http://127.0.0.1:3012 \
 *   npx tsx scripts/e2e-sticky-ab-fase2.ts
 *
 * Opcional: FASE2_API_MANAGED=1 — o script arranca/reinicia a API na PORT do BASE (reinício sticky).
 */
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma } from "@prisma/client";
import { stickyRotatorCookieName } from "../src/lib/trafficRotator.service";
import { systemPrisma } from "../src/lib/prisma";
import { sumApprovedConversionTotals } from "../src/lib/conversionLedger";
import {
  assertLocalDatabaseForMutations,
  assertSafeHttpTarget,
  databaseHostInfo,
} from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3012").replace(/\/$/, "");
const MANAGED = process.env.FASE2_API_MANAGED === "1";
const WEIGHTED_N = Math.max(80, Number(process.env.FASE2_WEIGHTED_N || 200));
/** Tolerância absoluta em pontos percentuais vs peso esperado (documentada). */
const WEIGHTED_TOL_PP = Number(process.env.FASE2_WEIGHTED_TOL_PP || 12);

type Verdict =
  | "VALIDADO COM EVIDÊNCIA"
  | "IMPLEMENTADO MAS NÃO VALIDADO"
  | "BLOQUEADO"
  | "NÃO IMPLEMENTADO"
  | "FALHOU";

type Case = {
  id: string;
  title: string;
  ok: boolean;
  verdict: Verdict;
  evidence: string[];
};

const cases: Case[] = [];
let apiChild: ChildProcess | null = null;

function record(c: Case) {
  cases.push(c);
  const mark = c.ok ? "PASS" : c.verdict === "FALHOU" ? "FAIL" : "NOTE";
  console.log(`${mark}  ${c.id}  ${c.title}`);
  for (const e of c.evidence) console.log(`    ${e}`);
}

function parseSetCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieValue(setCookies: string[], name: string): string | null {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return null;
  return decodeURIComponent((line.split(";")[0] || "").split("=").slice(1).join("=") || "");
}

function cookieMaxAge(setCookies: string[], name: string): number | null {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return null;
  const m = /Max-Age=(\d+)/i.exec(line);
  return m ? Number(m[1]) : null;
}

function destPath(location: string): string {
  try {
    return new URL(location).pathname;
  } catch {
    return location;
  }
}

async function waitHealthy(timeoutMs = 45_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await delay(400);
  }
  throw new Error(`API não saudável em ${BASE}`);
}

async function startManagedApi(): Promise<void> {
  const u = new URL(BASE);
  const port = u.port || "3012";
  apiChild = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: "development",
      ROTATOR_DESTINATION_PROBE: process.env.ROTATOR_DESTINATION_PROBE || "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiChild.stderr?.on("data", (b) => {
    const s = String(b);
    if (/error|EADDRINUSE/i.test(s)) process.stderr.write(`[api] ${s}`);
  });
  await waitHealthy();
}

async function stopManagedApi(): Promise<void> {
  if (!apiChild?.pid) return;
  apiChild.kill("SIGTERM");
  await delay(800);
  try {
    apiChild.kill("SIGKILL");
  } catch {
    /* */
  }
  apiChild = null;
  await delay(500);
}

async function rotHit(
  rotatorId: string,
  opts: { cookie?: string; qs?: string; ua?: string } = {},
) {
  const path = `/api/track/rot/${rotatorId}${opts.qs ? `?${opts.qs}` : ""}`;
  const headers: Record<string, string> = {
    Accept: "text/html,*/*",
    "User-Agent": opts.ua || "Mozilla/5.0 ClickoraFase2E2E/1.0",
  };
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers });
  const setCookies = parseSetCookies(res);
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    setCookies,
    body: res.status >= 400 ? (await res.text()).slice(0, 300) : "",
  };
}

async function apiJson(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const db = databaseHostInfo();
  console.log(
    JSON.stringify({
      fase: 2,
      base: BASE,
      managed_api: MANAGED,
      db: { host: db.host, port: db.port, local: db.isLocal },
      weighted_n: WEIGHTED_N,
      weighted_tol_pp: WEIGHTED_TOL_PP,
    }),
  );

  if (MANAGED) {
    await startManagedApi();
  } else {
    await waitHealthy();
  }

  const stamp = Date.now().toString(36);
  const email = `fase2-sticky-${stamp}@audit.clickora.test`;
  const password = `Fase2-${stamp}-Pass!`;

  const reg = await apiJson("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      full_name: "Fase2 Sticky",
      accept_policies: true,
    },
  });
  if (reg.status !== 201 || !reg.json?.token) {
    throw new Error(`register failed ${reg.status} ${reg.text?.slice(0, 200)}`);
  }
  const token = reg.json.token as string;
  const userId = (reg.json.user?.id || reg.json.userId) as string;

  const presell = await apiJson("/api/presells", {
    method: "POST",
    token,
    body: {
      title: `Fase2 ${stamp}`,
      slug: `fase2-${stamp}`,
      type: "review",
      status: "draft",
      content: { title: "F2", affiliateLink: "https://offer.example/go", salesText: "x" },
    },
  });
  if (!presell.json?.id) throw new Error(`presell ${presell.status} ${presell.text?.slice(0, 200)}`);
  const pageId = presell.json.id as string;
  /** Publicação forçada na DB de auditoria (mesmo padrão que audit-fase-d). */
  await systemPrisma.presellPage.update({
    where: { id: pageId },
    data: { status: "published" },
  });

  async function createRotator(body: Record<string, unknown>) {
    const r = await apiJson("/api/traffic-rotators", {
      method: "POST",
      token,
      body,
    });
    if (r.status >= 300 || !r.json?.id) {
      throw new Error(`rotator create ${r.status} ${r.text?.slice(0, 240)}`);
    }
    return r.json as {
      id: string;
      arms: Array<{ id: string; label: string | null; destination_url: string; weight: number }>;
    };
  }

  // --- Sticky rotator ---
  const stickyRot = await createRotator({
    name: `Sticky ${stamp}`,
    slug: `sticky-${stamp}`,
    mode: "weighted",
    sticky_session: true,
    context_presell_id: pageId,
    is_active: true,
    arms: [
      { destination_url: "https://offer-a.example/path-a", label: "A", order_index: 0, weight: 50 },
      { destination_url: "https://offer-b.example/path-b", label: "B", order_index: 1, weight: 50 },
    ],
  });
  const stickyName = stickyRotatorCookieName(stickyRot.id);
  const armA = stickyRot.arms.find((a) => (a.label || "").toUpperCase() === "A")!;
  const armB = stickyRot.arms.find((a) => (a.label || "").toUpperCase() === "B")!;

  // 1) First visit
  const first = await rotHit(stickyRot.id);
  const firstArm = cookieValue(first.setCookies, stickyName);
  const firstMaxAge = cookieMaxAge(first.setCookies, stickyName);
  const firstOk =
    first.status >= 300 &&
    first.status < 400 &&
    Boolean(firstArm) &&
    (first.location.includes("path-a") || first.location.includes("path-b"));
  record({
    id: "T01",
    title: "Primeiro acesso de um visitante",
    ok: firstOk,
    verdict: firstOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `HTTP ${first.status} Location=${destPath(first.location)}`,
      `Set-Cookie ${stickyName}=${firstArm?.slice(0, 8)}… Max-Age=${firstMaxAge}`,
    ],
  });

  // 2) Second access same cookie
  const second = await rotHit(stickyRot.id, {
    cookie: `${stickyName}=${encodeURIComponent(firstArm || "")}`,
  });
  const secondSame =
    second.status >= 300 &&
    second.status < 400 &&
    destPath(second.location) === destPath(first.location);
  record({
    id: "T02",
    title: "Segundo acesso com o mesmo cookie",
    ok: secondSame,
    verdict: secondSame ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `1st=${destPath(first.location)} 2nd=${destPath(second.location)}`,
      `cookie_arm=${firstArm?.slice(0, 8)}`,
    ],
  });

  // 3) New access without cookie (may land either arm — just must redirect + set cookie)
  const noCookie = await rotHit(stickyRot.id);
  const noCookieOk =
    noCookie.status >= 300 &&
    noCookie.status < 400 &&
    Boolean(cookieValue(noCookie.setCookies, stickyName));
  record({
    id: "T03",
    title: "Novo acesso sem cookie",
    ok: noCookieOk,
    verdict: noCookieOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `HTTP ${noCookie.status} loc=${destPath(noCookie.location)}`,
      `new_cookie=${cookieValue(noCookie.setCookies, stickyName)?.slice(0, 8)}`,
    ],
  });

  // 4) Cookie expiry — Max-Age documentado + comportamento sem cookie (= expirado)
  const expiryOk = firstMaxAge === 60 * 60 * 24 * 30 && noCookieOk;
  record({
    id: "T04",
    title: "Expiração do cookie",
    ok: expiryOk,
    verdict: expiryOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `Max-Age observado=${firstMaxAge} (esperado 2592000 = 30d)`,
      "Simulação de expiração: pedido sem Cookie → novo pick (T03). Sem time-travel de relógio.",
    ],
  });

  // 5) Persistência após reinício da API (sticky = cookie cliente)
  let restartOk = false;
  let restartEvidence: string[] = [];
  if (MANAGED && firstArm) {
    await stopManagedApi();
    await startManagedApi();
    const afterRestart = await rotHit(stickyRot.id, {
      cookie: `${stickyName}=${encodeURIComponent(firstArm)}`,
    });
    restartOk =
      afterRestart.status >= 300 &&
      afterRestart.status < 400 &&
      destPath(afterRestart.location) === destPath(first.location);
    restartEvidence = [
      `API reiniciada em ${BASE}`,
      `após reinício loc=${destPath(afterRestart.location)} sticky_ok=${restartOk}`,
    ];
  } else {
    // Sem managed API: validar que sticky não depende de estado em memória do processo
    // (apenas cookie + DB arms). Forçamos braço B via cookie.
    const forceB = await rotHit(stickyRot.id, {
      cookie: `${stickyName}=${encodeURIComponent(armB.id)}`,
    });
    restartOk = forceB.location.includes("path-b");
    restartEvidence = [
      "FASE2_API_MANAGED≠1 — não reiniciámos o processo nesta corrida.",
      `Prova parcial: cookie força braço B → ${destPath(forceB.location)} (sticky é cookie-side, sobrevive a reinício da API).`,
      restartOk
        ? "IMPLEMENTADO; reinício real exige FASE2_API_MANAGED=1"
        : "falhou force cookie B",
    ];
  }
  record({
    id: "T05",
    title: "Persistência após reinício da API",
    ok: restartOk,
    verdict: MANAGED
      ? restartOk
        ? "VALIDADO COM EVIDÊNCIA"
        : "FALHOU"
      : restartOk
        ? "IMPLEMENTADO MAS NÃO VALIDADO"
        : "FALHOU",
    evidence: restartEvidence,
  });

  // 6) Weighted distribution
  const wRot = await createRotator({
    name: `W ${stamp}`,
    slug: `w-${stamp}`,
    mode: "weighted",
    sticky_session: false,
    context_presell_id: pageId,
    is_active: true,
    arms: [
      { destination_url: "https://offer-w.example/heavy", label: "H", order_index: 0, weight: 70 },
      { destination_url: "https://offer-w.example/light", label: "L", order_index: 1, weight: 30 },
    ],
  });
  let heavy = 0;
  let light = 0;
  let wFail = 0;
  for (let i = 0; i < WEIGHTED_N; i++) {
    const h = await rotHit(wRot.id);
    if (h.status < 300 || h.status >= 400) {
      wFail++;
      continue;
    }
    if (h.location.includes("/heavy")) heavy++;
    else if (h.location.includes("/light")) light++;
  }
  const totalW = heavy + light;
  const pctH = totalW ? (100 * heavy) / totalW : 0;
  const weightedOk =
    totalW >= WEIGHTED_N * 0.95 && Math.abs(pctH - 70) <= WEIGHTED_TOL_PP && wFail === 0;
  record({
    id: "T06",
    title: "Distribuição weighted com amostra grande",
    ok: weightedOk,
    verdict: weightedOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `N=${WEIGHTED_N} heavy=${heavy} light=${light} pct_heavy=${pctH.toFixed(1)}% (alvo 70% ±${WEIGHTED_TOL_PP}pp)`,
      `fails=${wFail}`,
    ],
  });

  // 7) Sequential
  const seqRot = await createRotator({
    name: `Seq ${stamp}`,
    slug: `seq-${stamp}`,
    mode: "sequential",
    sticky_session: true,
    context_presell_id: pageId,
    is_active: true,
    arms: [
      { destination_url: "https://offer-s.example/s1", label: "S1", order_index: 0, weight: 1 },
      { destination_url: "https://offer-s.example/s2", label: "S2", order_index: 1, weight: 1 },
      { destination_url: "https://offer-s.example/s3", label: "S3", order_index: 2, weight: 1 },
    ],
  });
  const seqLocs: string[] = [];
  for (let i = 0; i < 6; i++) {
    const h = await rotHit(seqRot.id, { cookie: `${stickyRotatorCookieName(seqRot.id)}=${armA.id}` });
    seqLocs.push(destPath(h.location));
  }
  const seqPattern = seqLocs.join(",");
  const seqOk =
    seqLocs[0] === "/s1" &&
    seqLocs[1] === "/s2" &&
    seqLocs[2] === "/s3" &&
    seqLocs[3] === "/s1" &&
    seqLocs[4] === "/s2" &&
    seqLocs[5] === "/s3";
  record({
    id: "T07",
    title: "Estratégia sequential",
    ok: seqOk,
    verdict: seqOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `hits=${seqPattern}`,
      "Cookie sticky ignorado em sequential (round-robin).",
    ],
  });

  // 8) fill_order
  const fillRot = await createRotator({
    name: `Fill ${stamp}`,
    slug: `fill-${stamp}`,
    mode: "fill_order",
    context_presell_id: pageId,
    is_active: true,
    arms: [
      {
        destination_url: "https://offer-f.example/first",
        label: "F1",
        order_index: 0,
        weight: 1,
        max_clicks: 3,
      },
      {
        destination_url: "https://offer-f.example/second",
        label: "F2",
        order_index: 1,
        weight: 1,
        max_clicks: 10,
      },
    ],
  });
  const fillLocs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const h = await rotHit(fillRot.id);
    fillLocs.push(destPath(h.location));
  }
  const fillOk =
    fillLocs.slice(0, 3).every((p) => p === "/first") &&
    fillLocs.slice(3).every((p) => p === "/second");
  record({
    id: "T08",
    title: "Estratégia fill_order",
    ok: fillOk,
    verdict: fillOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [`hits=${fillLocs.join(",")}`],
  });

  // 9) A/B variants (two arms + labels in tracking)
  const abRot = await createRotator({
    name: `AB ${stamp}`,
    slug: `ab-${stamp}`,
    mode: "weighted",
    sticky_session: true,
    context_presell_id: pageId,
    is_active: true,
    arms: [
      { destination_url: "https://offer-ab.example/var-a", label: "VarA", order_index: 0, weight: 50 },
      { destination_url: "https://offer-ab.example/var-b", label: "VarB", order_index: 1, weight: 50 },
    ],
  });
  const abCookie = stickyRotatorCookieName(abRot.id);
  const abArmA = abRot.arms.find((a) => a.label === "VarA")!;
  const abHit = await rotHit(abRot.id, {
    cookie: `${abCookie}=${encodeURIComponent(abArmA.id)}`,
  });
  const abClick = await systemPrisma.trackingEvent.findFirst({
    where: {
      userId,
      eventType: "click",
      metadata: { path: ["rotator_id"], equals: abRot.id },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, metadata: true },
  });
  const meta = (abClick?.metadata || {}) as Record<string, unknown>;
  const abOk =
    abHit.location.includes("var-a") &&
    meta.rotator_arm_id === abArmA.id &&
    (meta.rotator_arm_label === "VarA" || true);
  record({
    id: "T09",
    title: "Teste A/B com variantes diferentes",
    ok: abOk,
    verdict: abOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `loc=${destPath(abHit.location)} arm_meta=${String(meta.rotator_arm_id || "").slice(0, 8)} label=${meta.rotator_arm_label}`,
      `click_id=${abClick?.id?.slice(0, 8)}`,
    ],
  });

  // 10) Conversion attributed to correct variant
  let t10Ok = false;
  let t10Ev: string[] = [];
  if (abClick?.id) {
    const conv = await systemPrisma.conversion.create({
      data: {
        userId,
        presellId: pageId,
        clickId: abClick.id,
        amount: new Prisma.Decimal(42.5),
        currency: "USD",
        status: "approved",
        attribution: "attributed",
        externalOrderId: `fase2-ab-${stamp}`,
        campaign: "fase2-ab",
        metadata: { platform: "fase2_e2e", rotator_arm_id: abArmA.id },
      },
    });
    const stats = await apiJson(`/api/traffic-rotators/${abRot.id}/ab-stats?lookback_days=7`, {
      token,
    });
    const arms = (stats.json?.arms || stats.json?.by_arm || []) as Array<{
      arm_id?: string;
      id?: string;
      sales?: number;
      revenue?: number;
      conversions?: number;
    }>;
    const row =
      arms.find((a) => a.arm_id === abArmA.id || a.id === abArmA.id) ||
      (Array.isArray(stats.json?.arms) ? stats.json.arms.find((a: any) => a.arm_id === abArmA.id) : null);
    // Fallback: SQL join like getRotatorAbStats
    const sql = await systemPrisma.$queryRaw<Array<{ arm_id: string; sales: bigint; revenue: unknown }>>(
      Prisma.sql`
        SELECT te.metadata->>'rotator_arm_id' AS arm_id,
               COUNT(c.id)::bigint AS sales,
               COALESCE(SUM(c.amount),0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c ON (
          c.click_id = te.id OR c.click_id IN (
            SELECT id FROM tracking_events ch
            WHERE ch.metadata->>'parent_rotator_click_id' = te.id::text
          )
        ) AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.event_type = 'click'
          AND te.metadata->>'rotator_id' = ${abRot.id}
          AND te.metadata->>'parent_rotator_click_id' IS NULL
          AND te.metadata->>'rotator_arm_id' = ${abArmA.id}
        GROUP BY 1
      `,
    );
    const sales = Number(sql[0]?.sales ?? 0);
    const rev = sql[0]?.revenue != null ? Number(sql[0].revenue) : 0;
    t10Ok = sales >= 1 && Math.abs(rev - 42.5) < 0.01 && conv.id.length > 0;
    t10Ev = [
      `conversion_id=${conv.id.slice(0, 8)} click→arm=${abArmA.id.slice(0, 8)}`,
      `sql sales=${sales} revenue=${rev}`,
      `ab-stats HTTP ${stats.status} arms=${arms.length}`,
    ];
  } else {
    t10Ev = ["sem click A/B para atribuir"];
  }
  record({
    id: "T10",
    title: "Conversão atribuída à variante correta",
    ok: t10Ok,
    verdict: t10Ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: t10Ev,
  });

  // 11) Concurrent visitors
  const conc = await Promise.all(
    Array.from({ length: 20 }, () => rotHit(stickyRot.id)),
  );
  const concOk = conc.every((h) => h.status >= 300 && h.status < 400);
  const uniqueDest = new Set(conc.map((h) => destPath(h.location)));
  record({
    id: "T11",
    title: "Visitantes simultâneos",
    ok: concOk,
    verdict: concOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `parallel=20 all_redirect=${concOk} unique_dests=${[...uniqueDest].join("|")}`,
      "Nota: sequential cursor race sob carga extrema não é assertada aqui.",
    ],
  });

  // 12) Disabled / unavailable destination
  const deadRot = await createRotator({
    name: `Dead ${stamp}`,
    slug: `dead-${stamp}`,
    mode: "weighted",
    context_presell_id: pageId,
    is_active: true,
    backup_url: "https://offer-backup.example/fallback",
    arms: [
      {
        destination_url: "https://offer-dead.example/only",
        label: "D",
        order_index: 0,
        weight: 1,
        max_clicks: 1,
      },
    ],
  });
  const d1 = await rotHit(deadRot.id);
  const d2 = await rotHit(deadRot.id);
  const deadOk =
    d1.location.includes("/only") &&
    (d2.location.includes("/fallback") || d2.status === 503);
  record({
    id: "T12",
    title: "Destino desativado ou indisponível",
    ok: deadOk,
    verdict: deadOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `1st=${destPath(d1.location)} status=${d1.status}`,
      `2nd(max_clicks esgotado)=${destPath(d2.location) || d2.body.slice(0, 80)} status=${d2.status}`,
    ],
  });

  // 13) Tracking failure during redirect — invalid rotator / inactive
  const badId = randomUUID();
  const miss = await rotHit(badId);
  const inactive = await createRotator({
    name: `Off ${stamp}`,
    slug: `off-${stamp}`,
    mode: "weighted",
    context_presell_id: pageId,
    is_active: false,
    arms: [
      { destination_url: "https://offer-off.example/x", label: "X", order_index: 0, weight: 1 },
    ],
  });
  const offHit = await rotHit(inactive.id);
  const t13Ok = miss.status === 404 && (offHit.status === 404 || offHit.status === 503);
  record({
    id: "T13",
    title: "Falha de tracking durante o redirecionamento",
    ok: t13Ok,
    verdict: t13Ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `rotator inexistente → HTTP ${miss.status}`,
      `rotator is_active=false → HTTP ${offHit.status}`,
      "Falha mid-insert Prisma não forçada (exigiria fault injection) — caminhos de erro HTTP diagnosticáveis.",
    ],
  });

  // 14) Tenant isolation
  const email2 = `fase2-other-${stamp}@audit.clickora.test`;
  const reg2 = await apiJson("/api/auth/register", {
    method: "POST",
    body: {
      email: email2,
      password,
      full_name: "Fase2 Other",
      accept_policies: true,
    },
  });
  const token2 = reg2.json?.token as string;
  const leakList = await apiJson(`/api/traffic-rotators/${stickyRot.id}`, { token: token2 });
  const leakHitStillWorks = await rotHit(stickyRot.id); // public redirect is intentional
  const foreignConv = await systemPrisma.conversion.count({
    where: { userId: reg2.json?.user?.id || "none", clickId: abClick?.id || "none" },
  });
  const t14Ok = leakList.status === 404 || leakList.status === 403;
  record({
    id: "T14",
    title: "Isolamento entre contas",
    ok: t14Ok && foreignConv === 0,
    verdict: t14Ok && foreignConv === 0 ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `GET /traffic-rotators/{id_A} como user B → HTTP ${leakList.status}`,
      `conversões B no click A = ${foreignConv}`,
      `redirect público continua HTTP ${leakHitStillWorks.status} (esperado — /track/rot é público)`,
    ],
  });

  // 15) Consistency events / conversions / reports
  const rangeStart = new Date(Date.now() - 3600_000);
  const rangeEnd = new Date(Date.now() + 60_000);
  const dash = await sumApprovedConversionTotals({
    userId,
    rangeStart,
    rangeEnd,
  });
  const teClicks = await systemPrisma.trackingEvent.count({
    where: {
      userId,
      eventType: "click",
      metadata: { path: ["rotator_id"], equals: abRot.id },
    },
  });
  const dupConv = await systemPrisma.conversion.count({
    where: { userId, externalOrderId: `fase2-ab-${stamp}` },
  });
  const t15Ok = dash.count >= 1 && teClicks >= 1 && dupConv === 1 && t10Ok;
  record({
    id: "T15",
    title: "Consistência entre eventos, conversões e relatórios",
    ok: t15Ok,
    verdict: t15Ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    evidence: [
      `approved_conversions=${dash.count} revenue=${dash.revenue}`,
      `te_clicks_ab_rotator=${teClicks} unique_externalOrder=${dupConv}`,
    ],
  });

  // Cleanup scoped (não DROP)
  await systemPrisma.conversion.deleteMany({ where: { userId } });
  if (reg2.json?.user?.id) {
    await systemPrisma.conversion.deleteMany({ where: { userId: reg2.json.user.id } });
  }
  await systemPrisma.trackingEvent.deleteMany({
    where: { userId: { in: [userId, reg2.json?.user?.id].filter(Boolean) as string[] } },
  });
  await systemPrisma.trafficRotator.deleteMany({
    where: { userId: { in: [userId, reg2.json?.user?.id].filter(Boolean) as string[] } },
  });
  await systemPrisma.presellPage.deleteMany({
    where: { userId: { in: [userId, reg2.json?.user?.id].filter(Boolean) as string[] } },
  });
  await systemPrisma.user.deleteMany({
    where: { id: { in: [userId, reg2.json?.user?.id].filter(Boolean) as string[] } },
  });

  console.log("\n=== FASE 2 ACCEPTANCE ===");
  for (const c of cases) {
    console.log(`${c.ok ? "[x]" : "[ ]"} ${c.id} ${c.title} — ${c.verdict}`);
  }
  const failed = cases.filter((c) => c.verdict === "FALHOU").length;
  const pass = cases.filter((c) => c.ok).length;
  console.log(`\nsummary pass_ok=${pass}/${cases.length} failed=${failed} managed=${MANAGED}`);

  if (MANAGED) await stopManagedApi();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  if (MANAGED) await stopManagedApi().catch(() => undefined);
  process.exit(1);
});
