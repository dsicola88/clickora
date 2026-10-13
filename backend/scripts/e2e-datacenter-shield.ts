/**
 * E2E: IP residencial vai à oferta; CDN77 (152.233.29.1) não.
 * O relatório corrige o país para GB e marca o clique como não qualificado.
 *
 *   E2E_BASE=http://127.0.0.1:39991 node --import tsx scripts/e2e-datacenter-shield.ts
 */
import geoip from "geoip-lite";
import { systemPrisma } from "../src/lib/prisma";

const BASE = (process.env.E2E_BASE || "http://127.0.0.1:39991").replace(/\/+$/, "");
const OFFER = "https://offer.example/go";
const CDN77 = "152.233.29.1";
const HUMAN = "8.8.8.8";
const CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function visitor(ip: string): HeadersInit {
  return { "user-agent": CHROME, "x-forwarded-for": ip, accept: "application/json" };
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
  return { res, text, body };
}

type ClickRow = {
  ip_address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  unqualified?: boolean;
  unqualified_reason?: string | null;
  ip_network?: string | null;
};

async function main() {
  const geoBr = geoip.lookup(CDN77)?.country?.toUpperCase() ?? null;
  record(
    "a base geográfica ainda marca este IP como BR",
    geoBr === "BR",
    `geoip=${geoBr ?? "vazio"}`,
  );

  const stamp = Date.now().toString(36);
  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `e2e-cdn77-${stamp}@clickora.test`,
      password: "e2e-cdn77-pass",
      full_name: "E2E CDN77",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  if (!token || reg.res.status !== 201) throw new Error("registo " + reg.res.status);
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const created = await json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "CDN77 E2E",
      slug: `e2e-cdn77-${stamp}`,
      type: "tsl",
      status: "published",
      content: {
        title: "CDN77 E2E",
        affiliateLink: OFFER,
        salesText: "Oferta visível só para acesso residencial",
      },
    }),
  });
  const pageId = (created.body as { id?: string })?.id;
  if (!pageId) throw new Error("presell " + JSON.stringify(created.body));

  const humanPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(HUMAN) });
  const humanText = JSON.stringify(humanPage.body);
  record(
    "IP residencial vê a oferta",
    humanPage.res.ok && (humanPage.body as { cloak_safe?: boolean }).cloak_safe !== true && humanText.includes(OFFER),
    `status=${humanPage.res.status}`,
  );

  const cdnPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(CDN77) });
  const cdnText = JSON.stringify(cdnPage.body);
  record(
    "CDN77 vê a página segura, sem oferta",
    cdnPage.res.ok &&
      (cdnPage.body as { cloak_safe?: boolean }).cloak_safe === true &&
      !cdnText.includes("offer.example"),
    `status=${cdnPage.res.status} cloak=${(cdnPage.body as { cloak_safe?: boolean }).cloak_safe}`,
  );

  const cdnClick = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(CDN77),
    redirect: "manual",
  });
  const cdnBody = await cdnClick.text();
  record(
    "CDN77 não abre o hoplink",
    cdnClick.status === 403 && !cdnBody.includes("offer.example") && !cdnClick.headers.get("location"),
    `status=${cdnClick.status}`,
  );

  const humanClick = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(HUMAN),
    redirect: "manual",
  });
  const loc = humanClick.headers.get("location") || "";
  record(
    "IP residencial abre o hoplink",
    humanClick.status === 302 && loc.includes("offer.example") && loc.includes("clickora_click_id="),
    `status=${humanClick.status}`,
  );

  const eventsRes = await json("/api/analytics/events?event_type=click&limit=20", { headers: auth });
  const events = (Array.isArray(eventsRes.body) ? eventsRes.body : []) as ClickRow[];
  const cdnRow = events.find((e) => e.ip_address === CDN77);
  const humanRow = events.find((e) => e.ip_address === HUMAN);
  record(
    "relatório não usa o país do nó e explica a rede",
    !!cdnRow &&
      cdnRow.country == null &&
      !cdnRow.region &&
      !cdnRow.city &&
      cdnRow.unqualified === true &&
      cdnRow.ip_network === "CDN77" &&
      /VPN ou proxy/i.test(cdnRow.unqualified_reason || "") &&
      /não é qualificado/i.test(cdnRow.unqualified_reason || ""),
    cdnRow
      ? `${cdnRow.country}/${cdnRow.region} unqualified=${cdnRow.unqualified} ${cdnRow.unqualified_reason}`
      : "clique CDN77 ausente",
  );
  record(
    "o outro clique continua qualificado",
    !!humanRow && humanRow.unqualified !== true && humanRow.country === "US",
    humanRow ? `${humanRow.ip_address}=${humanRow.country} unqualified=${humanRow.unqualified}` : "clique residencial ausente",
  );

  const dash = (await json("/api/analytics/dashboard", { headers: auth })).body as {
    total_clicks?: number;
    clicks_by_country?: { country_code: string | null; clicks: number }[];
  };
  const countries = new Map((dash.clicks_by_country || []).map((r) => [r.country_code, r.clicks]));
  record(
    "o painel não conta o clique da CDN77",
    dash.total_clicks === 1 && countries.get("US") === 1 && countries.get("GB") == null && countries.get("BR") == null,
    `clicks=${dash.total_clicks} países=${[...countries.entries()].map(([k, v]) => `${k}:${v}`).join(",")}`,
  );

  const pages = (await json("/api/presells", { headers: auth })).body as { id: string; clicks: number }[];
  const page = pages.find((p) => p.id === pageId);
  record(
    "o contador da presell ignora a CDN77",
    page?.clicks === 1,
    `clicks=${page?.clicks}`,
  );

  const db = await systemPrisma.trackingEvent.findMany({
    where: { presellPageId: pageId, eventType: "click" },
    select: { ipAddress: true, country: true, metadata: true },
  });
  const stored = db.find((r) => r.ipAddress === CDN77);
  const meta = (stored?.metadata || {}) as { exclude_from_kpi?: boolean; ip_quality?: string; redirect_to?: string };
  record(
    "a base não grava o país do nó, sem hoplink, fora do KPI",
    db.length === 2 &&
      !stored?.country &&
      meta.exclude_from_kpi === true &&
      meta.ip_quality === "datacenter" &&
      !meta.redirect_to,
    `rows=${db.length} country=${stored?.country} kpi=${meta.exclude_from_kpi} to=${meta.redirect_to || "vazio"}`,
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
