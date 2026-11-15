import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../prisma";
import {
  getGoogleAdsReportingUnavailability,
  isGoogleAdsMetricsReadyForUser,
  type GoogleAdsUserSettings,
} from "../../modules/googleAds/googleAds.service";
import { demandTextMatches } from "./match";
import {
  fetchUserKeywordPlannerIdeas,
  type DemandPlannerTimeframe,
} from "./userKeywordPlanner";

const INTERNAL_SOURCE = "clickora_account" as const;
const PERIOD_DAYS = 30;

function periodWindow(): { from: Date; to: Date; days: number } {
  const to = new Date();
  const from = new Date(to.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  return { from, to, days: PERIOD_DAYS };
}

export type DemandSourceLabel =
  | "google_ads_keyword_planner"
  | "clickora_account"
  | "unavailable";

function googleConnectionPayload(user: GoogleAdsUserSettings) {
  const ready = isGoogleAdsMetricsReadyForUser(user);
  const block = getGoogleAdsReportingUnavailability(user);
  return {
    ready,
    source: ready ? ("google_ads_keyword_planner" as const) : ("unavailable" as const),
    reason: ready ? null : block?.code ?? "google_ads_not_connected",
    message: ready
      ? "Volumes e CPC vêm do Planejador de palavras-chave (Google Ads API Keyword Ideas)."
      : block?.message ??
        "Ligue o Google Ads em Integrações para ver procura oficial do Planejador.",
  };
}

async function loadTopInternalOffers(userId: string, from: Date) {
  /** Raw SQL via systemPrisma — o cliente tenant bloqueia `$queryRaw` (TENANT_ISOLATION). */
  const [convRows, clickRows, pages] = await Promise.all([
    systemPrisma.$queryRaw<
      Array<{
        presell_id: string | null;
        sales: bigint;
        revenue: Prisma.Decimal | number | string;
      }>
    >(Prisma.sql`
      SELECT c.presell_id,
             COUNT(*)::bigint AS sales,
             COALESCE(SUM(c.amount), 0) AS revenue
      FROM conversions c
      WHERE c.user_id = ${userId}
        AND c.status = 'approved'
        AND c.created_at >= ${from}
        AND c.presell_id IS NOT NULL
      GROUP BY c.presell_id
      ORDER BY SUM(c.amount) DESC NULLS LAST, COUNT(*) DESC
      LIMIT 12
    `),
    systemPrisma.$queryRaw<Array<{ presell_id: string | null; clicks: bigint }>>(Prisma.sql`
      SELECT presell_page_id AS presell_id, COUNT(*)::bigint AS clicks
      FROM tracking_events
      WHERE user_id = ${userId}
        AND event_type::text = 'click'
        AND created_at >= ${from}
        AND presell_page_id IS NOT NULL
        AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
        AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        AND metadata->>'parent_rotator_click_id' IS NULL
      GROUP BY presell_page_id
    `),
    prisma.presellPage.findMany({
      where: { userId },
      select: { id: true, title: true, slug: true, status: true },
      take: 200,
    }),
  ]);

  const clicksByPresell = new Map<string, number>();
  for (const row of clickRows) {
    if (row.presell_id) clicksByPresell.set(row.presell_id, Number(row.clicks));
  }
  const pageById = new Map(pages.map((p) => [p.id, p]));

  return convRows
    .map((row) => {
      const id = row.presell_id;
      if (!id) return null;
      const page = pageById.get(id);
      if (!page) return null;
      const sales = Number(row.sales);
      const revenue = Math.round(Number(row.revenue) * 100) / 100;
      const clicks = clicksByPresell.get(id) ?? 0;
      return {
        presell_id: id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        clicks,
        approved_sales: sales,
        revenue,
        conversion_rate: clicks > 0 ? Math.round((sales / clicks) * 10000) / 100 : null,
        source: INTERNAL_SOURCE,
        source_label: "Clickora — a sua conta (últimos 30 dias)",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

async function loadRecentResearches(userId: string) {
  const rows = await prisma.keywordResearch.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      product: true,
      language: true,
      market: true,
      marketName: true,
      affiliatePlatform: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    product: r.product,
    language: r.language,
    market: r.market,
    market_name: r.marketName,
    affiliate_platform: r.affiliatePlatform,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    source: INTERNAL_SOURCE,
    source_label: "Clickora — pesquisas de palavras-chave guardadas",
  }));
}

export async function buildDemandRadarOverview(userId: string, user: GoogleAdsUserSettings) {
  const { from, to, days } = periodWindow();
  const [offers, researches] = await Promise.all([
    loadTopInternalOffers(userId, from),
    loadRecentResearches(userId),
  ]);

  return {
    period: {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    google_ads: googleConnectionPayload(user),
    internal_offers: offers,
    recent_researches: researches,
    honesty: {
      invents_metrics: false,
      notes: [
        "Volumes de pesquisa só aparecem com Google Ads ligado (Planejador / Keyword Ideas).",
        "Vendas, cliques e receita são só da sua conta Clickora no período indicado.",
        "Não há ranking mundial tipo AdScore/SimilarWeb — essas fontes não estão ligadas.",
      ],
    },
  };
}

export async function analyzeDemandRadar(input: {
  userId: string;
  user: GoogleAdsUserSettings;
  product: string;
  market: string;
  language: string;
  timeframe?: DemandPlannerTimeframe;
}) {
  const product = input.product.trim().slice(0, 200);
  const market = input.market.trim().toUpperCase().slice(0, 8) || "US";
  const language = input.language.trim().slice(0, 16) || "en";
  const timeframe: DemandPlannerTimeframe = input.timeframe ?? "default";
  const { from, to, days } = periodWindow();

  const [planner, researches, offers] = await Promise.all([
    fetchUserKeywordPlannerIdeas({
      user: input.user,
      seed: product,
      countryCode: market,
      languageCode: language,
      timeframe,
      limit: 20,
    }),
    loadRecentResearches(input.userId),
    loadTopInternalOffers(input.userId, from),
  ]);

  const matching_researches = researches.filter((r) => demandTextMatches(r.product, product));
  const matching_offers = offers.filter((o) => demandTextMatches(o.title, product));

  return {
    query: { product, market, language, timeframe },
    period: { days, from: from.toISOString(), to: to.toISOString() },
    google_ads: googleConnectionPayload(input.user),
    planner: {
      status: planner.status,
      source: planner.source,
      reason: planner.status === "unavailable" ? planner.reason : null,
      message: planner.status === "unavailable" ? planner.message : null,
      seed_match: planner.seed_match,
      primary: planner.primary,
      primary_kind: planner.primary_kind,
      ideas: planner.ideas,
      trend: planner.trend,
      source_label:
        planner.status === "ok"
          ? "Google Ads — Planejador de palavras-chave (Keyword Ideas)"
          : "Indisponível — sem inventar volume",
    },
    account: {
      source: INTERNAL_SOURCE,
      source_label: "Clickora — a sua conta (últimos 30 dias)",
      matching_offers,
      matching_researches,
    },
    next_steps: {
      keywords_path: `/palavras-chave?product=${encodeURIComponent(product)}&market=${encodeURIComponent(market)}&language=${encodeURIComponent(language)}`,
      presell_path: `/presells/nova`,
      google_ads_path: `/integracoes/google-ads`,
    },
    honesty: {
      invents_metrics: false,
      notes: [
        "Cada bloco indica a fonte. Sem fonte = métrica omitida.",
        "CPC e volume são da Google; desempenho de oferta é só da sua conta.",
      ],
    },
  };
}
