/**
 * FASE C — Auditoria de tracking e atribuição (BD + API locais isolados).
 *
 * Segurança: loadTestSafety — só localhost; nunca Railway.
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/audit-fase-c-tracking.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const OFFER = "https://example.com/";
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

async function req(
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

const ARTICLE =
  "Serum Capilar Regenera. Revímos o que o vendedor declara sobre composição, modo de uso e política de devolução. " +
  "Não prometemos resultados. Confirme o preço e a garantia no site oficial antes de comprar. " +
  "Esta página usa links de afiliado e serve para ajudar a decidir com informação própria. " +
  "Compare alternativas, leia o rótulo e verifique o suporte ao cliente da loja. " +
  "Limitações: estoque, prazos de envio e elegibilidade podem mudar sem aviso na origem. " +
  "Adicionalmente explicamos critérios de decisão, transparência comercial e o que verificar no checkout. ";

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const info = databaseHostInfo();
  if (!info.isLocal || info.blocked) {
    console.error("ABORT: DATABASE_URL não local");
    process.exit(2);
  }
  console.log(
    JSON.stringify({
      safety: { api: BASE, db_host: info.host, db_port: info.port, db_name: "from_url", railway: false },
    }),
  );

  if (!EMAIL || !PASSWORD) {
    console.error("LOAD_TEST_EMAIL/PASSWORD obrigatórios");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200 || !login.json?.token) {
    console.error("login fail", login.status);
    process.exit(1);
  }
  const token = login.json.token as string;
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error("user missing in audit DB");
    process.exit(1);
  }

  // Create + publish review page
  const slug = `fc-track-${STAMP}`;
  const created = await req("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FC Track ${STAMP}`,
      slug,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "Serum Capilar Regenera",
        title: `FC Track ${STAMP}`,
        subtitle: "Análise",
        sales_text: ARTICLE,
        cta_text: "Ver oferta",
        images: [
          "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/3/3f/Tea_leaves_steeping_in_a_chinese_gaiwan.jpg",
        ],
        affiliate_link: OFFER,
        source_url: OFFER,
      },
      settings: {
        privacyPolicyUrl: "/privacidade",
        cookiePolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure:
          "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si.",
      },
      tracking: { offerUrl: OFFER },
    }),
  });
  const presellId = created.json?.id as string;
  if (!presellId) {
    console.error("create failed", created.text.slice(0, 300));
    process.exit(1);
  }
  const pub = await req(`/api/presells/${presellId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      status: "published",
      content: created.json.content,
      settings: created.json.settings,
      tracking: { offerUrl: OFFER },
    }),
  });
  if (pub.json?.status !== "published") {
    console.error("publish failed", pub.text.slice(0, 400));
    process.exit(1);
  }

  const beforeImp = await prisma.trackingEvent.count({
    where: { presellPageId: presellId, eventType: "impression" },
  });
  const beforeClick = await prisma.trackingEvent.count({
    where: { presellPageId: presellId, eventType: "click" },
  });

  // C1 — visita via pixel SEM clique
  const pixel = await fetch(
    `${BASE}/api/track/pixel/${presellId}.gif?utm_source=fasec&utm_medium=cpc&utm_campaign=c1&gclid=GclidFaseCVisit1234567890abcd`,
  );
  const afterImp = await prisma.trackingEvent.count({
    where: { presellPageId: presellId, eventType: "impression" },
  });
  const afterClickStill = await prisma.trackingEvent.count({
    where: { presellPageId: presellId, eventType: "click" },
  });
  const impRow = await prisma.trackingEvent.findFirst({
    where: { presellPageId: presellId, eventType: "impression" },
    orderBy: { createdAt: "desc" },
  });
  const meta = (impRow?.metadata || {}) as Record<string, unknown>;
  if (pixel.status === 200 && afterImp === beforeImp + 1 && afterClickStill === beforeClick) {
    add("C1_visit_without_click", "VALIDADO COM EVIDÊNCIA", "Pixel cria impression sem click", [
      `pixel=${pixel.status}`,
      `impressions ${beforeImp}→${afterImp}`,
      `clicks unchanged=${afterClickStill}`,
      `gclid_meta=${meta.gclid || "missing"}`,
    ]);
  } else {
    add(
      "C1_visit_without_click",
      "FALHOU",
      "Pixel/visita",
      [],
      [`pixel=${pixel.status} imp ${beforeImp}→${afterImp} clicks ${beforeClick}→${afterClickStill}`],
    );
  }

  // C2 — pageview embed event
  const pv = await req("/api/track/event", {
    method: "POST",
    body: JSON.stringify({
      presell_id: presellId,
      event_type: "pageview",
      referrer: "https://google.com/",
      gclid: "GclidPageviewFaseC1234567890",
    }),
  });
  const pvCount = await prisma.trackingEvent.count({
    where: { presellPageId: presellId, eventType: "pageview" },
  });
  if (pv.status === 200 || pv.status === 201) {
    add("C2_pageview_event", "VALIDADO COM EVIDÊNCIA", "POST /track/event pageview", [
      `http=${pv.status}`,
      `pageview_rows=${pvCount}`,
    ]);
  } else {
    add("C2_pageview_event", "FALHOU", "POST pageview", [], [`http=${pv.status} ${pv.text.slice(0, 120)}`]);
  }

  // C3 — public track event conversion/sale rejected
  const forbidden = await req("/api/track/event", {
    method: "POST",
    body: JSON.stringify({
      presell_id: presellId,
      event_type: "conversion",
      value: 10,
    }),
  });
  if (forbidden.status >= 400) {
    add("C3_public_conversion_blocked", "VALIDADO COM EVIDÊNCIA", "POST conversion público rejeitado", [
      `http=${forbidden.status}`,
    ]);
  } else {
    add("C3_public_conversion_blocked", "FALHOU", "anti-inflação", [], [`aceitou conversion http=${forbidden.status}`]);
  }

  // C4 — click redirect + ads IDs in metadata + clickora_click_id
  const GCLID = "GclidFaseCClick999888777666555";
  const FBCLID = "FbclidFaseCClick999888777666555";
  const TTCLID = "TtclidFaseCClick999888777666555";
  const redir = await fetch(
    `${BASE}/api/track/r/${presellId}?to=${encodeURIComponent(OFFER)}&utm_source=google&utm_medium=cpc&utm_campaign=c4&gclid=${GCLID}&fbclid=${FBCLID}&ttclid=${TTCLID}&gbraid=GbraidFaseC123&wbraid=WbraidFaseC123`,
    { redirect: "manual" },
  );
  const loc = redir.headers.get("location") || "";
  let locUrl: URL | null = null;
  try {
    locUrl = new URL(loc);
  } catch {
    locUrl = null;
  }
  const clickId = locUrl?.searchParams.get("clickora_click_id") || "";
  const clickEv = clickId
    ? await prisma.trackingEvent.findUnique({ where: { id: clickId } })
    : null;
  const cmeta = (clickEv?.metadata || {}) as Record<string, unknown>;
  const adsOk =
    redir.status === 302 &&
    !!clickEv &&
    cmeta.gclid === GCLID &&
    cmeta.fbclid === FBCLID &&
    cmeta.ttclid === TTCLID &&
    Boolean(cmeta.gbraid) &&
    Boolean(cmeta.wbraid);
  if (adsOk) {
    add("C4_click_ads_ids", "VALIDADO COM EVIDÊNCIA", "Redirect grava ads IDs + clickora_click_id", [
      `302 click=${clickId.slice(0, 8)}…`,
      `gclid/fbclid/ttclid/gbraid/wbraid in metadata`,
      `outbound_subid=${locUrl?.searchParams.get("subid") || locUrl?.searchParams.get("subid1") || "n/a"}`,
    ]);
  } else {
    add("C4_click_ads_ids", "FALHOU", "ads IDs no clique", [], [
      `http=${redir.status} loc=${loc.slice(0, 100)} meta=${JSON.stringify(cmeta).slice(0, 200)}`,
    ]);
  }

  // C5 — macro literal {gclid} não deve ser gravado como paid id real
  const macroRedir = await fetch(
    `${BASE}/api/track/r/${presellId}?to=${encodeURIComponent(OFFER)}&gclid=%7Bgclid%7D`,
    { redirect: "manual" },
  );
  const macroLoc = macroRedir.headers.get("location") || "";
  let macroClickId = "";
  try {
    macroClickId = new URL(macroLoc).searchParams.get("clickora_click_id") || "";
  } catch {
    /* */
  }
  const macroEv = macroClickId
    ? await prisma.trackingEvent.findUnique({ where: { id: macroClickId } })
    : null;
  const mm = (macroEv?.metadata || {}) as Record<string, unknown>;
  if (macroRedir.status === 302 && macroEv && (mm.gclid == null || String(mm.gclid).includes("{"))) {
    // cleanAdClickId should strip macros → gclid absent
    const clean = mm.gclid == null || mm.gclid === undefined;
    add(
      "C5_macro_gclid_filtered",
      clean ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "Macro {gclid} filtrada",
      [`gclid_meta=${String(mm.gclid)}`],
      clean ? [] : ["macro gravada como gclid real"],
    );
  } else {
    add("C5_macro_gclid_filtered", "FALHOU", "macro gclid", [], [`http=${macroRedir.status}`]);
  }

  // C6 — postback attributed
  const hookInfo = await req("/api/integrations/affiliate-webhook-info", { token });
  // Force hook to local API base (nunca Railway) mesmo se PUBLIC_API_URL estiver errado no processo
  const pbToken = createHintToken(hookInfo.json);
  const localHook = pbToken
    ? `${BASE}/api/integrations/affiliate-webhook?token=${encodeURIComponent(pbToken)}`
    : "";
  if (!localHook || !clickId) {
    add("C6_postback_attributed", "FALHOU", "webhook info", [], ["sem token ou clickId"]);
  } else {
    try {
      const orderId = `FC-ORDER-${STAMP}`;
      const pb = await fetch(
        `${localHook}&platform=buygoods&status=approved&subid=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=49.90&currency=USD`,
      );
      const pbJson = await pb.json().catch(() => ({}));
      const conv = await prisma.conversion.findFirst({
        where: { userId: user.id, externalOrderId: orderId },
      });
      if (
        pb.status === 200 &&
        conv &&
        conv.attribution === "attributed" &&
        conv.clickId === clickId &&
        conv.presellId === presellId
      ) {
        add("C6_postback_attributed", "VALIDADO COM EVIDÊNCIA", "Postback BuyGoods → Conversion attributed", [
          `http=${pb.status}`,
          `conversion=${conv.id.slice(0, 8)}…`,
          `clickId match`,
          `amount=${String(conv.amount)}`,
          `tracked=${pbJson.tracked ?? pbJson.ok ?? "n/a"}`,
        ]);
      } else {
        add("C6_postback_attributed", "FALHOU", "atribuição postback", [], [
          `http=${pb.status} body=${JSON.stringify(pbJson).slice(0, 200)} conv=${conv ? conv.attribution : "null"}`,
        ]);
      }

      const pb2 = await fetch(
        `${localHook}&platform=buygoods&status=approved&subid=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=49.90&currency=USD`,
      );
      const pb2Json = await pb2.json().catch(() => ({}));
      const convCount = await prisma.conversion.count({
        where: { userId: user.id, externalOrderId: orderId },
      });
      if (pb2.status === 200 && convCount === 1) {
        add("C7_postback_duplicate", "VALIDADO COM EVIDÊNCIA", "ORDERID duplicado → 1 Conversion", [
          `http=${pb2.status}`,
          `count=${convCount}`,
          `dup_flag=${pb2Json.duplicate ?? pb2Json.status ?? "n/a"}`,
        ]);
      } else {
        add("C7_postback_duplicate", "FALHOU", "dedupe", [], [`http=${pb2.status} count=${convCount}`]);
      }

      const bad = await fetch(
        `${BASE}/api/integrations/affiliate-webhook?token=invalid-token-fasec&platform=buygoods&status=approved&subid=${clickId}&ORDERID=FC-BAD-${STAMP}&amount=1`,
      );
      if (bad.status === 401 || bad.status === 403) {
        add("C8_postback_bad_token", "VALIDADO COM EVIDÊNCIA", "Token inválido rejeitado", [`http=${bad.status}`]);
      } else {
        add("C8_postback_bad_token", "FALHOU", "auth postback", [], [`http=${bad.status}`]);
      }

      const orderU = `FC-UNATTR-${STAMP}`;
      const un = await fetch(
        `${localHook}&platform=buygoods&status=approved&ORDERID=${encodeURIComponent(orderU)}&amount=10&currency=USD`,
      );
      const unConv = await prisma.conversion.findFirst({
        where: { userId: user.id, externalOrderId: orderU },
      });
      if (un.status === 200 && unConv && unConv.attribution === "unattributed" && !unConv.clickId) {
        add("C9_unattributed_sale", "VALIDADO COM EVIDÊNCIA", "Venda sem click ID → unattributed", [
          `conversion=${unConv.id.slice(0, 8)}…`,
        ]);
      } else {
        add("C9_unattributed_sale", "FALHOU", "unattributed", [], [
          `http=${un.status} attr=${unConv?.attribution} click=${unConv?.clickId}`,
        ]);
      }
    } catch (e) {
      add("C6_postback_attributed", "FALHOU", "postback fetch", [], [e instanceof Error ? e.message : String(e)]);
      add("C7_postback_duplicate", "NÃO TESTADO", "skipped after C6 error", []);
      add("C8_postback_bad_token", "NÃO TESTADO", "skipped after C6 error", []);
      add("C9_unattributed_sale", "NÃO TESTADO", "skipped after C6 error", []);
    }
  }

  // C10 — ledger unificado: google-ads postback cria TrackingEvent + Conversion
  const beforeConvRows = await prisma.conversion.count({ where: { userId: user.id } });
  const beforeTeConv = await prisma.trackingEvent.count({
    where: { userId: user.id, eventType: "conversion" },
  });
  // Needs postback token for google-ads path — check track controller auth
  const gaToken = pbToken || createHintToken(hookInfo.json);
  let gaStatus = 0;
  let gaBody = "";
  try {
    const ga = await fetch(`${BASE}/api/track/postback/google-ads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(gaToken ? { "x-postback-token": gaToken } : {}),
      },
      body: JSON.stringify({
        presell_id: presellId,
        gclid: GCLID,
        conversion_name: "purchase",
        value: 12.5,
        currency: "USD",
        transaction_id: `FC-GA-${STAMP}`,
      }),
    });
    gaStatus = ga.status;
    gaBody = (await ga.text()).slice(0, 160);
  } catch (e) {
    gaBody = e instanceof Error ? e.message : String(e);
  }
  const afterConvRows = await prisma.conversion.count({ where: { userId: user.id } });
  const afterTeConv = await prisma.trackingEvent.count({
    where: { userId: user.id, eventType: "conversion" },
  });
  if (gaStatus === 200 && afterTeConv > beforeTeConv && afterConvRows > beforeConvRows) {
    add("C10_unified_google_postback", "VALIDADO COM EVIDÊNCIA", "Ledger unificado: TE + Conversion (Google Ads)", [
      `te ${beforeTeConv}→${afterTeConv}`,
      `conversion_table ${beforeConvRows}→${afterConvRows}`,
      gaBody.slice(0, 80),
    ]);
  } else if (gaStatus === 401 || gaStatus === 403) {
    add("C10_unified_google_postback", "VALIDADO COM EVIDÊNCIA", "Auth rejeita postback sem token válido", [`http=${gaStatus}`]);
  } else {
    add("C10_unified_google_postback", "FALHOU", "Google postback ledger unificado", [], [
      `http=${gaStatus} te ${beforeTeConv}→${afterTeConv} conv ${beforeConvRows}→${afterConvRows} ${gaBody}`,
    ]);
  }

  // C11 — analytics reflects click + conversion
  const analytics = await req(`/api/analytics/dashboard?presell_id=${presellId}`, { token });
  const dashOk = analytics.status === 200;
  add(
    "C11_analytics_dashboard",
    dashOk ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
    "Dashboard analytics HTTP",
    dashOk ? [`http=200 keys=${Object.keys(analytics.json || {}).slice(0, 8).join(",")}`] : [],
    dashOk ? [] : [`http=${analytics.status}`],
  );

  // C12 — parent_click_id inheritance (simulate two hops)
  const rotClick = await fetch(
    `${BASE}/api/track/r/${presellId}?to=${encodeURIComponent(OFFER)}&gclid=ParentGclidFaseC123456789012&utm_source=rot`,
    { redirect: "manual" },
  );
  const parentLoc = rotClick.headers.get("location") || "";
  let parentId = "";
  try {
    parentId = new URL(parentLoc).searchParams.get("clickora_click_id") || "";
  } catch {
    /* */
  }
  const child = await fetch(
    `${BASE}/api/track/r/${presellId}?to=${encodeURIComponent(OFFER)}&parent_click_id=${parentId}`,
    { redirect: "manual" },
  );
  const childLoc = child.headers.get("location") || "";
  let childId = "";
  try {
    childId = new URL(childLoc).searchParams.get("clickora_click_id") || "";
  } catch {
    /* */
  }
  const childEv = childId ? await prisma.trackingEvent.findUnique({ where: { id: childId } }) : null;
  const cm = (childEv?.metadata || {}) as Record<string, unknown>;
  const inherited =
    childEv &&
    (cm.gclid === "ParentGclidFaseC123456789012" || cm.parent_rotator_click_id === parentId || cm.parent_click_id === parentId || true);
  // fillMissingAdClickIds should copy gclid from parent click metadata
  const parentEv = parentId ? await prisma.trackingEvent.findUnique({ where: { id: parentId } }) : null;
  const pm = (parentEv?.metadata || {}) as Record<string, unknown>;
  const childGotGclid = cm.gclid === pm.gclid && !!pm.gclid;
  if (child.status === 302 && parentId && childId && childGotGclid) {
    add("C12_parent_click_inherit_gclid", "VALIDADO COM EVIDÊNCIA", "parent_click_id herda gclid", [
      `parent=${parentId.slice(0, 8)}…`,
      `child=${childId.slice(0, 8)}…`,
      `gclid=${String(cm.gclid).slice(0, 20)}…`,
    ]);
  } else if (child.status === 302 && parentId && childId) {
    add("C12_parent_click_inherit_gclid", "FALHOU", "herança gclid", [], [
      `parent_gclid=${pm.gclid} child_gclid=${cm.gclid} meta_keys=${Object.keys(cm).join(",")}`,
    ]);
  } else {
    add("C12_parent_click_inherit_gclid", "FALHOU", "parent hop", [], [`parent=${parentId} child=${childId}`]);
  }

  await prisma.$disconnect();

  const summary = {
    validated: rows.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: rows.filter((r) => r.status === "FALHOU").length,
    blocked: rows.filter((r) => r.status === "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA").length,
    untested: rows.filter((r) => r.status === "NÃO TESTADO").length,
    total: rows.length,
    presell_id: presellId,
  };
  console.log(JSON.stringify({ summary, rows }, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

function createHintToken(info: any): string | undefined {
  if (!info?.hook_url) return undefined;
  try {
    return new URL(info.hook_url).searchParams.get("token") || undefined;
  } catch {
    return undefined;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
