/**
 * Auditoria seed: login → presell publicada → split Final URL + sufixo → /track/r/ com UTMs.
 *
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   E2E_EMAIL=… E2E_PASSWORD=… \
 *   npx tsx scripts/e2e-google-ads-url-seed-audit.ts
 */
import assert from "node:assert/strict";
import {
  buildGoogleAdsPresellUrlParts,
  cleanPresellUrlForGoogleFinalBase,
} from "../../frontend/src/lib/googleAdsPresellUrl";

const API = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL || "danielclickora@gmail.com";
const PASS = process.env.E2E_PASSWORD || "Dpa211088@";
const APP_ORIGIN = (process.env.E2E_APP_BASE || "https://www.dclickora.com").replace(/\/$/, "");

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function json(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, body, location: res.headers.get("location") };
}

function publicPresellUrlFromRow(p: Record<string, unknown>): string {
  const slug = String(p.slug || "").trim();
  const id = String(p.id || "").trim();
  const custom = p.custom_domain as { hostname?: string } | null | undefined;
  const host = custom?.hostname?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "")}/p/${slug || id}`;
  if (slug) return `${APP_ORIGIN}/p/${slug}`;
  return `${APP_ORIGIN}/p/${id}`;
}

async function main() {
  console.log(`API=${API}`);

  const login = await json("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const token = (login.body as { token?: string } | null)?.token;
  check("login", login.status === 200 && Boolean(token), `http=${login.status}`);
  assert.ok(token);

  const presells = await json("/presells", { headers: { Authorization: `Bearer ${token}` } });
  const list = Array.isArray(presells.body)
    ? (presells.body as Array<Record<string, unknown>>)
    : [];
  check("presells_list", presells.status === 200, `http=${presells.status} n=${list.length}`);

  const published = list.find((p) => String(p.status || "").toLowerCase() === "published");
  if (!published) {
    check("ads_url_split", false, "sem presell published");
  } else {
    const title = String(published.title || published.slug || "campanha");
    const publicUrl = publicPresellUrlFromRow(published);
    const polluted = `${publicUrl}?utm_source=x&gclid=should-strip`;
    const { finalUrl, finalUrlSuffix, combinedTrackingUrl } = buildGoogleAdsPresellUrlParts(
      publicUrl,
      title,
      "Google Ads",
    );
    check("final_url_no_query", !finalUrl.includes("?"), finalUrl.slice(0, 80));
    check(
      "final_url_clean_base",
      finalUrl === cleanPresellUrlForGoogleFinalBase(polluted),
      "strip query+gclid",
    );
    check("suffix_no_leading_q", !finalUrlSuffix.startsWith("?"), finalUrlSuffix.slice(0, 60));
    check("suffix_has_utm", /utm_source=/.test(finalUrlSuffix), "utm_source");
    check("suffix_no_gclid", !/gclid/i.test(finalUrlSuffix), "sem gclid manual");
    check(
      "combined_no_click_ids",
      !/gclid|gad_source|gbraid/i.test(combinedTrackingUrl),
      "modo simples",
    );
    check(
      "combined_matches_split",
      combinedTrackingUrl === `${finalUrl}?${finalUrlSuffix}`,
      "final+sufixo",
    );
    check("suffix_valuetrack", /\{keyword\}/.test(finalUrlSuffix), "utm_term");

    const pub = await json(`/public/presells/id/${published.id}`);
    check("public_presell_ok", pub.status === 200 && (pub.body as { cloak_safe?: boolean })?.cloak_safe !== true, `http=${pub.status}`);

    const content = ((pub.body as { content?: Record<string, unknown> })?.content || {}) as Record<string, unknown>;
    const aff = String(content.affiliateLink || "");
    if (aff.startsWith("http")) {
      const q = new URLSearchParams({
        to: aff,
        gclid: `audit_${Date.now()}`,
        utm_source: "google_ads",
        utm_medium: "cpc",
        utm_campaign: "audit-seed",
        utm_term: "test",
      });
      const track = await json(`/track/r/${published.id}?${q.toString()}`);
      const loc = track.location || "";
      check("track_r_redirect", [301, 302].includes(track.status) && loc.startsWith("http"), `http=${track.status}`);
      check("track_r_paid_id", /clickora_click_id=|subid|gclid=/i.test(loc), loc.slice(0, 100));
    } else {
      check("track_r_redirect", false, "sem affiliateLink");
      check("track_r_paid_id", false, "skipped");
    }
  }

  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} checks`);
  if (failed) {
    console.log("GOOGLE_ADS_URL_SEED_AUDIT_FAILED");
    process.exit(1);
  }
  console.log("GOOGLE_ADS_URL_SEED_AUDIT_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});