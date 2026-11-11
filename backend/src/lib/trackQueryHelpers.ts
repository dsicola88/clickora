import type { Request } from "express";
import { isUnreplacedAdMacro, normalizeUtmDimension } from "./adUrlMacros";

export function cleanAdClickId(raw: string | undefined | null): string | undefined {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v || isUnreplacedAdMacro(v)) return undefined;
  return v;
}

export function firstQueryString(q: Request["query"], key: string): string | undefined {
  const v = q[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

/** Descarta macros não substituídas (`{gclid}`, `{{campaign.name}}`, …). */
export function realClickIdQuery(q: Request["query"], key: string): string | undefined {
  const v = firstQueryString(q, key);
  if (!v || isUnreplacedAdMacro(v)) return undefined;
  return v;
}

/** utm_term / utm_content: ignora `{keyword}` literal. */
export function realUtmDimensionQuery(q: Request["query"], key: string): string | undefined {
  return normalizeUtmDimension(firstQueryString(q, key)) ?? undefined;
}

export function realUtmDimensionBody(raw: string | undefined | null): string | undefined {
  return normalizeUtmDimension(raw) ?? undefined;
}

export function compactTrackingMeta(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

/** Lê cookie de primeiro partido no pedido (ex.: `_fbp` / `_ttp`). */
export function requestCookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== "string") return undefined;
  const re = new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`);
  const m = raw.match(re);
  if (!m?.[1]) return undefined;
  try {
    const v = decodeURIComponent(m[1].trim());
    return v || undefined;
  } catch {
    return m[1].trim() || undefined;
  }
}

export function parseCsvSimple(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    rows.push(t.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()));
  }
  return rows;
}
