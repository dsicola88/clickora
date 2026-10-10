/**
 * E2E HTTP da protecção (página, pixel, clique e rotador).
 * Corre contra uma API já no ar. Não usa a base de produção: o processo
 * tem de ter DATABASE_URL a apontar para a mesma base local dessa API.
 *
 *   E2E_BASE=http://127.0.0.1:39991 node --import tsx scripts/e2e-traffic-guard.ts
 */
import assert from "node:assert/strict";
import geoip from "geoip-lite";
import { systemPrisma } from "../src/lib/prisma";

const BASE = (process.env.E2E_BASE || "http://127.0.0.1:39991").replace(/\/+$/, "");
const OFFER = "https://offer.example/go";
const ARM = "https://arm.example/landing";
const MIRROR_MARKER = "ESPELHO_SECRETO_E2E";
const SCRIPT_MARKER = "E2E_HEADER_SCRIPT";
const HUMAN_IP = "8.8.8.8";
const BLOCKED_IP = "1.1.1.1";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function countryOf(ip: string): string | null {
  return geoip.lookup(ip)?.country?.toUpperCase() ?? null;
}

function findGeoIp(): { ip: string; country: string } {
  const human = countryOf(HUMAN_IP);
  const candidates = ["114.114.114.114", "223.5.5.5", "1.2.4.8", "202.96.134.133", "180.76.76.76"];
  for (const ip of candidates) {
    const country = countryOf(ip);
    if (country && country !== human) return { ip, country };
  }
  throw new Error("geoip-lite não devolveu um país diferente de " + HUMAN_IP);
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

function visitor(ip: string, ua: string, extra?: Record<string, string>): HeadersInit {
  return {
    "user-agent": ua,
    "x-forwarded-for": ip,
    accept: "application/json",
    ...extra,
  };
}

async function main() {
  const geo = findGeoIp();
  const stamp = Date.now().toString(36);
  const email = `e2e-guard-${stamp}@clickora.test`;

  const health = await fetch(`${BASE}/api/health`);
  assert.equal(health.ok, true, "API sem /api/health");

  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "e2e-guard-pass",
      full_name: "E2E Guard",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  record("registo", reg.res.status === 201 && !!token, `status=${reg.res.status}`);
  if (!token) throw new Error("sem token");
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const created = await json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "Oferta E2E",
      slug: `e2e-guard-${stamp}`,
      type: "tsl",
      status: "published",
      content: {
        title: "Oferta E2E",
        affiliateLink: OFFER,
        salesText: "Texto comercial da oferta",
        importMirrorSrcDoc: `<html><body>${MIRROR_MARKER}</body></html>`,
      },
      tracking: { offerUrl: "https://offer.example/legacy" },
      settings: {
        enterpriseCloak: true,
        cloakSafeTitle: "Texto seguro E2E",
        cloakSafeBody: "Sem oferta.",
        cloakGeoDeny: geo.country,
        headerCode: `<script>${SCRIPT_MARKER}</script>`,
        conversionTrackingScript: SCRIPT_MARKER,
      },
    }),
  });
  const pageId = (created.body as { id?: string })?.id;
  record("criar presell publicada", created.res.status < 300 && !!pageId, `status=${created.res.status} id=${pageId ?? ""}`);
  if (!pageId) throw new Error(JSON.stringify(created.body));

  const humanPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(HUMAN_IP, CHROME) });
  const humanJson = JSON.stringify(humanPage.body);
  record(
    "humano vê a oferta",
    humanPage.res.ok &&
      (humanPage.body as { cloak_safe?: boolean }).cloak_safe !== true &&
      humanJson.includes(OFFER) &&
      humanJson.includes(MIRROR_MARKER),
    `status=${humanPage.res.status} cloak=${(humanPage.body as { cloak_safe?: boolean }).cloak_safe}`,
  );

  const geoPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(geo.ip, CHROME) });
  const geoText = JSON.stringify(geoPage.body);
  record(
    `país ${geo.country} vê página segura`,
    geoPage.res.ok &&
      (geoPage.body as { cloak_safe?: boolean }).cloak_safe === true &&
      !geoText.includes("offer.example") &&
      !geoText.includes(MIRROR_MARKER) &&
      !geoText.includes(SCRIPT_MARKER),
    `status=${geoPage.res.status} ip=${geo.ip}`,
  );

  const humanClick = await fetch(
    `${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}&gclid=e2eGclid123`,
    { headers: visitor(HUMAN_IP, CHROME), redirect: "manual" },
  );
  const loc = humanClick.headers.get("location") || "";
  record(
    "clique humano vai à oferta com click id",
    humanClick.status === 302 && loc.includes("offer.example") && loc.includes("clickora_click_id="),
    `status=${humanClick.status} location=${loc.slice(0, 180)}`,
  );

  const clicksAfterHuman = await systemPrisma.trackingEvent.count({
    where: { presellPageId: pageId, eventType: "click" },
  });
  record("clique humano gravado", clicksAfterHuman === 1, `clicks=${clicksAfterHuman}`);

  const guardsOn = await json("/api/integrations/tracking-guards", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ block_bot_clicks: true }),
  });
  record(
    "ligar bloqueio de bots",
    guardsOn.res.ok && (guardsOn.body as { block_bot_clicks?: boolean }).block_bot_clicks === true,
    `status=${guardsOn.res.status}`,
  );

  const botPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(HUMAN_IP, BOT) });
  const botText = JSON.stringify(botPage.body);
  record(
    "bot não vê a oferta na página",
    botPage.res.ok &&
      (botPage.body as { cloak_safe?: boolean }).cloak_safe === true &&
      !botText.includes("offer.example") &&
      !botText.includes(MIRROR_MARKER) &&
      !botText.includes(SCRIPT_MARKER) &&
      (botPage.body as { cloak_reason?: string }).cloak_reason === undefined,
    `status=${botPage.res.status}`,
  );

  const botClick = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(HUMAN_IP, BOT),
    redirect: "manual",
  });
  const botBody = await botClick.text();
  record(
    "bot não é enviado ao hoplink",
    botClick.status === 403 && !botBody.includes("offer.example") && !botClick.headers.get("location"),
    `status=${botClick.status}`,
  );

  const clicksAfterBot = await systemPrisma.trackingEvent.count({
    where: { presellPageId: pageId, eventType: "click" },
  });
  record("bot não cria clique", clicksAfterBot === 1, `clicks=${clicksAfterBot}`);

  const spoof = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(HUMAN_IP, CHROME, { "x-client-ip": BLOCKED_IP, "x-real-ip": BLOCKED_IP }),
    redirect: "manual",
  });
  record(
    "X-Client-IP não troca o visitante",
    spoof.status === 302 && (spoof.headers.get("location") || "").includes("offer.example"),
    `status=${spoof.status}`,
  );

  const listed = await json("/api/integrations/blacklist", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ ip: BLOCKED_IP, reason: "e2e" }),
  });
  record("blacklist", listed.res.ok, `status=${listed.res.status}`);

  const blockedPage = await json(`/api/public/presells/id/${pageId}`, { headers: visitor(BLOCKED_IP, CHROME) });
  const blockedText = JSON.stringify(blockedPage.body);
  record(
    "IP na lista vê página segura",
    blockedPage.res.ok &&
      (blockedPage.body as { cloak_safe?: boolean }).cloak_safe === true &&
      !blockedText.includes("offer.example"),
    `status=${blockedPage.res.status}`,
  );

  const blockedClick = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(BLOCKED_IP, CHROME),
    redirect: "manual",
  });
  const blockedClickBody = await blockedClick.text();
  record(
    "IP na lista não abre o hoplink",
    blockedClick.status === 403 && !blockedClickBody.includes("offer.example"),
    `status=${blockedClick.status}`,
  );

  const stillHuman = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: visitor(HUMAN_IP, CHROME),
    redirect: "manual",
  });
  record(
    "outro IP continua a ir à oferta",
    stillHuman.status === 302 && (stillHuman.headers.get("location") || "").includes("offer.example"),
    `status=${stillHuman.status}`,
  );

  const rot = await json("/api/traffic-rotators", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: "E2E rot",
      slug: `e2e-rot-${stamp}`,
      mode: "sequential",
      context_presell_id: pageId,
      is_active: true,
      arms: [{ destination_url: ARM, label: "A", order_index: 0, weight: 100 }],
    }),
  });
  const rotId = (rot.body as { id?: string })?.id;
  record("criar rotador", rot.res.status < 300 && !!rotId, `status=${rot.res.status}`);
  if (!rotId) throw new Error(JSON.stringify(rot.body));

  const rotBlocked = await fetch(`${BASE}/api/track/rot/${rotId}`, {
    headers: visitor(BLOCKED_IP, CHROME),
    redirect: "manual",
  });
  const rotBlockedBody = await rotBlocked.text();
  record(
    "rotador não entrega o braço ao IP bloqueado",
    rotBlocked.status === 403 && !rotBlockedBody.includes("arm.example") && !rotBlocked.headers.get("location"),
    `status=${rotBlocked.status}`,
  );

  const rotHuman = await fetch(`${BASE}/api/track/rot/${rotId}?gclid=e2eRotGclid`, {
    headers: visitor(HUMAN_IP, CHROME),
    redirect: "manual",
  });
  const rotLoc = rotHuman.headers.get("location") || "";
  record(
    "rotador humano vai ao braço",
    rotHuman.status === 302 && rotLoc.includes("arm.example") && rotLoc.includes("clickora_click_id="),
    `status=${rotHuman.status} location=${rotLoc.slice(0, 180)}`,
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
