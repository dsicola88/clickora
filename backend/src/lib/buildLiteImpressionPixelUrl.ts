import type { Request } from "express";
import {
  firstQueryString,
  realClickIdQuery,
  realUtmDimensionQuery,
  requestCookieValue,
} from "./trackQueryHelpers";

const CLICK_KEYS = new Set(["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid"]);

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
  ] as const;

  for (const k of keys) {
    let v: string | undefined;
    if (k === "utm_term" || k === "utm_content") {
      v = realUtmDimensionQuery(req.query, k);
    } else if (CLICK_KEYS.has(k)) {
      v = realClickIdQuery(req.query, k);
    } else {
      v = firstQueryString(req.query, k);
    }
    if (v) params.set(k, v);
  }

  const fbp = requestCookieValue(req as Request, "_fbp");
  if (fbp) params.set("fbp", fbp);
  const ttp = requestCookieValue(req as Request, "_ttp");
  if (ttp) params.set("ttp", ttp);

  const path = `${base}/track/pixel/${encodeURIComponent(presellId)}.gif`;
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}