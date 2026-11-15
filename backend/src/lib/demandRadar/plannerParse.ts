/** Parsers puros do Keyword Ideas — testáveis sem rede Google. */

export type DemandMonthlyVolumePoint = {
  year: number;
  month: number;
  monthly_searches: number;
};

export type DemandPlannerIdea = {
  keyword: string;
  monthly_volume: number;
  avg_cpc: number;
  competition: "low" | "medium" | "high";
  /** Histórico mensal oficial quando a API devolve `monthlySearchVolumes`. */
  monthly_search_volumes: DemandMonthlyVolumePoint[];
};

export type PlannerPrimaryKind = "exact_seed" | "close_seed" | "top_related";

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

export function extractMonthlySearchVolumes(m: Record<string, unknown>): DemandMonthlyVolumePoint[] {
  const raw = m.monthlySearchVolumes ?? m.monthly_search_volumes;
  if (!Array.isArray(raw)) return [];
  const out: DemandMonthlyVolumePoint[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const year = parsePlannerYear(o.year ?? o.year_);
    const month = parsePlannerMonth(o.month ?? o.month_ ?? o.monthOfYear);
    let vol = numFromPlannerProto(o.monthlySearches ?? o.monthly_searches ?? o.monthly_searches_);
    if (year < 2000 || month < 1 || month > 12) continue;
    if (!Number.isFinite(vol) || vol < 0) vol = 0;
    out.push({ year, month, monthly_searches: Math.round(vol) });
  }
  out.sort((a, b) => a.year - b.year || a.month - b.month);
  return out;
}

export function normalizePlannerPhrase(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapPlannerCompetition(raw: unknown): "low" | "medium" | "high" {
  const u = String(raw ?? "").toUpperCase();
  if (u.includes("LOW") || u === "2") return "low";
  if (u.includes("HIGH") || u === "4") return "high";
  if (u.includes("MEDIUM") || u === "3") return "medium";
  return "medium";
}

/** Aceita number, string numérica e proto JSON (`"5400"`). */
export function numFromPlannerProto(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type IdeaRow = {
  text?: string;
  keywordIdeaMetrics?: Record<string, unknown>;
  keyword_idea_metrics?: Record<string, unknown>;
};

export function rowToPlannerIdea(row: IdeaRow): DemandPlannerIdea | null {
  const keyword = String(row.text ?? "").trim();
  if (!keyword) return null;
  const m = row.keywordIdeaMetrics ?? row.keyword_idea_metrics;
  if (!m || typeof m !== "object") return null;

  const vol = numFromPlannerProto(m.avgMonthlySearches ?? m.avg_monthly_searches);
  let avgCpc = numFromPlannerProto(m.averageCpcMicros ?? m.average_cpc_micros) / 1_000_000;
  if (!Number.isFinite(avgCpc) || avgCpc <= 0) {
    const low = numFromPlannerProto(m.lowTopOfPageBidMicros ?? m.low_top_of_page_bid_micros);
    const high = numFromPlannerProto(m.highTopOfPageBidMicros ?? m.high_top_of_page_bid_micros);
    if (low > 0 && high > 0) avgCpc = (low + high) / 2 / 1_000_000;
  }

  const monthly_volume = Math.max(0, Math.round(vol));
  const avg_cpc =
    Number.isFinite(avgCpc) && avgCpc > 0 ? Math.round(avgCpc * 100) / 100 : 0;

  /** Volume 0 com CPC pode ser válido; ambos 0 = linha inútil. */
  if (monthly_volume === 0 && avg_cpc <= 0) return null;

  return {
    keyword,
    monthly_volume,
    avg_cpc,
    competition: mapPlannerCompetition(m.competition),
    monthly_search_volumes: extractMonthlySearchVolumes(m),
  };
}

export function pickPlannerSeedMatch(
  ideas: DemandPlannerIdea[],
  seed: string,
): { match: DemandPlannerIdea | null; kind: PlannerPrimaryKind | null } {
  if (!ideas.length) return { match: null, kind: null };
  const target = normalizePlannerPhrase(seed);
  if (!target) return { match: null, kind: null };

  const exact = ideas.find((i) => normalizePlannerPhrase(i.keyword) === target);
  if (exact) return { match: exact, kind: "exact_seed" };

  const close = ideas.find((i) => {
    const t = normalizePlannerPhrase(i.keyword);
    return t.includes(target) || target.includes(t);
  });
  if (close) return { match: close, kind: "close_seed" };

  return { match: null, kind: null };
}

/**
 * Ordena por volume, escolhe métrica primária (semente ou top relacionado)
 * e garante que a primária entra na lista limitada.
 */
export function finalizePlannerIdeas(
  ideas: DemandPlannerIdea[],
  seed: string,
  limit = 20,
): {
  ideas: DemandPlannerIdea[];
  seed_match: DemandPlannerIdea | null;
  primary: DemandPlannerIdea | null;
  primary_kind: PlannerPrimaryKind | null;
} {
  const sorted = [...ideas].sort(
    (a, b) => b.monthly_volume - a.monthly_volume || a.keyword.localeCompare(b.keyword),
  );
  const { match: seed_match, kind: seedKind } = pickPlannerSeedMatch(sorted, seed);
  const primary = seed_match ?? sorted[0] ?? null;
  const primary_kind: PlannerPrimaryKind | null = seed_match
    ? seedKind
    : primary
      ? "top_related"
      : null;

  const cap = Math.min(40, Math.max(5, limit));
  const trimmed: DemandPlannerIdea[] = [];
  const seen = new Set<string>();

  if (primary) {
    trimmed.push(primary);
    seen.add(normalizePlannerPhrase(primary.keyword));
  }
  for (const idea of sorted) {
    if (trimmed.length >= cap) break;
    const key = normalizePlannerPhrase(idea.keyword);
    if (seen.has(key)) continue;
    seen.add(key);
    trimmed.push(idea);
  }

  return { ideas: trimmed, seed_match, primary, primary_kind };
}

export function parseKeywordIdeasResponse(
  raw: { results?: IdeaRow[] } | null | undefined,
  seed: string,
  limit = 20,
): ReturnType<typeof finalizePlannerIdeas> {
  const ideas: DemandPlannerIdea[] = [];
  for (const row of raw?.results ?? []) {
    const idea = rowToPlannerIdea(row);
    if (idea) ideas.push(idea);
  }
  return finalizePlannerIdeas(ideas, seed, limit);
}
