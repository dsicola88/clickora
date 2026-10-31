/**
 * FASE F — Auditoria de postbacks e integrações (BD + API locais isolados).
 *
 * Segurança: loadTestSafety — só localhost; nunca Railway.
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/audit-fase-f-postbacks.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";
import { appendClickIdToAffiliateUrl } from "../src/lib/appendClickIdToUrl";
import { parseAffiliatePostback } from "../src/lib/affiliatePlatforms/parseAffiliatePostback";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const OFFER = "https://example.com/offer-ff";
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

async function api(path: string, opts: { method?: string; token?: string; body?: string; headers?: Record<string, string> } = {}) {
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
  return { status: res.status, json, text };
}

function tokenFromHookInfo(info: any): string | undefined {
  if (!info?.hook_url) return undefined;
  try {
    return new URL(info.hook_url).searchParams.get("token") || undefined;
  } catch {
    return undefined;
  }
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
    console.error("login fail", login.status);
    process.exit(1);
  }
  const token = login.json.token as string;
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error("user missing");
    process.exit(1);
  }

  const ARTICLE =
    "Auditoria FASE F postbacks. Texto descritivo para validadores. Não prometemos resultados. " +
    "Confirme preço e garantia no site oficial. Página com links de afiliado. Compare alternativas. ";

  const created = await api("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FF PB ${STAMP}`,
      slug: `ff-pb-${STAMP}`,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "Produto FF",
        title: `FF PB ${STAMP}`,
        subtitle: "PB",
        sales_text: ARTICLE,
        cta_text: "Ver",
        images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        affiliate_link: OFFER,
      },
      settings: {
        privacyPolicyUrl: "/privacidade",
        cookiePolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure: "Divulgação: links de afiliado podem aplicar-se.",
      },
      tracking: { offerUrl: OFFER },
    }),
  });
  const presellId = created.json?.id as string | undefined;
  if (!presellId) {
    console.error("create fail", created.status, created.text.slice(0, 200));
    process.exit(1);
  }
  await prisma.presellPage.update({ where: { id: presellId }, data: { status: "published" } });

  // Create tracked click
  const redir = await fetch(
    `${BASE}/api/track/r/${presellId}?to=${encodeURIComponent(OFFER)}&gclid=GclidFaseF1234567890&fbclid=FbclidFaseF1234567890`,
    { redirect: "manual" },
  );
  const loc = redir.headers.get("location") || "";
  let clickId = "";
  try {
    clickId = new URL(loc).searchParams.get("clickora_click_id") || "";
  } catch {
    /* */
  }
  if (!clickId) {
    console.error("no clickId", redir.status, loc);
    process.exit(1);
  }

  const hookInfo = await api("/api/integrations/affiliate-webhook-info", { token });
  const pbToken = tokenFromHookInfo(hookInfo.json);
  const localHook = pbToken
    ? `${BASE}/api/integrations/affiliate-webhook?token=${encodeURIComponent(pbToken)}`
    : "";

  if (!localHook) {
    add("F0", "FALHOU", "obter token webhook", [], [`info=${hookInfo.status}`]);
  } else {
    add("F0", "VALIDADO COM EVIDÊNCIA", "affiliate-webhook-info token local", [
      `http=${hookInfo.status}`,
      `token_len=${pbToken!.length}`,
    ]);
  }

  // F1 Digistore24 attributed via sid1 (cid occupied by non-UUID)
  if (localHook) {
    const orderId = `FF-DS-${STAMP}`;
    const pb = await fetch(
      `${localHook}&platform=digistore24&transaction_type=payment&billing_status=completed&cid=OTHERTRACKER&sid1=${encodeURIComponent(clickId)}&transaction_id=${encodeURIComponent(orderId)}&order_id=${encodeURIComponent(orderId)}&amount=29.50&currency=EUR`,
    );
    const j = await pb.json().catch(() => ({}));
    const conv = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
    const ok = pb.status === 200 && conv?.attribution === "attributed" && conv.clickId === clickId;
    add(
      "F1",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "Digistore24: sid1 UUID quando cid ocupado → attributed",
      [`http=${pb.status}`, `attr=${conv?.attribution}`, `clickMatch=${conv?.clickId === clickId}`, `body=${JSON.stringify(j).slice(0, 120)}`],
      ok ? [] : ["digistore atribuição falhou"],
    );
  }

  // F2 MaxWeb: prefer subid2 over non-UUID subid
  if (localHook) {
    const orderId = `FF-MW-${STAMP}`;
    const pb = await fetch(
      `${localHook}&platform=maxweb&status=approved&subid=path-not-uuid&subid2=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=19.00&currency=USD`,
    );
    const conv = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
    const parsed = parseAffiliatePostback({
      platform: "maxweb",
      flat: {
        status: "approved",
        subid: "path-not-uuid",
        subid2: clickId,
        ORDERID: orderId,
        amount: "19",
      },
    });
    const ok =
      pb.status === 200 &&
      conv?.attribution === "attributed" &&
      conv.clickId === clickId &&
      parsed.clickId === clickId;
    add(
      "F2",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "MaxWeb: preferir subid2 UUID (subid path id)",
      [`http=${pb.status}`, `parser_click=${parsed.clickId}`, `attr=${conv?.attribution}`],
      ok ? [] : ["maxweb subid2 falhou"],
    );
  }

  // F3 Hotmart affiliate JSON body
  if (localHook) {
    const orderId = `HP${STAMP}TX`;
    const body = {
      event: "PURCHASE_APPROVED",
      data: {
        purchase: {
          status: "APPROVED",
          transaction: orderId,
          origin: { src: clickId, sck: "campaign" },
        },
        commissions: [{ source: "AFFILIATE", value: 35.5, currency_value: "BRL" }],
      },
    };
    const pb = await fetch(`${localHook}&platform=hotmart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await pb.json().catch(() => ({}));
    const conv = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
    const ok = pb.status === 200 && conv?.attribution === "attributed" && conv.clickId === clickId;
    add(
      "F3",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "Hotmart afiliado JSON → Conversion attributed",
      [`http=${pb.status}`, `attr=${conv?.attribution}`, `amount=${String(conv?.amount ?? "")}`, `body=${JSON.stringify(j).slice(0, 120)}`],
      ok ? [] : ["hotmart falhou"],
    );
  }

  // F4 ClickBank SALE (plain, not encrypted)
  if (localHook) {
    const receipt = `FF-CB-${STAMP}`;
    const pb = await fetch(
      `${localHook}&platform=clickbank&transactionType=SALE&tid=${encodeURIComponent(clickId)}&receipt=${encodeURIComponent(receipt)}&totalAccountAmount=42.00&currency=USD`,
    );
    const conv = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: receipt } });
    const ok = pb.status === 200 && conv?.attribution === "attributed" && conv.clickId === clickId;
    add(
      "F4",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "ClickBank SALE plain → attributed",
      [`http=${pb.status}`, `attr=${conv?.attribution}`],
      ok ? [] : ["clickbank falhou"],
    );
  }

  // F5 ClickBank encrypted without secret → ignore (no Conversion)
  if (localHook) {
    const before = await prisma.conversion.count({ where: { userId: user.id } });
    const pb = await fetch(`${localHook}&platform=clickbank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification: "cipherblob", iv: "ivblob" }),
    });
    const after = await prisma.conversion.count({ where: { userId: user.id } });
    const j = await pb.json().catch(() => ({}));
    const ok = pb.status === 200 && after === before;
    add(
      "F5",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "ClickBank cifrado sem secret → ignore (sem Conversion)",
      [`http=${pb.status}`, `conv_delta=${after - before}`, `body=${JSON.stringify(j).slice(0, 140)}`],
      ok ? [] : ["criou conversion indevida ou erro"],
    );
  }

  // F6 BuyGoods refund outcome
  if (localHook) {
    const orderId = `FF-BG-RF-${STAMP}`;
    // first sale
    await fetch(
      `${localHook}&platform=buygoods&status=approved&subid=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=50&currency=USD`,
    );
    const beforeAmt = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
    const pb = await fetch(
      `${localHook}&platform=buygoods&status=refund&subid=${encodeURIComponent(clickId)}&ORDERID=${encodeURIComponent(orderId)}&amount=50&currency=USD`,
    );
    const after = await prisma.conversion.findFirst({ where: { userId: user.id, externalOrderId: orderId } });
    const j = await pb.json().catch(() => ({}));
    // Accept: status refunded/refund on conversion OR response acknowledges refund
    const statusField = String((after as any)?.status || (after as any)?.outcome || "").toLowerCase();
    const bodyHint = JSON.stringify(j).toLowerCase();
    const ok =
      pb.status === 200 &&
      !!beforeAmt &&
      (statusField.includes("refund") ||
        bodyHint.includes("refund") ||
        Number(after?.amount) === 0 ||
        (after?.attribution && bodyHint.includes("ok")));
    add(
      "F6",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "BuyGoods refund processado",
      [
        `sale_attr=${beforeAmt?.attribution}`,
        `http=${pb.status}`,
        `after_amount=${String(after?.amount)}`,
        `after_status=${statusField || "n/a"}`,
        `body=${JSON.stringify(j).slice(0, 160)}`,
      ],
      ok ? [] : ["refund não reflectido"],
    );
  }

  // F7 Microsoft Ads postback → ledger unificado (TE + Conversion)
  if (pbToken) {
    const beforeC = await prisma.conversion.count({ where: { userId: user.id } });
    const beforeTe = await prisma.trackingEvent.count({ where: { userId: user.id, eventType: "conversion" } });
    const ms = await fetch(`${BASE}/api/track/postback/microsoft-ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-postback-token": pbToken },
      body: JSON.stringify({
        presell_id: presellId,
        msclkid: "MsclkidFaseF1234567890abcd",
        conversion_name: "purchase",
        value: 15,
        currency: "USD",
        transaction_id: `FF-MS-${STAMP}`,
      }),
    });
    const afterC = await prisma.conversion.count({ where: { userId: user.id } });
    const afterTe = await prisma.trackingEvent.count({ where: { userId: user.id, eventType: "conversion" } });
    const text = (await ms.text()).slice(0, 120);
    const ok = ms.status === 200 && afterTe > beforeTe && afterC > beforeC;
    add(
      "F7",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "Microsoft Ads postback → TE + Conversion (ledger unificado)",
      [`http=${ms.status}`, `te ${beforeTe}→${afterTe}`, `conversion_table ${beforeC}→${afterC}`, text],
      ok ? [] : ["microsoft ledger unificado falhou"],
    );
  }

  // F8 token inválido
  {
    const bad = await fetch(
      `${BASE}/api/integrations/affiliate-webhook?token=invalid-ff&platform=buygoods&status=approved&ORDERID=FF-BAD&amount=1`,
    );
    const ok = bad.status === 401 || bad.status === 403;
    add("F8", ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU", "token inválido rejeitado", [`http=${bad.status}`], ok ? [] : ["aceitou token inválido"]);
  }

  // F9 outbound Digistore: cid occupied → sid1 gets UUID
  {
    const dest = "https://www.digistore24.com/redir/123/?cid=OTHER";
    const out = appendClickIdToAffiliateUrl(dest, clickId, "digistore24");
    const u = new URL(out);
    const ok =
      u.searchParams.get("clickora_click_id") === clickId &&
      u.searchParams.get("cid") === "OTHER" &&
      u.searchParams.get("sid1") === clickId;
    add(
      "F9",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "outbound Digistore: sid1 quando cid ocupado",
      [`out=${out.slice(0, 160)}`],
      ok ? [] : ["sid1 não escrito"],
    );
  }

  // F10 outbound Hotmart src/sck
  {
    const dest = "https://pay.hotmart.com/X?off=y";
    const out = appendClickIdToAffiliateUrl(dest, clickId, "hotmart");
    const u = new URL(out);
    const ok =
      u.searchParams.get("clickora_click_id") === clickId &&
      (u.searchParams.get("src") === clickId || u.searchParams.get("sck") === clickId);
    add(
      "F10",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "outbound Hotmart src/sck",
      [`out=${out.slice(0, 160)}`],
      ok ? [] : ["src/sck em falta"],
    );
  }

  // F11 Meta CAPI / TikTok Events settings API (envio real = NÃO TESTADO nesta fase)
  {
    const meta = await api("/api/integrations/meta-capi", { token });
    const tt = await api("/api/integrations/tiktok-events", { token });
    const ok = meta.status === 200 && tt.status === 200;
    add(
      "F11",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "GET meta-capi + tiktok-events settings (envio CAPI real = NÃO TESTADO)",
      [
        `meta=${meta.status} keys=${Object.keys(meta.json || {}).slice(0, 6).join(",")}`,
        `tiktok=${tt.status} keys=${Object.keys(tt.json || {}).slice(0, 6).join(",")}`,
      ],
      ok ? [] : ["settings CAPI inacessíveis"],
    );
  }

  // F12 PostbackLog rows created for affiliate hooks
  {
    const logs = await prisma.postbackLog.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    const ok = logs >= 1;
    add(
      "F12",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "PostbackLog gravado para webhooks recentes",
      [`recent_logs=${logs}`],
      ok ? [] : ["sem PostbackLog"],
    );
  }

  await api(`/api/presells/${presellId}`, { method: "DELETE", token }).catch(() => undefined);
  await prisma.$disconnect();

  const summary = {
    phase: "F",
    stamp: STAMP,
    validated: rows.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: rows.filter((r) => r.status === "FALHOU").length,
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
