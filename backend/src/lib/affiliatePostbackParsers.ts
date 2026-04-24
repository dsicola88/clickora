import type { Request } from "express";
import { Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Junta query string + corpo (JSON ou form) num mapa de strings. */
export function flattenAffiliatePayload(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  const b = req.body;
  if (b && typeof b === "object" && !Array.isArray(b)) {
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      if (v == null) continue;
      if (typeof v === "object") continue;
      out[k] = String(v);
    }
  }
  return out;
}

function normalizeUuid(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

/**
 * Identificador do clique (dclickora): enviado no redirect como clickora_click_id.
 * Aceita aliases comuns das redes (subid1, click_id, etc.) se forem UUID.
 */
export function extractClickIdFromPayload(flat: Record<string, string>): string | null {
  const keysExact = [
    "clickora_click_id",
    "click_id",
    "clickId",
    "CLICK_ID",
    "cid",
    "CID",
    "clickid",
    "CLICKID",
  ];
  for (const k of keysExact) {
    const id = normalizeUuid(flat[k]);
    if (id) return id;
  }
  const subKeys = ["subid1", "SUBID1", "subid", "SUBID", "sub1", "SUB1", "sid1", "SID1"];
  for (const k of subKeys) {
    const id = normalizeUuid(flat[k]);
    if (id) return id;
  }
  return null;
}

/** Redes usam vários valores; só criamos conversão com estes (venda aprovada). */
export function isApprovedSaleStatus(status: string | undefined): boolean {
  if (!status) return false;
  const raw = String(status).trim();
  const t = raw.toLowerCase();
  if (["1", "yes", "y", "true"].includes(t)) return true;
  return ["approved", "completed", "paid", "sale", "success", "complete"].includes(t);
}

export function pickAmountDecimal(flat: Record<string, string>): Prisma.Decimal | null {
  const keys = [
    "amount",
    "COMMISSION_AMOUNT",
    "commission_amount",
    "price",
    "payout",
    "value",
    "total",
    "revenue",
  ];
  for (const k of keys) {
    const raw = flat[k];
    if (raw === undefined) continue;
    const n = Number.parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return new Prisma.Decimal(n);
  }
  return null;
}

export function pickCurrency(flat: Record<string, string>): string {
  return (flat.cy || flat.currency || flat.CURRENCY || "USD").trim().slice(0, 8) || "USD";
}

/** Identificador de encomenda para deduplicação no Google Ads (order_id). */
export function pickOrderIdFromPayload(flat: Record<string, string>): string | null {
  const keys = [
    "orderid",
    "order_id",
    "ORDERID",
    "transaction_id",
    "txn_id",
    "invoice_id",
    "sale_id",
  ];
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  }
  return null;
}
