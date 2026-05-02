/**
 * Métricas de palavra-chave via Google Ads API `generateKeywordIdeas` (Keyword Planner)
 * quando o projeto Dpilot tem OAuth Google Ads ligado.
 *
 * @see https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas
 */
import { API_BASE, getAccessFromRefreshToken, getGoogleDeveloperToken } from "./google-ads.api";
import { GOOGLE_GEO_CRITERION_IDS } from "./geo-google";
import { GOOGLE_ADS_LANGUAGE_NUMERIC_ID, normalizeGoogleLanguageCode } from "./language-google";
import { prisma } from "./paidPrisma";

export type PlannerSnapshot = {
  monthly_volume: number;
  avg_cpc_units: number;
  competition: "low" | "medium" | "high";
  /** Histórico mensal quando a API devolve `monthlySearchVolumes` (Keyword Ideas). */
  monthly_search_volumes: Array<{ year: number; month: number; monthly_searches: number }>;
};

const MONTH_ENUM: Record<string, number> = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};

function parsePlannerMonth(raw: unknown): number {
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return Math.floor(raw);
  const s = String(raw ?? "")
    .toUpperCase()
    .replace(/^MONTH_OF_YEAR_/i, "");
  if (MONTH_ENUM[s] != null) return MONTH_ENUM[s]!;
  const n = parseInt(String(raw).replace(/\D/g, ""), 10);
  if (n >= 1 && n <= 12) return n;
  return 0;
}

function parsePlannerYear(raw: unknown): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 2000 && n <= 2100) return Math.floor(n);
  return 0;
}

function extractMonthlySearchVolumes(m: Record<string, unknown>): Array<{
  year: number;
  month: number;
  monthly_searches: number;
}> {
  const raw = m.monthlySearchVolumes ?? m.monthly_search_volumes;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ year: number; month: number; monthly_searches: number }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const year = parsePlannerYear(o.year ?? o.year_);
    const month = parsePlannerMonth(o.month ?? o.month_ ?? o.monthOfYear);
    let vol = numFromProto(o.monthlySearches ?? o.monthly_searches ?? o.monthly_searches_);
    if (year < 2000 || month < 1 || month > 12) continue;
    if (!Number.isFinite(vol) || vol < 0) vol = 0;
    out.push({ year, month, monthly_searches: Math.round(vol) });
  }
  out.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return out;
}

function normalizePhrase(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapCompetition(raw: unknown): "low" | "medium" | "high" {
  const u = String(raw ?? "").toUpperCase();
  if (u.includes("LOW")) return "low";
  if (u.includes("HIGH")) return "high";
  return "medium";
}

function numFromProto(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/\D/g, "") || "0");
  return Number.isFinite(n) ? n : 0;
}

type IdeaRow = {
  text?: string;
  keywordIdeaMetrics?: Record<string, unknown>;
  keyword_idea_metrics?: Record<string, unknown>;
};

/** Tenta obter volume, CPC e concorrência reais; falha silenciosamente para o fluxo usar estimativas. */
export async function fetchKeywordPlannerMetrics(
  projectId: string,
  input: { keyword: string; countryCodes: string[]; languageCode: string },
): Promise<{ ok: false } | { ok: true; snapshot: PlannerSnapshot }> {
  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({
    where: { projectId },
  });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { ok: false };
  }

  const dev = getGoogleDeveloperToken();
  if (!dev) return { ok: false };

  const codes = [...new Set(input.countryCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))].slice(
    0,
    10,
  );
  const geoTargetConstants: string[] = [];
  for (const code of codes) {
    const id = GOOGLE_GEO_CRITERION_IDS[code];
    if (id == null) continue;
    geoTargetConstants.push(`geoTargetConstants/${id}`);
  }
  if (!geoTargetConstants.length) return { ok: false };

  const langIso = normalizeGoogleLanguageCode(input.languageCode) ?? "en";
  const langNum = GOOGLE_ADS_LANGUAGE_NUMERIC_ID[langIso];
  if (langNum == null) return { ok: false };

  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
  } catch {
    return { ok: false };
  }

  const customerId = conn.googleCustomerId.replace(/\D/g, "");
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${access}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  if (login) headers["login-customer-id"] = login;

  const seedKw = input.keyword.trim().slice(0, 80);
  if (!seedKw) return { ok: false };

  const reqBody = {
    language: `languageConstants/${langNum}`,
    geoTargetConstants,
    keywordPlanNetwork: "GOOGLE_SEARCH",
    keywordSeed: { keywords: [seedKw] },
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/customers/${customerId}:generateKeywordIdeas`, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });
  } catch {
    return { ok: false };
  }

  const rawText = await res.text();
  if (!res.ok) {
    return { ok: false };
  }
  let j: { results?: IdeaRow[] };
  try {
    j = JSON.parse(rawText) as { results?: IdeaRow[] };
  } catch {
    return { ok: false };
  }

  const rows = j.results ?? [];
  if (!rows.length) return { ok: false };

  const target = normalizePhrase(seedKw);
  let pick =
    rows.find((r) => normalizePhrase(String(r.text ?? "")) === target) ??
    rows.find((r) => {
      const t = normalizePhrase(String(r.text ?? ""));
      return t.includes(target) || target.includes(t);
    }) ??
    rows[0];

  const m = pick.keywordIdeaMetrics ?? pick.keyword_idea_metrics;
  if (!m || typeof m !== "object") return { ok: false };

  const vol = numFromProto(m.avgMonthlySearches ?? m.avg_monthly_searches);
  let avgCpcUnits = numFromProto(m.averageCpcMicros ?? m.average_cpc_micros) / 1_000_000;

  if (!Number.isFinite(avgCpcUnits) || avgCpcUnits <= 0) {
    const low = numFromProto(m.lowTopOfPageBidMicros ?? m.low_top_of_page_bid_micros);
    const high = numFromProto(m.highTopOfPageBidMicros ?? m.high_top_of_page_bid_micros);
    if (low > 0 && high > 0) {
      avgCpcUnits = (low + high) / 2 / 1_000_000;
    }
  }

  if ((!Number.isFinite(vol) || vol < 0) && (!Number.isFinite(avgCpcUnits) || avgCpcUnits <= 0)) {
    return { ok: false };
  }

  const competition = mapCompetition(m.competition);
  const monthly_volume = Math.max(0, Math.round(vol));
  const avg_cpc_units =
    Number.isFinite(avgCpcUnits) && avgCpcUnits > 0
      ? Math.round(avgCpcUnits * 100) / 100
      : 0;

  const monthly_search_volumes = extractMonthlySearchVolumes(m);

  /** CPC pode faltar em nichos com poucos dados — aí o UI combina com heurística no serviço de insight. */
  if (monthly_volume === 0 && avg_cpc_units <= 0) return { ok: false };

  return {
    ok: true,
    snapshot: {
      monthly_volume,
      avg_cpc_units,
      competition,
      monthly_search_volumes,
    },
  };
}
