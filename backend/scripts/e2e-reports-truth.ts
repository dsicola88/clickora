/**
 * O relatório tem de bater certo com os pedidos feitos.
 * Não há números de amostra: zero antes do tráfego, e só conta o que a API gravou.
 *
 *   E2E_BASE=http://127.0.0.1:39991 node --import tsx scripts/e2e-reports-truth.ts
 */
import assert from "node:assert/strict";
import geoip from "geoip-lite";
import { systemPrisma } from "../src/lib/prisma";

const BASE = (process.env.E2E_BASE || "http://127.0.0.1:39991").replace(/\/+$/, "");
const OFFER = "https://offer.example/go";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const US_IP = "8.8.8.8";
const CN_IP = "114.114.114.114";
const UNKNOWN_IP = "203.0.113.50";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function geoOf(ip: string) {
  const g = geoip.lookup(ip);
  return {
    country: g?.country?.toUpperCase() ?? null,
    region: g?.region?.trim() || null,
    city: g?.city?.trim() || null,
  };
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
  return { res, body };
}

function visitor(ip: string, ua = CHROME): HeadersInit {
  return { "user-agent": ua, "x-forwarded-for": ip, accept: "application/json" };
}

type Dash = {
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  revenue: number;
  google_ads_metrics: unknown;
  chart_data: { date: string; clicks: number; impressions: number }[];
  clicks_by_country: { country_code: string | null; clicks: number }[];
  country_performance: { country: string; clicks: number; sales: number; revenue: number }[];
  media_buyer: { roas: number | null; spend: number | null };
};

type EventRow = {
  event_type: string;
  country: string | null;
  region: string | null;
  city: string | null;
  ip_address: string | null;
};

async function main() {
  const us = geoOf(US_IP);
  const cn = geoOf(CN_IP);
  const unknown = geoOf(UNKNOWN_IP);
  assert.ok(us.country && cn.country && us.country !== cn.country, "geoip sem dois países distintos");
  assert.equal(unknown.country, null, "o IP de teste devia ser desconhecido para o geoip");

  const stamp = Date.now().toString(36);
  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `e2e-report-${stamp}@clickora.test`,
      password: "e2e-report-pass",
      full_name: "E2E Report",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  if (!token || reg.res.status !== 201) throw new Error("registo falhou " + reg.res.status);
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const created = await json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "Relatorio E2E",
      slug: `e2e-report-${stamp}`,
      type: "tsl",
      status: "published",
      content: { title: "Relatorio E2E", affiliateLink: OFFER, salesText: "Oferta" },
    }),
  });
  const pageId = (created.body as { id?: string })?.id;
  if (!pageId) throw new Error("presell " + JSON.stringify(created.body));

  const empty = await json("/api/analytics/dashboard", { headers: auth });
  const emptyDash = empty.body as Dash;
  record(
    "sem tráfego o painel está a zero",
    empty.res.ok &&
      emptyDash.total_clicks === 0 &&
      emptyDash.total_impressions === 0 &&
      emptyDash.total_conversions === 0 &&
      emptyDash.revenue === 0 &&
      emptyDash.google_ads_metrics == null &&
      (emptyDash.clicks_by_country?.length ?? 0) === 0 &&
      emptyDash.chart_data.every((d) => d.clicks === 0 && d.impressions === 0) &&
      emptyDash.media_buyer.roas == null,
    `clicks=${emptyDash.total_clicks} imp=${emptyDash.total_impressions} conv=${emptyDash.total_conversions} roas=${emptyDash.media_buyer?.roas}`,
  );

  const pixel = await fetch(`${BASE}/api/track/pixel/${pageId}.gif`, { headers: visitor(US_IP) });
  record("impressão gravada pelo pixel", pixel.ok, `status=${pixel.status}`);

  async function click(ip: string, ua = CHROME) {
    const res = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
      headers: visitor(ip, ua),
      redirect: "manual",
    });
    return { status: res.status, location: res.headers.get("location") || "" };
  }

  const cUs = await click(US_IP);
  const cCn = await click(CN_IP);
  const cUnknown = await click(UNKNOWN_IP);
  record(
    "três cliques reais seguiram para a oferta",
    cUs.status === 302 && cCn.status === 302 && cUnknown.status === 302,
    `${cUs.status}/${cCn.status}/${cUnknown.status}`,
  );

  await json("/api/integrations/tracking-guards", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ block_bot_clicks: true }),
  });
  const bot = await click(US_IP, BOT);
  record("bot bloqueado não entra no funil", bot.status === 403, `status=${bot.status}`);

  const dashRes = await json("/api/analytics/dashboard", { headers: auth });
  const dash = dashRes.body as Dash;
  const chartClicks = dash.chart_data.reduce((n, d) => n + d.clicks, 0);
  const chartImps = dash.chart_data.reduce((n, d) => n + d.impressions, 0);
  record(
    "painel = 1 impressão, 3 cliques, 0 vendas",
    dash.total_impressions === 1 &&
      dash.total_clicks === 3 &&
      dash.total_conversions === 0 &&
      dash.revenue === 0 &&
      chartClicks === 3 &&
      chartImps === 1 &&
      dash.google_ads_metrics == null,
    `imp=${dash.total_impressions} clicks=${dash.total_clicks} conv=${dash.total_conversions} chart=${chartImps}/${chartClicks}`,
  );

  const eventsRes = await json("/api/analytics/events?event_type=click&limit=20", { headers: auth });
  const events = (eventsRes.body as { events?: EventRow[] })?.events || (eventsRes.body as EventRow[]);
  const list = Array.isArray(events) ? events : [];
  const byIp = new Map(list.map((e) => [e.ip_address, e]));

  function placeOk(ip: string, expectedCountry: string | null) {
    const row = byIp.get(ip);
    if (!row) return false;
    const country = row.country ? row.country.toUpperCase() : null;
    return country === expectedCountry && !row.city && !row.region;
  }

  record(
    "país do clique é o do IP de quem entrou, sem cidade",
    list.length === 3 && placeOk(US_IP, us.country) && placeOk(CN_IP, cn.country) && placeOk(UNKNOWN_IP, null),
    list
      .map((e) => `${e.ip_address}=${e.country || "sem país"}/${e.city || "sem cidade"}`)
      .join(" | ") || "sem eventos",
  );

  const countries = new Map(dash.clicks_by_country.map((r) => [r.country_code, r.clicks]));
  record(
    "painel e lista contam os mesmos países",
    countries.get(us.country) === 1 &&
      countries.get(cn.country) === 1 &&
      countries.get(null) === 1 &&
      dash.clicks_by_country.reduce((n, r) => n + r.clicks, 0) === 3,
    dash.clicks_by_country.map((r) => `${r.country_code || "sem país"}:${r.clicks}`).join(", "),
  );

  const clickId = cUs.location.match(/clickora_click_id=([^&]+)/)?.[1];
  const hook = await json("/api/integrations/affiliate-webhook-info", { headers: auth });
  const hookUrl = (hook.body as { hook_url?: string })?.hook_url;
  record("url de postback", hook.res.ok && !!hookUrl && !!clickId, `status=${hook.res.status}`);
  if (!hookUrl || !clickId) throw new Error("sem postback ou click id");

  const sale = new URL(hookUrl);
  sale.searchParams.set("clickora_click_id", clickId);
  sale.searchParams.set("amount", "12.50");
  sale.searchParams.set("currency", "USD");
  sale.searchParams.set("status", "approved");
  sale.searchParams.set("order_id", `e2e-${stamp}`);
  const posted = await json(sale.pathname + sale.search);
  const postedBody = posted.body as { conversion?: string; attribution?: string };
  record(
    "postback cria uma venda atribuída",
    posted.res.ok && postedBody.conversion === "created" && postedBody.attribution === "attributed",
    `status=${posted.res.status} ${JSON.stringify(postedBody).slice(0, 220)}`,
  );

  const after = (await json("/api/analytics/dashboard", { headers: auth })).body as Dash;
  const usRow = after.country_performance.find((r) => r.country === us.country);
  const cnRow = after.country_performance.find((r) => r.country === cn.country);
  const noneRow = after.country_performance.find((r) => r.country === "(sem país)");
  record(
    "a venda de 12.50 fica no país de quem clicou",
    after.total_clicks === 3 &&
      after.total_impressions === 1 &&
      after.total_conversions === 1 &&
      after.revenue === 12.5 &&
      usRow?.sales === 1 &&
      usRow.revenue === 12.5 &&
      cnRow?.sales === 0 &&
      (noneRow == null || noneRow.sales === 0),
    `conv=${after.total_conversions} rev=${after.revenue} US=${usRow?.sales}/${usRow?.revenue} CN=${cnRow?.sales}`,
  );

  const summary = await json(`/api/analytics?presell_id=${pageId}&detail=1`, { headers: auth });
  const byPresell = (summary.body as { by_presell?: { clicks: number; impressions: number; conversions: number; revenue: number }[] })
    .by_presell;
  const row = byPresell?.find((s) => (s as { presell_id?: string }).presell_id === pageId) || byPresell?.[0];
  record(
    "resumo da presell igual ao painel",
    !!row && row.clicks === 3 && row.impressions === 1 && row.conversions === 1 && row.revenue === 12.5,
    row ? `c=${row.clicks} i=${row.impressions} v=${row.conversions} r=${row.revenue}` : "sem linha",
  );

  const pages = await json("/api/presells", { headers: auth });
  const page = ((pages.body as { id: string; clicks: number; impressions: number; conversions: number }[]) || []).find(
    (p) => p.id === pageId,
  );
  record(
    "contadores da presell iguais aos eventos",
    !!page && page.clicks === 3 && page.impressions === 1 && page.conversions === 1,
    page ? `c=${page.clicks} i=${page.impressions} v=${page.conversions}` : "página em falta",
  );

  const dbClicks = await systemPrisma.trackingEvent.count({
    where: { presellPageId: pageId, eventType: "click" },
  });
  const dbImps = await systemPrisma.trackingEvent.count({
    where: { presellPageId: pageId, eventType: "impression" },
  });
  const dbSales = await systemPrisma.conversion.count({
    where: { presellId: pageId, status: "approved" },
  });
  record(
    "a base tem os mesmos totais",
    dbClicks === 3 && dbImps === 1 && dbSales === 1,
    `db clicks=${dbClicks} imp=${dbImps} sales=${dbSales}`,
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
