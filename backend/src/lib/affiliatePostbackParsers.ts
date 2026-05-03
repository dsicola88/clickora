import type { Request } from "express";
import { Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_MERGE_DEPTH = 12;
const MAX_FLAT_KEYS = 480;

function primitiveToFlatString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return null;
}

/** Último segmento de uma chave dotted (ex.: data.subid1 → subid1, items[0].amount → amount). */
function leafKeyFromPrefixed(fullKey: string): string | null {
  if (!fullKey) return null;
  const afterLastDot = fullKey.includes(".") ? fullKey.slice(fullKey.lastIndexOf(".") + 1) : fullKey;
  const trimmed = afterLastDot.replace(/\[.*$/u, "").trim();
  if (!trimmed) return null;
  return trimmed;
}

function applyLeafAliases(out: Record<string, string>, fullKey: string, value: string): void {
  const leaf = leafKeyFromPrefixed(fullKey);
  if (leaf && out[leaf] === undefined && !/^[\s\d]+$/.test(leaf)) {
    out[leaf] = value;
  }
}

/**
 * Recursivamente achata JSON POST em strings (paths tipo `parent.child`, arrays como `items[0].k`).
 * Chaves compostas fazem overwrite; aliases de folha (`subid1` desde `data.subid1`) só preenchem se a folha estiver livre —
 * para não pisar params de nível topo vindos da query antes do merge.
 */
export function mergeJsonBodyIntoFlatRecord(body: unknown, out: Record<string, string>): void {
  function walk(node: unknown, prefix: string, depth: number): void {
    if (Object.keys(out).length >= MAX_FLAT_KEYS || depth > MAX_MERGE_DEPTH) return;
    const prim = primitiveToFlatString(node);
    if (prim !== null) {
      if (prefix) {
        out[prefix] = prim;
        applyLeafAliases(out, prefix, prim);
      }
      return;
    }
    if (Array.isArray(node)) {
      const cap = Math.min(node.length, 24);
      for (let i = 0; i < cap; i++) {
        if (Object.keys(out).length >= MAX_FLAT_KEYS) return;
        const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
        walk(node[i], p, depth + 1);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_FLAT_KEYS) return;
        const p = prefix ? `${prefix}.${k}` : k;
        walk(v, p, depth + 1);
      }
    }
  }

  walk(body, "", 0);
}

/** Junta query string + corpo (JSON ou form aninhado) num mapa de strings. */
export function flattenAffiliatePayload(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  const b = req.body;
  if (Array.isArray(b)) {
    mergeJsonBodyIntoFlatRecord({ items: b }, out);
  } else if (b && typeof b === "object") {
    mergeJsonBodyIntoFlatRecord(b, out);
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
