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
  /** Lance topo de página (percentil baixo) — Planejador. */
  bid_low: number | null;
  /** Lance topo de página (percentil alto) — Planejador. */
  bid_high: number | null;
  competition: "low" | "medium" | "high";
  /** 0–100 do Planejador quando a API devolve `competitionIndex`. */
  competition_index: number | null;
  /** Δ vs ~3 meses atrás, derivado da série mensal oficial (null se sem histórico). */
  change_3m_pct: number | null;
  /** Δ YoY (mesmo mês ano anterior), derivado da série mensal oficial. */
  change_yoy_pct: number | null;
  /** Histórico mensal oficial quando a API devolve `monthlySearchVolumes`. */
  monthly_search_volumes: DemandMonthlyVolumePoint[];
};

export type DemandPlannerDeviceShare = {
  device: "desktop" | "mobile" | "tablet";
  search_share: number;
  search_count: number | null;
};

export type DemandPlannerDeviceBreakdown = {
  source: "google_ads_keyword_planner";
  source_label: string;
  note: string;
  items: DemandPlannerDeviceShare[];
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

function microsToUsd(raw: unknown): number | null {
  const micros = numFromPlannerProto(raw);
  if (!Number.isFinite(micros) || micros <= 0) return null;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

/** Δ% a partir da série mensal oficial do Planejador (sem inventar pontos). */
export function computeVolumeChanges(volumes: DemandMonthlyVolumePoint[]): {
  change_3m_pct: number | null;
  change_yoy_pct: number | null;
} {
  if (!volumes.length) return { change_3m_pct: null, change_yoy_pct: null };
  const sorted = [...volumes].sort((a, b) => a.year - b.year || a.month - b.month);
  const last = sorted[sorted.length - 1]!;
  const threeAgo = sorted.find((p) => {
    const target = addMonths(last.year, last.month, -3);
    return p.year === target.year && p.month === target.month;
  });
  const yearAgo = sorted.find((p) => p.year === last.year - 1 && p.month === last.month);

  const pct = (cur: number, prev: number | undefined) => {
    if (prev == null || prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  };

  return {
    change_3m_pct: pct(last.monthly_searches, threeAgo?.monthly_searches),
    change_yoy_pct: pct(last.monthly_searches, yearAgo?.monthly_searches),
  };
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function rowToPlannerIdea(row: IdeaRow): DemandPlannerIdea | null {
  const keyword = String(row.text ?? "").trim();
  if (!keyword) return null;
  const m = row.keywordIdeaMetrics ?? row.keyword_idea_metrics;
  if (!m || typeof m !== "object") return null;

  const vol = numFromPlannerProto(m.avgMonthlySearches ?? m.avg_monthly_searches);
  const bid_low = microsToUsd(m.lowTopOfPageBidMicros ?? m.low_top_of_page_bid_micros);
  const bid_high = microsToUsd(m.highTopOfPageBidMicros ?? m.high_top_of_page_bid_micros);
  let avgCpc = numFromPlannerProto(m.averageCpcMicros ?? m.average_cpc_micros) / 1_000_000;
  if ((!Number.isFinite(avgCpc) || avgCpc <= 0) && bid_low != null && bid_high != null) {
    avgCpc = (bid_low + bid_high) / 2;
  }

  const monthly_volume = Math.max(0, Math.round(vol));
  const avg_cpc =
    Number.isFinite(avgCpc) && avgCpc > 0 ? Math.round(avgCpc * 100) / 100 : 0;

  /** Volume 0 com CPC pode ser válido; ambos 0 = linha inútil. */
  if (monthly_volume === 0 && avg_cpc <= 0 && bid_low == null && bid_high == null) return null;

  const rawIdxVal = m.competitionIndex ?? m.competition_index;
  const competition_index =
    rawIdxVal == null || rawIdxVal === ""
      ? null
      : (() => {
          const rawIdx = numFromPlannerProto(rawIdxVal);
          return Number.isFinite(rawIdx) && rawIdx >= 0 ? Math.min(100, Math.round(rawIdx)) : null;
        })();

  const monthly_search_volumes = extractMonthlySearchVolumes(m);
  const { change_3m_pct, change_yoy_pct } = computeVolumeChanges(monthly_search_volumes);

  return {
    keyword,
    monthly_volume,
    avg_cpc,
    bid_low,
    bid_high,
    competition: mapPlannerCompetition(m.competition),
    competition_index,
    change_3m_pct,
    change_yoy_pct,
    monthly_search_volumes,
  };
}

function mapDeviceBucket(raw: unknown): DemandPlannerDeviceShare["device"] | null {
  const u = String(raw ?? "").toUpperCase();
  if (u.includes("MOBILE") || u === "2") return "mobile";
  if (u.includes("TABLET") || u === "3") return "tablet";
  if (u.includes("DESKTOP") || u === "4") return "desktop";
  return null;
}

/**
 * `aggregateMetricResults.deviceSearches` do Keyword Ideas (só quando pedido DEVICE).
 * Não inventa shares — devolve null se a API não trouxer dados.
 */
export function parsePlannerDeviceBreakdown(
  raw: Record<string, unknown> | null | undefined,
): DemandPlannerDeviceBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const agg =
    (raw.aggregateMetricResults as Record<string, unknown> | undefined) ??
    (raw.aggregate_metric_results as Record<string, unknown> | undefined);
  if (!agg || typeof agg !== "object") return null;
  const rows =
    (agg.deviceSearches as unknown[] | undefined) ??
    (agg.device_searches as unknown[] | undefined);
  if (!Array.isArray(rows) || !rows.length) return null;

  const counts = new Map<DemandPlannerDeviceShare["device"], number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const device = mapDeviceBucket(o.device ?? o.device_);
    if (!device) continue;
    const count = numFromPlannerProto(
      o.searchCount ?? o.search_count ?? o.searches ?? o.searchShare ?? o.search_share,
    );
    if (!Number.isFinite(count) || count < 0) continue;
    counts.set(device, (counts.get(device) ?? 0) + count);
  }
  if (!counts.size) return null;

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const order: DemandPlannerDeviceShare["device"][] = ["desktop", "mobile", "tablet"];
  const items = order
    .filter((d) => counts.has(d))
    .map((device) => {
      const search_count = counts.get(device) ?? 0;
      return {
        device,
        search_count: Math.round(search_count),
        search_share: Math.round((search_count / total) * 1000) / 10,
      };
    });
  if (!items.length) return null;

  return {
    source: "google_ads_keyword_planner",
    source_label: "Google Ads — Planejador (partilha de pesquisas por dispositivo)",
    note: "Partilha oficial do Keyword Ideas para o seed neste mercado/idioma — não é o tráfego da sua conta.",
    items,
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
