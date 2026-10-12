/**
 * Auditoria E2E do país do visitante, do checkout e da oferta.
 * Só corre contra a base local passada em DATABASE_URL (nunca a de produção).
 *
 *   E2E_BASE=http://127.0.0.1:39991 node --import tsx scripts/e2e-visitor-country-audit.ts
 */
import assert from "node:assert/strict";
import geoip from "geoip-lite";
import { systemPrisma } from "../src/lib/prisma";

const BASE = (process.env.E2E_BASE || "http://127.0.0.1:39991").replace(/\/+$/, "");
const db = process.env.DATABASE_URL || "";
if (!/127\.0\.0\.1|localhost/.test(db)) {
  console.error("Recusado: DATABASE_URL não é local.");
  process.exit(1);
}

const OFFER = "https://offer.example/go";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PARIS = "79.127.178.81";
const LONDON = "152.233.29.1";
const HOME = "8.8.8.8";
const HOME_COUNTRY = geoip.lookup(HOME)?.country?.toUpperCase() ?? null;

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function json(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, redirect: "manual" });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

type ClickRow = {
  id: string;
  country: string | null;
  region: string | null;
  city: string | null;
  ip_address: string | null;
  unqualified?: boolean;
  checkout_page?: string | null;
  checkout_host?: string | null;
  utm_term?: string | null;
  metadata?: { country_source?: string; utm_term?: string };
};

type Dash = {
  total_clicks: number;
  total_conversions: number;
  revenue: number;
  checkout_visitors?: number;
  chart_data: { date: string; clicks: number; impressions: number; checkouts?: number }[];
  country_performance: { country: string; clicks: number; checkouts?: number; sales: number; revenue: number }[];
  offer_performance?: {
    offer: string;
    clicks: number;
    checkouts: number;
    sales: number;
    revenue: number;
  }[];
};

async function main() {
  assert.ok(HOME_COUNTRY && HOME_COUNTRY !== "AO", "o IP residencial de teste não pode ser Angola");

  const stamp = Date.now().toString(36);
  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `e2e-geo-${stamp}@clickora.test`,
      password: "e2e-geo-pass",
      full_name: "E2E Geo",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  if (!token || reg.res.status !== 201) throw new Error("registo " + reg.res.status + " " + JSON.stringify(reg.body));
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const user = await systemPrisma.user.findUnique({
    where: { email: `e2e-geo-${stamp}@clickora.test` },
    include: { subscription: true },
  });
  if (!user?.subscription) throw new Error("sem subscrição");
  await systemPrisma.plan.update({
    where: { id: user.subscription.planId },
    data: { affiliateWebhookEnabled: true },
  });

  const title = `Oferta E2E ${stamp}`;
  const created = await json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title,
      slug: `e2e-geo-${stamp}`,
      type: "tsl",
      status: "published",
      content: { title, affiliateLink: OFFER, salesText: "Oferta" },
    }),
  });
  const pageId = (created.body as { id?: string })?.id;
  if (!pageId) throw new Error("presell " + JSON.stringify(created.body));

  async function click(opts: { xff: string; country?: string; term?: string }) {
    const q = new URLSearchParams({ to: OFFER });
    if (opts.term) q.set("utm_term", opts.term);
    const headers: Record<string, string> = {
      "user-agent": CHROME,
      "x-forwarded-for": opts.xff,
      accept: "application/json",
    };
    if (opts.country) headers["x-client-geo-country"] = opts.country;
    const res = await fetch(`${BASE}/api/track/r/${pageId}?${q}`, { headers, redirect: "manual" });
    return { status: res.status, location: res.headers.get("location") || "" };
  }

  const angola = await click({ xff: PARIS, country: "AO", term: "lungora2" });
  record(
    "visita Angola pela CDN77 abre o hoplink",
    angola.status === 302 && angola.location.includes("offer.example") && angola.location.includes("clickora_click_id="),
    `status=${angola.status}`,
  );

  const bare = await click({ xff: PARIS });
  record(
    "nó CDN77 sem país do visitante ainda abre o hoplink",
    bare.status === 302 && bare.location.includes("offer.example"),
    `status=${bare.status}`,
  );

  const spoof = await click({ xff: HOME, country: "AO" });
  record("IP residencial com país forjado segue para a oferta", spoof.status === 302, `status=${spoof.status}`);

  const london = await click({ xff: LONDON });
  record(
    "nó de Londres sem visitante não abre o hoplink",
    london.status === 403 && !london.location,
    `status=${london.status}`,
  );

  const eventsRes = await json("/api/analytics/events?event_type=click&limit=20", { headers: auth });
  const list = (Array.isArray(eventsRes.body) ? eventsRes.body : []) as ClickRow[];
  const byIpAnd = (ip: string, pred: (row: ClickRow) => boolean) => list.find((row) => row.ip_address === ip && pred(row));

  const aoRow = list.find((row) => row.country === "AO");
  const bareRow = list.find((row) => row.ip_address === PARIS && row.country == null);
  const homeRow = byIpAnd(HOME, () => true);
  const lonRow = byIpAnd(LONDON, () => true);

  record(
    "país Angola vem da CDN, sem cidade inventada",
    !!aoRow &&
      aoRow.country === "AO" &&
      !aoRow.region &&
      !aoRow.city &&
      aoRow.unqualified !== true &&
      aoRow.metadata?.country_source === "cdn77" &&
      aoRow.utm_term === "lungora2" &&
      (aoRow.checkout_host || "").includes("offer.example"),
    aoRow
      ? `${aoRow.country} term=${aoRow.utm_term} host=${aoRow.checkout_host} region=${aoRow.region || "—"}`
      : list.map((r) => `${r.ip_address}=${r.country || "sem"}`).join(" | ") || "sem eventos",
  );
  record(
    "nó sem país não vira CZ nem ganha cidade",
    !!bareRow && bareRow.country == null && !bareRow.region && !bareRow.city && bareRow.utm_term == null,
    bareRow ? `country=${bareRow.country || "vazio"} term=${bareRow.utm_term || "vazio"}` : "clique em falta",
  );
  record(
    "cabeçalho de país num IP de casa é ignorado",
    !!homeRow && homeRow.country === HOME_COUNTRY && homeRow.country !== "AO",
    homeRow ? `${homeRow.ip_address}=${homeRow.country}` : "clique em falta",
  );
  record(
    "Londres fica não qualificado e sem checkout",
    !!lonRow && lonRow.country === "GB" && lonRow.unqualified === true && !lonRow.checkout_page,
    lonRow ? `country=${lonRow.country} unqualified=${lonRow.unqualified} to=${lonRow.checkout_page || "vazio"}` : "clique em falta",
  );

  const clickId = angola.location.match(/clickora_click_id=([^&]+)/)?.[1];
  const hook = await json("/api/integrations/affiliate-webhook-info", { headers: auth });
  const pixel = (hook.body as { funnel?: { checkout_pixel_url?: string } })?.funnel?.checkout_pixel_url;
  record("pixel de checkout disponível", hook.res.ok && !!pixel && !!clickId, `status=${hook.res.status}`);
  if (!pixel || !clickId) throw new Error("sem pixel ou click id");

  const pixelUrl = new URL(pixel);
  const checkoutHit = await fetch(`${BASE}${pixelUrl.pathname}${pixelUrl.search}&subid=${encodeURIComponent(clickId)}`);
  record("evento de checkout da rede foi aceite", checkoutHit.ok, `status=${checkoutHit.status}`);

  const dash1 = (await json("/api/analytics/dashboard", { headers: auth })).body as Dash;
  const aoPerf = dash1.country_performance.find((r) => r.country === "AO");
  const nonePerf = dash1.country_performance.find((r) => r.country === "(sem país)");
  const invented = dash1.country_performance.filter((r) => r.country === "CZ" || r.country === "UA");
  const offer = dash1.offer_performance?.find((r) => r.offer === title);
  const chartCheckouts = dash1.chart_data.reduce((n, d) => n + (d.checkouts ?? 0), 0);
  record(
    "painel: 3 visitantes, 1 checkout, 0 vendas, sem CZ/UA",
    dash1.total_clicks === 3 &&
      dash1.checkout_visitors === 1 &&
      dash1.total_conversions === 0 &&
      dash1.revenue === 0 &&
      aoPerf?.clicks === 1 &&
      aoPerf.checkouts === 1 &&
      aoPerf.sales === 0 &&
      nonePerf?.clicks === 1 &&
      nonePerf.checkouts === 0 &&
      invented.length === 0 &&
      offer?.clicks === 3 &&
      offer.checkouts === 1 &&
      offer.sales === 0 &&
      chartCheckouts === 1,
    `clicks=${dash1.total_clicks} checkouts=${dash1.checkout_visitors} AO=${aoPerf?.clicks}/${aoPerf?.checkouts} offer=${offer?.clicks}/${offer?.checkouts} chart=${chartCheckouts}`,
  );

  const hookUrl = (hook.body as { hook_url?: string }).hook_url;
  if (!hookUrl) throw new Error("sem hook");
  const sale = new URL(hookUrl);
  sale.searchParams.set("clickora_click_id", clickId);
  sale.searchParams.set("amount", "9.25");
  sale.searchParams.set("currency", "USD");
  sale.searchParams.set("status", "approved");
  sale.searchParams.set("order_id", `e2e-geo-${stamp}`);
  const posted = await json(sale.pathname + sale.search);
  const postedBody = posted.body as { conversion?: string };
  record(
    "uma venda aprovada no clique de Angola",
    posted.res.ok && postedBody.conversion === "created",
    `status=${posted.res.status} ${JSON.stringify(postedBody).slice(0, 180)}`,
  );

  const dash2 = (await json("/api/analytics/dashboard", { headers: auth })).body as Dash;
  const aoAfter = dash2.country_performance.find((r) => r.country === "AO");
  const offerAfter = dash2.offer_performance?.find((r) => r.offer === title);
  record(
    "a venda fica em Angola e na oferta, o resto a zero",
    dash2.total_conversions === 1 &&
      dash2.revenue === 9.25 &&
      dash2.checkout_visitors === 1 &&
      aoAfter?.sales === 1 &&
      aoAfter.revenue === 9.25 &&
      offerAfter?.sales === 1 &&
      offerAfter.revenue === 9.25 &&
      dash2.country_performance.filter((r) => r.country !== "AO").every((r) => r.sales === 0 && r.revenue === 0),
    `conv=${dash2.total_conversions} rev=${dash2.revenue} AO=${aoAfter?.sales}/${aoAfter?.revenue}`,
  );

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
    await systemPrisma.$disconnect();
  });
