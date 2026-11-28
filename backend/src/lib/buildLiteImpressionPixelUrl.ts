import type { Request } from "express";
import {
  firstQueryString,
  realClickIdQuery,
  realUtmDimensionQuery,
  requestCookieValue,
} from "./trackQueryHelpers";

const CLICK_KEYS = new Set(["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid"]);

/** Espelho de `VOLUUM_STYLE_TRACKING_KEYS` em `frontend/src/pages/PublicPresell.tsx`. */
const VOLUUM_STYLE_TRACKING_KEYS = [
  "cost",
  "externalid",
  "clickid",
  "cid",
  "var1",
  "var2",
  "var3",
  "var4",
  "var5",
  "var6",
  "var7",
  "var8",
  "var9",
  "var10",
] as const;

const PARENT_CLICK_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUnreplacedMacro(v: string): boolean {
  return /^\{[\w.]+\}$/.test(v) || /^\{\{/.test(v) || /^%7B[\w.]+%7D$/i.test(v);
}

/** Click IDs, UTMs e subs da URL de chegada (sem macros por substituir). */
export function liteLandingAttributionParams(req: Pick<Request, "query">): URLSearchParams {
  const params = new URLSearchParams();
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "gad_source",
    "gad_campaignid",
    "fbclid",
    "ttclid",
    "msclkid",
    "sub1",
    "sub2",
    "sub3",
    "source",
    "medium",
    "campaign",
    ...VOLUUM_STYLE_TRACKING_KEYS,
  ] as const;

  for (const k of keys) {
    let v: string | undefined;
    if (k === "utm_term" || k === "utm_content") {
      v = realUtmDimensionQuery(req.query, k);
    } else if (CLICK_KEYS.has(k)) {
      v = realClickIdQuery(req.query, k);
    } else {
      v = firstQueryString(req.query, k);
      if (v && isUnreplacedMacro(v)) v = undefined;
    }
    if (v) params.set(k, v);
  }
  return params;
}

function appendPixelCookies(req: Pick<Request, "headers">, params: URLSearchParams): void {
  const fbp = requestCookieValue(req as Request, "_fbp");
  if (fbp) params.set("fbp", fbp);
  const ttp = requestCookieValue(req as Request, "_ttp");
  if (ttp) params.set("ttp", ttp);
}

/**
 * Query do CTA lite → `/track/r/` — mesma atribuição que `makeTrackClickUrl` na SPA
 * (inclui `parent_click_id` do rotador e cookies `_fbp` / `_ttp` para CAPI).
 */
export function liteTrackClickParams(req: Pick<Request, "query" | "headers">): URLSearchParams {
  const params = liteLandingAttributionParams(req);
  const parentClick =
    firstQueryString(req.query, "clickora_click_id") || firstQueryString(req.query, "parent_click_id");
  if (parentClick && PARENT_CLICK_UUID_RE.test(parentClick)) {
    params.set("parent_click_id", parentClick);
  }
  appendPixelCookies(req, params);
  return params;
}

/** Espelho de `buildOfferForwardParamKeys` em `frontend/src/lib/presellOfferQueryForward.ts`. */
const DEFAULT_OFFER_FORWARD_KEYS = ["sub1", "sub2"] as const;
const BLOCKED_FORWARD_KEYS = new Set(["to"]);

function normalizeOfferForwardParamKey(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 64) return null;
  if (!/^[a-z0-9_-]+$/.test(t)) return null;
  if (BLOCKED_FORWARD_KEYS.has(t)) return null;
  return t;
}

export function buildOfferForwardParamKeys(settings: unknown): string[] {
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).offerQueryForwardAllowlist
      : undefined;
  const extra: string[] = [];
  if (typeof raw === "string") {
    for (const p of raw.trim().split(/[,\s]+/)) {
      if (extra.length >= 32) break;
      const nk = normalizeOfferForwardParamKey(p);
      if (nk && !extra.includes(nk)) extra.push(nk);
    }
  }
  const out: string[] = [];
  for (const k of [...DEFAULT_OFFER_FORWARD_KEYS, ...extra]) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** Chaves da allowlist presentes na chegada (match sem maiúsculas), para fundir no hoplink. */
export function liteOfferForwardParams(req: Pick<Request, "query">, settings: unknown): URLSearchParams {
  const out = new URLSearchParams();
  const keys = buildOfferForwardParamKeys(settings);
  for (const nk of keys) {
    for (const [k, v] of Object.entries(req.query)) {
      if (k.toLowerCase() !== nk) continue;
      const s = typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "";
      if (s.trim()) {
        out.set(nk, s);
        break;
      }
    }
  }
  return out;
}

/**
 * URL do pixel 1×1 para HTML lite — mesma atribuição que a SPA (`PublicPresell` / `pixel.gif`).
 * Sem `<script>`: só `<img>` no documento estático.
 */
export function buildLiteImpressionPixelUrl(
  trackApiBase: string,
  presellId: string,
  req: Pick<Request, "query" | "headers">,
): string {
  const base = trackApiBase.replace(/\/+$/, "");
  const params = new URLSearchParams();
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.trim()) {
    params.set("referrer", referer.trim());
  }
  for (const [k, v] of liteLandingAttributionParams(req)) params.set(k, v);
  appendPixelCookies(req, params);

  const path = `${base}/track/pixel/${encodeURIComponent(presellId)}.gif`;
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
