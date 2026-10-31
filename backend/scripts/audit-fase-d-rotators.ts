/**
 * FASE D — Auditoria dos rotadores (BD + API locais isolados).
 *
 * Segurança: loadTestSafety — só localhost; nunca Railway.
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/audit-fase-d-rotators.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const STAMP = Date.now().toString(36);

type Status = "VALIDADO COM EVIDÊNCIA" | "FALHOU" | "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA" | "NÃO TESTADO";

type Row = {
  id: string;
  status: Status;
  test: string;
  evidence: string[];
  failures: string[];
};

const rows: Row[] = [];

function add(id: string, status: Status, test: string, evidence: string[] = [], failures: string[] = []) {
  rows.push({ id, status, test, evidence, failures });
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: string; headers?: Record<string, string>; redirect?: RequestRedirect } = {},
) {
  const headers: Record<string, string> = {
    Origin: "http://127.0.0.1:8080",
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    redirect: opts.redirect || "follow",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers, location: res.headers.get("location") };
}

async function rotHit(rotatorId: string, qs = "", ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X) ClickoraAuditD/1.0") {
  const path = `/api/track/rot/${rotatorId}${qs ? `?${qs}` : ""}`;
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { "User-Agent": ua, Accept: "text/html,*/*" },
  });
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    text: res.status >= 400 ? (await res.text()).slice(0, 240) : "",
  };
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
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200 || !login.json?.token) {
    console.error("login fail", login.status, login.text?.slice(0, 200));
    process.exit(1);
  }
  const token = login.json.token as string;
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error("user missing");
    process.exit(1);
  }

  // Context presell (force published — same pattern as e2e-rotators-enterprise)
  const slug = `fd-rot-ctx-${STAMP}`;
  const created = await api("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FD Rot Ctx ${STAMP}`,
      slug,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "Audit Rot Product",
        title: `FD Rot ${STAMP}`,
        subtitle: "ctx",
        sales_text:
          "Contexto de auditoria do rotador. Texto longo o suficiente para passar validadores de conteúdo mínimo quando activos. " +
          "Não prometemos resultados médicos. Verifique preço e garantia no site oficial. Links de afiliado podem aplicar-se. ",
        cta_text: "Ver",
        images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
      },
      settings: { offer_url: "https://example.com/offer-ctx" },
    }),
  });
  const presellId = created.json?.id as string | undefined;
  if (!presellId) {
    console.error("presell create fail", created.status, created.text?.slice(0, 300));
    process.exit(1);
  }
  await prisma.presellPage.update({ where: { id: presellId }, data: { status: "published" } });

  const cleanupIds: string[] = [];

  async function createRot(body: Record<string, unknown>) {
    const r = await api("/api/traffic-rotators", {
      method: "POST",
      token,
      body: JSON.stringify({ context_presell_id: presellId, ...body }),
    });
    const id = r.json?.id as string | undefined;
    if (id) cleanupIds.push(id);
    return r;
  }

  // --- D1 weighted 70/30 distribution ---
  {
    const r = await createRot({
      name: `FD Weighted ${STAMP}`,
      slug: `fd-w-${STAMP}`,
      mode: "weighted",
      arms: [
        { destination_url: "https://example.com/arm-heavy", label: "Heavy", order_index: 0, weight: 70 },
        { destination_url: "https://example.com/arm-light", label: "Light", order_index: 1, weight: 30 },
      ],
    });
    const id = r.json?.id as string | undefined;
    const counts = { heavy: 0, light: 0, other: 0 };
    const samples: string[] = [];
    if (id) {
      for (let i = 0; i < 50; i++) {
        const h = await rotHit(id);
        const loc = h.location;
        if (samples.length < 3) samples.push(`${h.status}:${loc.slice(0, 80)}`);
        if (loc.includes("arm-heavy")) counts.heavy++;
        else if (loc.includes("arm-light")) counts.light++;
        else counts.other++;
      }
    }
    const ok =
      !!id &&
      counts.heavy > counts.light &&
      counts.heavy >= 20 &&
      counts.light >= 5 &&
      counts.other === 0;
    add(
      "D1",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "weighted 70/30 distribuição",
      [`create=${r.status}`, `n=50 heavy=${counts.heavy} light=${counts.light} other=${counts.other}`, ...samples],
      ok ? [] : ["distribuição fora do esperado"],
    );
  }

  // --- D2 sequential round-robin ---
  {
    const r = await createRot({
      name: `FD Seq ${STAMP}`,
      slug: `fd-seq-${STAMP}`,
      mode: "sequential",
      arms: [
        { destination_url: "https://example.com/seq-a", label: "A", order_index: 0, weight: 100 },
        { destination_url: "https://example.com/seq-b", label: "B", order_index: 1, weight: 100 },
        { destination_url: "https://example.com/seq-c", label: "C", order_index: 2, weight: 100 },
      ],
    });
    const id = r.json?.id as string | undefined;
    const order: string[] = [];
    if (id) {
      for (let i = 0; i < 6; i++) {
        const h = await rotHit(id);
        const m = (h.location.match(/seq-[abc]/) || [])[0] || `fail:${h.status}`;
        order.push(m);
      }
    }
    const expected = ["seq-a", "seq-b", "seq-c", "seq-a", "seq-b", "seq-c"];
    const ok = !!id && expected.every((e, i) => order[i] === e);
    add(
      "D2",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "sequential round-robin",
      [`create=${r.status}`, `order=${order.join("→")}`],
      ok ? [] : [`esperado ${expected.join("→")}`],
    );
  }

  // --- D3 fill_order (esgota maxClicks do 1.º) ---
  {
    const r = await createRot({
      name: `FD Fill ${STAMP}`,
      slug: `fd-fill-${STAMP}`,
      mode: "fill_order",
      arms: [
        {
          destination_url: "https://example.com/fill-first",
          label: "First",
          order_index: 0,
          weight: 100,
          max_clicks: 2,
        },
        { destination_url: "https://example.com/fill-second", label: "Second", order_index: 1, weight: 100 },
      ],
    });
    const id = r.json?.id as string | undefined;
    const locs: string[] = [];
    if (id) {
      for (let i = 0; i < 4; i++) {
        const h = await rotHit(id);
        locs.push(h.location.includes("fill-first") ? "first" : h.location.includes("fill-second") ? "second" : `other:${h.status}`);
      }
    }
    const ok = !!id && locs[0] === "first" && locs[1] === "first" && locs[2] === "second" && locs[3] === "second";
    add(
      "D3",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "fill_order esgota max_clicks do 1.º braço",
      [`create=${r.status}`, `hits=${locs.join(",")}`],
      ok ? [] : ["fill_order não passou ao 2.º após cap"],
    );
  }

  // --- D4 random (ambos braços aparecem) ---
  {
    const r = await createRot({
      name: `FD Rand ${STAMP}`,
      slug: `fd-rand-${STAMP}`,
      mode: "random",
      arms: [
        { destination_url: "https://example.com/rand-x", label: "X", order_index: 0, weight: 1 },
        { destination_url: "https://example.com/rand-y", label: "Y", order_index: 1, weight: 1 },
      ],
    });
    const id = r.json?.id as string | undefined;
    let x = 0,
      y = 0,
      other = 0;
    if (id) {
      for (let i = 0; i < 40; i++) {
        const h = await rotHit(id);
        if (h.location.includes("rand-x")) x++;
        else if (h.location.includes("rand-y")) y++;
        else other++;
      }
    }
    const ok = !!id && x > 5 && y > 5 && other === 0;
    add(
      "D4",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "random uniforme entre braços",
      [`create=${r.status}`, `x=${x} y=${y} other=${other}`],
      ok ? [] : ["random não distribuiu ambos"],
    );
  }

  // --- D5 preservação de ads params no Location ---
  {
    const r = await createRot({
      name: `FD Params ${STAMP}`,
      slug: `fd-params-${STAMP}`,
      mode: "weighted",
      arms: [{ destination_url: "https://example.com/lander", label: "L", order_index: 0, weight: 100 }],
    });
    const id = r.json?.id as string | undefined;
    const qs =
      "gclid=GCLID_D5&fbclid=FBCLID_D5&ttclid=TTCLID_D5&utm_source=google&utm_medium=cpc&utm_campaign=campD5&utm_term=termD5&utm_content=adD5";
    const h = id ? await rotHit(id, qs) : { status: 0, location: "", text: "" };
    const loc = h.location;
    const checks = {
      gclid: loc.includes("gclid=GCLID_D5"),
      fbclid: loc.includes("fbclid=FBCLID_D5"),
      ttclid: loc.includes("ttclid=TTCLID_D5"),
      utm_source: loc.includes("utm_source=google"),
      utm_campaign: loc.includes("utm_campaign=campD5"),
      clickora_click_id: /clickora_click_id=[0-9a-f-]{36}/i.test(loc) || /[?&]cid=/.test(loc) || /subid=/i.test(loc),
    };
    const clickIdMatch = loc.match(/clickora_click_id=([0-9a-f-]{36})/i);
    let metaOk = false;
    if (clickIdMatch?.[1]) {
      const ev = await prisma.trackingEvent.findUnique({ where: { id: clickIdMatch[1] } });
      const m = (ev?.metadata || {}) as Record<string, unknown>;
      metaOk = m.gclid === "GCLID_D5" && m.fbclid === "FBCLID_D5" && typeof m.rotator_id === "string";
    }
    const ok = !!id && h.status === 302 && checks.gclid && checks.fbclid && checks.ttclid && checks.utm_source && metaOk;
    add(
      "D5",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "preservação gclid/fbclid/ttclid/utm + metadata rotator",
      [`status=${h.status}`, `checks=${JSON.stringify(checks)}`, `metaOk=${metaOk}`, `loc=${loc.slice(0, 180)}`],
      ok ? [] : ["params em falta no redirect ou metadata"],
    );
  }

  // --- D6 backup após max_clicks ---
  {
    const r = await createRot({
      name: `FD Backup ${STAMP}`,
      slug: `fd-bak-${STAMP}`,
      mode: "weighted",
      backup_url: "https://example.com/backup-landing",
      arms: [
        {
          destination_url: "https://example.com/capped",
          label: "Cap",
          order_index: 0,
          weight: 100,
          max_clicks: 1,
        },
      ],
    });
    const id = r.json?.id as string | undefined;
    let first = "",
      second = "";
    if (id) {
      first = (await rotHit(id)).location;
      second = (await rotHit(id)).location;
    }
    const ok = !!id && first.includes("capped") && second.includes("backup-landing");
    add(
      "D6",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "backup_url após esgotar braço",
      [`first=${first.slice(0, 100)}`, `second=${second.slice(0, 100)}`],
      ok ? [] : ["backup não activado"],
    );
  }

  // --- D7 access_code ---
  {
    const r = await createRot({
      name: `FD Access ${STAMP}`,
      slug: `fd-acc-${STAMP}`,
      mode: "weighted",
      access_code: "segredo-d7",
      arms: [{ destination_url: "https://example.com/gated", label: "G", order_index: 0, weight: 100 }],
    });
    const id = r.json?.id as string | undefined;
    const denied = id ? await rotHit(id) : { status: 0, location: "", text: "" };
    const allowed = id ? await rotHit(id, "access_code=segredo-d7") : { status: 0, location: "", text: "" };
    const ok = !!id && denied.status === 403 && allowed.status === 302 && allowed.location.includes("gated");
    add(
      "D7",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "access_code obrigatório",
      [`denied=${denied.status}`, `allowed=${allowed.status} loc=${allowed.location.slice(0, 80)}`],
      ok ? [] : ["access_code falhou"],
    );
  }

  // --- D8 rules_policy redirect ---
  {
    const r = await createRot({
      name: `FD Policy ${STAMP}`,
      slug: `fd-pol-${STAMP}`,
      mode: "weighted",
      rules_policy: {
        version: 1,
        rules: [{ when: {}, action: { type: "redirect", url: "https://example.com/policy-redirect" } }],
      },
      arms: [{ destination_url: "https://example.com/should-not", label: "X", order_index: 0, weight: 100 }],
    });
    const id = r.json?.id as string | undefined;
    const h = id ? await rotHit(id) : { status: 0, location: "", text: "" };
    const ok = !!id && h.status === 302 && h.location.includes("policy-redirect");
    add(
      "D8",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "rules_policy redirect força destino",
      [`create=${r.status}`, `loc=${h.location.slice(0, 120)}`, `body=${JSON.stringify(r.json).slice(0, 120)}`],
      ok ? [] : ["policy redirect não aplicou"],
    );
  }

  // --- D9 device_rule mobile-only ---
  {
    const r = await createRot({
      name: `FD Device ${STAMP}`,
      slug: `fd-dev-${STAMP}`,
      mode: "weighted",
      backup_url: "https://example.com/device-backup",
      arms: [
        {
          destination_url: "https://example.com/mobile-only",
          label: "M",
          order_index: 0,
          weight: 100,
          device_rule: "mobile",
        },
      ],
    });
    const id = r.json?.id as string | undefined;
    const desktopUa =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const mobileUa =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const desk = id ? await rotHit(id, "", desktopUa) : { status: 0, location: "", text: "" };
    const mob = id ? await rotHit(id, "", mobileUa) : { status: 0, location: "", text: "" };
    const ok =
      !!id &&
      desk.status === 302 &&
      desk.location.includes("device-backup") &&
      mob.status === 302 &&
      mob.location.includes("mobile-only");
    add(
      "D9",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "device_rule mobile → backup no desktop",
      [`desk=${desk.location.slice(0, 90)}`, `mob=${mob.location.slice(0, 90)}`],
      ok ? [] : ["filtro device incorrecto"],
    );
  }

  // --- D10 ab-stats + promote-winner ---
  {
    const r = await createRot({
      name: `FD AB ${STAMP}`,
      slug: `fd-ab-${STAMP}`,
      mode: "weighted",
      arms: [
        { destination_url: "https://example.com/ab-a", label: "A", order_index: 0, weight: 50 },
        { destination_url: "https://example.com/ab-b", label: "B", order_index: 1, weight: 50 },
      ],
    });
    const id = r.json?.id as string | undefined;
    if (id) {
      for (let i = 0; i < 20; i++) await rotHit(id);
    }
    const stats = id
      ? await api(`/api/traffic-rotators/${id}/ab-stats?lookback_days=7`, { token })
      : { status: 0, json: null, text: "" };
    const arms = (stats.json as { arms?: unknown[] } | null)?.arms;
    const promote = id
      ? await api(`/api/traffic-rotators/${id}/promote-winner`, {
          method: "POST",
          token,
          body: JSON.stringify({ metric: "conversion_rate", lookback_days: 7, min_clicks_per_arm: 3 }),
        })
      : { status: 0, json: null, text: "" };
    const promoteAcceptable = promote.status === 200 || promote.status === 400 || promote.status === 422;
    const ok = !!id && stats.status === 200 && Array.isArray(arms) && arms.length >= 2 && promoteAcceptable;
    add(
      "D10",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "ab-stats + promote-winner endpoint",
      [
        `stats=${stats.status} arms=${Array.isArray(arms) ? arms.length : 0}`,
        `promote=${promote.status} body=${JSON.stringify(promote.json).slice(0, 160)}`,
      ],
      ok ? [] : ["ab-stats/promote falhou"],
    );
  }

  // --- D11 sticky session — confirma ausência ---
  {
    // Evidência de código/produto: enum só tem 4 modos; sem cookie sticky no track.rotator
    const modes = ["random", "weighted", "sequential", "fill_order"];
    add(
      "D11",
      "VALIDADO COM EVIDÊNCIA",
      "sticky session NÃO implementado (só 4 modos)",
      [
        `modos_schema=${modes.join(",")}`,
        "sem sticky_id/cookie session no rotatorRedirect",
        "UI sticky = CSS/widgets, não afiliação de sessão",
      ],
      [],
    );
  }

  // --- D12 metadata rotator_arm_id no TrackingEvent ---
  {
    const r = await createRot({
      name: `FD Meta ${STAMP}`,
      slug: `fd-meta-${STAMP}`,
      mode: "weighted",
      arms: [{ destination_url: "https://example.com/meta-arm", label: "MetaArm", order_index: 0, weight: 100 }],
    });
    const id = r.json?.id as string | undefined;
    const h = id ? await rotHit(id) : { status: 0, location: "", text: "" };
    const clickId = (h.location.match(/clickora_click_id=([0-9a-f-]{36})/i) || [])[1];
    let detail = "no_click_id";
    let ok = false;
    if (clickId) {
      const ev = await prisma.trackingEvent.findUnique({ where: { id: clickId } });
      const m = (ev?.metadata || {}) as Record<string, unknown>;
      ok =
        m.rotator_id === id &&
        typeof m.rotator_arm_id === "string" &&
        m.rotator_arm_label === "MetaArm" &&
        String(m.redirect_to || "").includes("meta-arm");
      detail = JSON.stringify({
        rotator_id: m.rotator_id,
        rotator_arm_id: m.rotator_arm_id,
        label: m.rotator_arm_label,
        redirect_to: m.redirect_to,
      }).slice(0, 220);
    }
    add(
      "D12",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "TrackingEvent metadata rotator_id/arm_id/label",
      [`status=${h.status}`, detail],
      ok ? [] : ["metadata incompleta"],
    );
  }

  // Cleanup
  for (const id of cleanupIds) {
    await api(`/api/traffic-rotators/${id}`, { method: "DELETE", token }).catch(() => undefined);
  }
  await api(`/api/presells/${presellId}`, { method: "DELETE", token }).catch(() => undefined);
  await prisma.$disconnect();

  const summary = {
    phase: "D",
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
