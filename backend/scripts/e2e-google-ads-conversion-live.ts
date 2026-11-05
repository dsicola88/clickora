/**
 * Prova live: clique com gclid → postback afiliado → sync Google Ads.
 *
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   E2E_EMAIL=… E2E_PASSWORD=… \
 *   npx tsx scripts/e2e-google-ads-conversion-live.ts
 *
 * Nota: gclid sintético → Google pode recusar o ID; o critério de passagem
 * é o pipeline chegar a `sent` OU `failed` com erro da API (não skipped_no_gclid /
 * skipped_no_config / null parado).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.E2E_EMAIL || "danielclickora@gmail.com";
const PASS = process.env.E2E_PASSWORD || "Dpa211088@";
/** Destino real da conta seed — `example.com` / destinos bloqueados devolvem cloak 403. */
const OFFER = process.env.E2E_OFFER_URL || "https://mwebkivo.com/12531/5082/10/?";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function json(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const r = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(60_000) });
  let body: Record<string, unknown> = {};
  try {
    body = (await r.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: r.status, body };
}

async function main() {
  console.log(`\n=== Google Ads conversion LIVE ===\nAPI=${BASE}\n`);

  const login = await json("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = String(login.body.token || login.body.access_token || "");
  assert.ok(token);
  check("auth", true, EMAIL);

  const gads = await json("/integrations/google-ads", { token });
  const canUpload = Boolean(gads.body.can_upload);
  check(
    "google_ready",
    canUpload && Boolean(gads.body.google_ads_enabled) && Boolean(gads.body.has_refresh_token),
    `can_upload=${gads.body.can_upload} cid=${gads.body.google_ads_customer_id} action=${gads.body.google_ads_conversion_action_id}`,
  );
  if (!canUpload) {
    console.log("\nABORT: Google Ads não pronto a enviar.\n");
    process.exitCode = 1;
    return;
  }

  const hookInfo = await json("/integrations/affiliate-webhook-info", { token });
  assert.ok(hookInfo.status < 400, JSON.stringify(hookInfo.body));
  const rawHook = String(hookInfo.body.hook_url || hookInfo.body.url || "");
  assert.ok(rawHook.includes("token="), `hook ${rawHook}`);
  const hookParsed = new URL(rawHook);
  const apiBase = new URL(BASE.endsWith("/") ? BASE : `${BASE}/`);
  hookParsed.protocol = apiBase.protocol;
  hookParsed.host = apiBase.host;
  const hookUrl = hookParsed.toString();
  check("webhook", true, hookUrl.slice(0, 80));

  const list = await json("/presells", { token });
  const items = (Array.isArray(list.body)
    ? list.body
    : (list.body.data as unknown[]) || (list.body.presells as unknown[]) || []) as Array<
    Record<string, unknown>
  >;
  let page = items.find((p) => p.status === "published");
  let createdId = "";
  if (!page?.id) {
    const slug = `e2e-gads-${Date.now().toString(36)}`;
    const created = await json("/presells", {
      method: "POST",
      token,
      body: JSON.stringify({
        title: "E2E Google Ads live",
        slug,
        type: "builder",
        status: "published",
        language: "pt-BR",
        content: { title: "E2E", affiliateLink: OFFER, ctaText: "Buy" },
        tracking: { offerUrl: OFFER },
      }),
    });
    assert.ok(created.status < 300 && created.body.id, JSON.stringify(created.body));
    page = created.body;
    createdId = String(created.body.id);
  }
  const pageId = String(page!.id);
  check("presell", true, pageId.slice(0, 8));

  /** Formato tipico de gclid (não é clique Google real — API pode recusar). */
  const gclid = `Cj0KCQiA_e2eLive${Date.now().toString(36)}_audit`;
  const track = new URL(`${BASE}/track/r/${pageId}`);
  track.searchParams.set("to", OFFER);
  track.searchParams.set("gclid", gclid);
  track.searchParams.set("utm_source", "google");
  track.searchParams.set("utm_medium", "cpc");
  track.searchParams.set("utm_campaign", "e2e-gads-live");
  const hop = await fetch(track.toString(), {
    redirect: "manual",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  if (hop.status !== 302) {
    const body = await hop.text().catch(() => "");
    check("click_with_gclid", false, `track http=${hop.status} ${body.slice(0, 160)}`);
    process.exitCode = 1;
    return;
  }
  const loc = hop.headers.get("location") || "";
  const clickId = new URL(loc).searchParams.get("clickora_click_id");
  assert.ok(clickId, `no clickora_click_id in ${loc}`);
  check("click_with_gclid", true, `click=${clickId.slice(0, 8)} gclid=${gclid.slice(0, 24)}…`);

  const txn = randomUUID();
  const saleUrl = new URL(hookUrl);
  saleUrl.searchParams.set("clickora_click_id", clickId!);
  saleUrl.searchParams.set("amount", "47.00");
  saleUrl.searchParams.set("currency", "USD");
  saleUrl.searchParams.set("status", "approved");
  saleUrl.searchParams.set("transaction_id", txn);
  const saleRes = await fetch(saleUrl.toString(), { signal: AbortSignal.timeout(30_000) });
  const saleText = await saleRes.text();
  check("postback", saleRes.status < 400, `http=${saleRes.status} ${saleText.slice(0, 120)}`);

  let sync: string | null = null;
  let detail: unknown = null;
  let conversionId: string | null = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const convs = await json("/analytics/conversions?limit=30", { token });
    const rowsConv = (Array.isArray(convs.body)
      ? convs.body
      : (convs.body.data as unknown[]) || (convs.body.conversions as unknown[]) || []) as Array<
      Record<string, unknown>
    >;
    const hit =
      rowsConv.find((c) => String(c.external_order_id || c.transaction_id || "") === txn) ||
      rowsConv.find((c) => String(c.click_id || "") === clickId) ||
      rowsConv.find((c) => String(c.gclid || "") === gclid);
    if (hit) {
      conversionId = String(hit.id || "");
      sync = (hit.google_ads_sync as string | null) ?? null;
      detail = hit.google_ads_sync_detail ?? hit.googleAdsSyncDetail ?? null;
      if (sync === "sent" || sync === "failed" || sync === "skipped_no_gclid" || sync === "skipped_no_config" || sync === "skipped_disabled") {
        break;
      }
    }
    await sleep(3000);
  }

  check("conversion_found", Boolean(conversionId), `id=${conversionId?.slice(0, 8) || "none"} sync=${sync}`);

  const terminalOk =
    sync === "sent" ||
    sync === "failed"; /* failed = API Google contactada (ex. gclid sintético inválido) */
  const skippedBad =
    sync === "skipped_no_gclid" || sync === "skipped_no_config" || sync === "skipped_disabled" || !sync;
  check(
    "google_sync_terminal",
    terminalOk && !skippedBad,
    `google_ads_sync=${sync} detail=${typeof detail === "string" ? detail.slice(0, 160) : JSON.stringify(detail)?.slice(0, 160)}`,
  );

  if (sync === "sent") {
    check("google_accepted", true, "Google Ads aceitou a conversão offline (sent)");
  } else if (sync === "failed") {
    check(
      "google_api_reached",
      true,
      "Pipeline OK até à API Google (gclid de teste pode ser rejeitado — clique real de anúncio → sent)",
    );
  }

  const dash = await json("/analytics/dashboard", { token });
  const sh = dash.body.sync_health as Record<string, number> | undefined;
  check(
    "sync_health_present",
    Boolean(sh && typeof sh.google_ads_failed === "number"),
    JSON.stringify(sh),
  );

  if (createdId) {
    await json(`/presells/${createdId}`, { method: "DELETE", token }).catch(() => undefined);
  }

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} checks`);
  console.log(failed.length ? "GOOGLE_ADS_CONVERSION_LIVE_GAP" : "GOOGLE_ADS_CONVERSION_LIVE_OK");
  console.log("__JSON__");
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        sync,
        conversionId,
        clickId,
        gclid,
        customer_id: gads.body.google_ads_customer_id,
        conversion_action_id: gads.body.google_ads_conversion_action_id,
        rows,
        ts: new Date().toISOString(),
      },
      null,
      0,
    ),
  );
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
