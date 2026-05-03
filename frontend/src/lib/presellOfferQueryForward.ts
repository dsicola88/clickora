/** Chaves que não podem ser propagadas (ambiguidade / segurança). */
const BLOCKED_FORWARD_KEYS = new Set(["to"]);

/**
 * Normaliza nome de parâmetro para a query do hoplink (minúsculas, subset seguro).
 */
export function normalizeOfferForwardParamKey(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 64) return null;
  if (!/^[a-z0-9_-]+$/.test(t)) return null;
  if (BLOCKED_FORWARD_KEYS.has(t)) return null;
  return t;
}

/**
 * Lista de tokens a partir do campo (vírgulas ou espaços).
 */
export function parseOfferQueryForwardAllowlist(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const parts = s.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  let count = 0;
  const max = 32;
  for (const p of parts) {
    if (count >= max) break;
    const nk = normalizeOfferForwardParamKey(p);
    if (!nk || seen.has(nk)) continue;
    seen.add(nk);
    out.push(nk);
    count++;
  }
  return out;
}

const DEFAULT_OFFER_FORWARD_KEYS = ["sub1", "sub2", "sub3"] as const;

/** Ordem: sub1–sub3 sempre; depois extras da allowlist nas settings. */
export function buildOfferForwardParamKeys(settings: Record<string, unknown>): string[] {
  const raw = settings.offerQueryForwardAllowlist;
  const extra = typeof raw === "string" ? parseOfferQueryForwardAllowlist(raw) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [...DEFAULT_OFFER_FORWARD_KEYS, ...extra]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function firstMatchingParam(search: URLSearchParams, canonicalKey: string): string | null {
  const lower = canonicalKey.toLowerCase();
  for (const k of search.keys()) {
    if (k.toLowerCase() === lower) {
      const v = search.get(k);
      if (v !== null && v.trim() !== "") return v;
    }
  }
  return null;
}

/**
 * Copia da URL da presell para o hoplink só chaves listadas, só se o hoplink ainda não tiver essa chave.
 * `forwardKeys` deve vir de `buildOfferForwardParamKeys` (já normalizadas).
 */
export function mergeLandingQueryIntoAffiliateUrl(
  affiliateLink: string,
  pageSearch: URLSearchParams,
  forwardKeys: string[],
): string {
  if (forwardKeys.length === 0) return affiliateLink;
  try {
    const u = new URL(affiliateLink);
    for (const nk of forwardKeys) {
      if (!nk || BLOCKED_FORWARD_KEYS.has(nk)) continue;
      if (u.searchParams.has(nk)) continue;
      const v = firstMatchingParam(pageSearch, nk);
      if (v) u.searchParams.set(nk, v);
    }
    return u.toString();
  } catch {
    return affiliateLink;
  }
}
