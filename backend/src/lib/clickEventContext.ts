/**
 * Sinais de contexto a partir do evento de clique — usados em CAPI/Events API para
 * event match quality (URL da página, referência opcional no payload TikTok).
 */

export function eventSourceUrlFromClick(click: {
  referrer: string | null | undefined;
  metadata: unknown;
}): string | undefined {
  const r = click.referrer?.trim();
  if (r && /^https?:\/\//i.test(r)) {
    return r.length > 2000 ? r.slice(0, 2000) : r;
  }
  const m = (click.metadata || {}) as Record<string, unknown>;
  for (const key of ["landing_url", "page_url", "url", "source_url"] as const) {
    const u = m[key];
    if (typeof u === "string" && /^https?:\/\//i.test(u.trim())) {
      const t = u.trim();
      return t.length > 2000 ? t.slice(0, 2000) : t;
    }
  }
  return undefined;
}

/** Campos string no primeiro nível (postback, IDs) — reutilizado em Meta/Google. */
export function stringFieldsFromJson(meta: unknown): Record<string, string> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === "object") continue;
    out[k] = String(v);
  }
  return out;
}

/** TikTok Events API: cookie de browser `_ttp` se existir no metadata do clique. */
export function tiktokTtpFromClickMetadata(metadata: unknown): string | undefined {
  const m = (metadata || {}) as Record<string, unknown>;
  const ttp = typeof m.ttp === "string" ? m.ttp : typeof m._ttp === "string" ? m._ttp : null;
  const s = ttp?.trim();
  if (s) return s.slice(0, 200);
  return undefined;
}
