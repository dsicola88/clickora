import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { buildMediaBuyerAlerts, computePerf, type MediaBuyerAlert } from "./campaignPerf";
import { sumPersistedKeywordCosts, sumPersistedSpend } from "../modules/affiliateOps/costSync.service";

/** Fragmento SQL: valor de metadata é ID de rede real (não macro `{gclid}`). */
function sqlRealNetworkId(expr: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(
    NULLIF(TRIM(COALESCE(${expr}, '')), '') IS NOT NULL
    AND TRIM(COALESCE(${expr}, '')) !~ '^\\{[\\w.]+\\}$'
    AND TRIM(COALESCE(${expr}, '')) !~ '^\\{\\{[\\w.]+\\}\\}$'
    AND TRIM(COALESCE(${expr}, '')) !~* '^%7B[\\w.]+%7D$'
    AND TRIM(COALESCE(${expr}, '')) !~ '^\\$\\{[\\w.]+\\}$'
    AND TRIM(COALESCE(${expr}, '')) !~ '^\\[\\[\\w+\\]\\]$'
  )`;
}

/** Clique com GCLID/GBRAID/WBRAID/MSCLKID/FBCLID/TTCLID real → tráfego pago atribuível. */
export function sqlClickHasPaidNetworkId(alias: string): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`(
    ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'gclid'`)}
    OR ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'gbraid'`)}
    OR ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'wbraid'`)}
    OR ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'msclkid'`)}
    OR ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'fbclid'`)}
    OR ${sqlRealNetworkId(Prisma.sql`${a}.metadata->>'ttclid'`)}
  )`;
}

/** UTM/medium de ads sem ID real — alinhado a `hasPaidAdSourceSignals` (sem inventar «Pago»). */
export function sqlClickHasPaidAdSignals(alias: string): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`(
    ${sqlClickHasPaidNetworkId(alias)}
    OR LOWER(TRIM(COALESCE(${a}.medium, ${a}.metadata->>'medium', '')))
         ~ '^(cpc|ppc|paid|paidsearch|paid_social|cpm|cpa|display|retargeting)$'
    OR LOWER(TRIM(COALESCE(${a}.source, ${a}.metadata->>'utm_source', '')))
         ~ '(google|gclid|bing|microsoft|yahoo|facebook|meta|fbclid|tiktok|ttclid|pinterest|taboola|outbrain|kwai|twitter|cpc|ppc|paid|ads)'
  )`;
}

/** Normalização de utm_term (ignora macros não substituídas) — igual ao dashboard. */
export function sqlNormalizedUtmTerm(alias: string): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`
    COALESCE(
      NULLIF(
        CASE
          WHEN TRIM(COALESCE(${a}.metadata->>'utm_term', '')) ~ '^\\{[a-zA-Z0-9_.]+\\}$' THEN NULL
          WHEN TRIM(COALESCE(${a}.metadata->>'utm_term', '')) ~ '^\\{\\{[a-zA-Z0-9_.]+\\}\\}$' THEN NULL
          WHEN TRIM(COALESCE(${a}.metadata->>'utm_term', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$' THEN NULL
          ELSE TRIM(${a}.metadata->>'utm_term')
        END,
        ''
      ),
      '(sem keyword)'
    )
  `;
}

export type FunnelStageId = "impressions" | "clicks" | "checkouts" | "sales";

export type FunnelStage = {
  id: FunnelStageId;
  label: string;
  count: number;
  /** % face à etapa anterior (null na primeira). */
  rate_from_previous: number | null;
  /** % face ao topo do funil (impressões, ou cliques se impressões = 0). */
  rate_from_top: number | null;
};

export function buildFunnelStages(counts: {
  impressions: number;
  clicks: number;
  checkouts: number;
  sales: number;
}): FunnelStage[] {
  const impressions = Math.max(0, Math.floor(counts.impressions));
  const clicks = Math.max(0, Math.floor(counts.clicks));
  const checkouts = Math.max(0, Math.floor(counts.checkouts));
  const sales = Math.max(0, Math.floor(counts.sales));

  /** Topo do funil: primeira etapa com volume (senão null nas taxas). */
  const top = impressions > 0 ? impressions : clicks > 0 ? clicks : checkouts > 0 ? checkouts : sales;
  const seq: Array<{ id: FunnelStageId; label: string; count: number }> = [
    { id: "impressions", label: "Impressões", count: impressions },
    { id: "clicks", label: "Cliques", count: clicks },
    { id: "checkouts", label: "Checkouts", count: checkouts },
    { id: "sales", label: "Vendas aprovadas", count: sales },
  ];

  const pct = (num: number, den: number): number | null => {
    if (den <= 0) return null;
    return Math.round((num / den) * 10000) / 100;
  };

  return seq.map((s, i) => {
    const prev = i === 0 ? null : seq[i - 1]!.count;
    return {
      id: s.id,
      label: s.label,
      count: s.count,
      rate_from_previous: prev == null ? null : pct(s.count, prev),
      rate_from_top: top <= 0 ? null : pct(s.count, top),
    };
  });
}

export type ConversionFunnelResult = {
  period: { from: string; to: string; timezone: "UTC" };
  filter: { keyword: string | null };
  stages: FunnelStage[];
  series: Array<{
    date: string;
    impressions: number;
    clicks: number;
    checkouts: number;
    sales: number;
    paid_sales: number;
    paid_untracked_sales: number;
    organic_sales: number;
  }>;
  traffic: {
    paid_sales: number;
    paid_untracked_sales: number;
    organic_sales: number;
    paid_revenue: number;
    paid_untracked_revenue: number;
    organic_revenue: number;
    paid_pct: number | null;
    paid_untracked_pct: number | null;
    organic_pct: number | null;
  };
  roi: {
    spend: number | null;
    /**
     * `persisted` = custo sync do período (conta).
     * `keyword` = custo só da palavra-chave filtrada (nunca misturar com gasto da conta).
     * `none` = sem custo fiável no âmbito.
     */
    spend_source: "persisted" | "keyword" | "none";
    spend_currency: string | null;
    revenue: number;
    profit: number | null;
    /** Lucro / custo em %; null sem custo do período. */
    roi_pct: number | null;
    roas: number | null;
    cpa: number | null;
    epc: number | null;
    conversion_rate: number;
  };
  alerts: MediaBuyerAlert[];
  keywords: Array<{
    keyword: string;
    clicks: number;
    checkouts: number;
    sales: number;
    revenue: number;
    cost: number | null;
    profit: number | null;
    roas: number | null;
    roi_pct: number | null;
    epc: number | null;
    cvr: number | null;
  }>;
  definitions: {
    impressions: string;
    clicks: string;
    checkouts: string;
    sales: string;
    paid: string;
    paid_untracked: string;
    organic: string;
    kpi_noise: string;
  };
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dia UTC YYYY-MM-DD — evita desvio de fuso em `Date` vinda de `::date` do Postgres. */
export function dayKey(day: Date | string): string {
  if (typeof day === "string") {
    const m = day.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1]!;
  }
  if (day instanceof Date && !Number.isNaN(day.getTime())) {
    const y = day.getUTCFullYear();
    const mo = String(day.getUTCMonth() + 1).padStart(2, "0");
    const da = String(day.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return String(day).slice(0, 10);
}

/** Invariantes do funil — falha cedo se SQL/agregação desalinharem. */
export function assertFunnelInvariants(result: ConversionFunnelResult): void {
  const sales = result.stages.find((s) => s.id === "sales")?.count ?? -1;
  const impressions = result.stages.find((s) => s.id === "impressions")?.count ?? -1;
  const clicks = result.stages.find((s) => s.id === "clicks")?.count ?? -1;
  const checkouts = result.stages.find((s) => s.id === "checkouts")?.count ?? -1;

  const trafficSales =
    result.traffic.paid_sales + result.traffic.paid_untracked_sales + result.traffic.organic_sales;
  if (sales !== trafficSales) {
    throw new Error(`funnel_invariant: sales=${sales} != traffic_sum=${trafficSales}`);
  }

  const revSum =
    Math.round(
      (result.traffic.paid_revenue +
        result.traffic.paid_untracked_revenue +
        result.traffic.organic_revenue) *
        100,
    ) / 100;
  if (Math.abs(revSum - result.roi.revenue) > 0.02) {
    throw new Error(`funnel_invariant: revenue=${result.roi.revenue} != traffic_rev=${revSum}`);
  }

  const seriesImp = result.series.reduce((n, r) => n + r.impressions, 0);
  const seriesClicks = result.series.reduce((n, r) => n + r.clicks, 0);
  const seriesCheckouts = result.series.reduce((n, r) => n + r.checkouts, 0);
  const seriesSales = result.series.reduce((n, r) => n + r.sales, 0);
  if (seriesImp !== impressions || seriesClicks !== clicks || seriesCheckouts !== checkouts || seriesSales !== sales) {
    throw new Error(
      `funnel_invariant: series totals mismatch stages (imp ${seriesImp}/${impressions} clk ${seriesClicks}/${clicks} chk ${seriesCheckouts}/${checkouts} sales ${seriesSales}/${sales})`,
    );
  }

  for (const row of result.series) {
    const sum = row.paid_sales + row.paid_untracked_sales + row.organic_sales;
    if (sum !== row.sales) {
      throw new Error(`funnel_invariant: series ${row.date} sales=${row.sales} != split=${sum}`);
    }
  }

  if (result.filter.keyword && result.roi.spend_source === "persisted") {
    throw new Error("funnel_invariant: keyword filter cannot use account-wide persisted spend");
  }
}

const KPI_CLEAN_ALIAS = (alias: string) => {
  const a = Prisma.raw(alias);
  return Prisma.sql`
    NOT COALESCE((${a}.metadata->>'is_bot') = 'true', false)
    AND NOT COALESCE((${a}.metadata->>'exclude_from_kpi') = 'true', false)
  `;
};

function keywordClickFilter(alias: string, keyword: string | null): Prisma.Sql {
  if (!keyword || keyword === "all" || keyword === "(sem keyword)") {
    if (keyword === "(sem keyword)") {
      return Prisma.sql`AND ${sqlNormalizedUtmTerm(alias)} = '(sem keyword)'`;
    }
    return Prisma.empty;
  }
  const kw = keyword.trim();
  if (!kw) return Prisma.empty;
  return Prisma.sql`AND LOWER(${sqlNormalizedUtmTerm(alias)}) = LOWER(${kw})`;
}

/**
 * Funil canónico: impressão → clique → checkout (funnel_step) → venda aprovada.
 * Mesmos filtros KPI que o dashboard (bots / exclude_from_kpi).
 */
export async function loadConversionFunnel(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  keyword?: string | null;
}): Promise<ConversionFunnelResult> {
  const { userId, rangeStart, rangeEnd } = args;
  const keywordRaw = args.keyword?.trim() || null;
  const keyword =
    keywordRaw && keywordRaw !== "all" ? keywordRaw.slice(0, 256) : null;

  const clickKw = keywordClickFilter("te", keyword);
  const leadKw =
    keyword == null
      ? Prisma.empty
      : Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM tracking_events clk
            WHERE clk.user_id = lead.user_id
              AND clk.id::text = NULLIF(TRIM(COALESCE(lead.metadata->>'attributed_click_id', '')), '')
              ${keywordClickFilter("clk", keyword)}
          )
        `;
  const saleKw =
    keyword == null
      ? Prisma.empty
      : Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM tracking_events te
            WHERE te.user_id = c.user_id
              AND te.id = c.click_id
              ${keywordClickFilter("te", keyword)}
          )
        `;

  const paidTe = sqlClickHasPaidNetworkId("te");
  const paidSignalsTe = sqlClickHasPaidAdSignals("te");

  const [
    stageRow,
    dayTrafficRows,
    dayCheckoutRows,
    daySaleRows,
    trafficRow,
    keywordClickRows,
    keywordCheckoutRows,
    persisted,
    keywordCosts,
  ] = await Promise.all([
    systemPrisma.$queryRaw<
      Array<{ impressions: bigint; clicks: bigint; checkouts: bigint; sales: bigint; revenue: unknown }>
    >(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM tracking_events te
          WHERE te.user_id = ${userId}
            AND te.created_at >= ${rangeStart}
            AND te.created_at <= ${rangeEnd}
            AND te.event_type::text = 'impression'
            AND ${KPI_CLEAN_ALIAS("te")}
            ${clickKw}
        ) AS impressions,
        (
          SELECT COUNT(*)::bigint
          FROM tracking_events te
          WHERE te.user_id = ${userId}
            AND te.created_at >= ${rangeStart}
            AND te.created_at <= ${rangeEnd}
            AND te.event_type::text = 'click'
            AND ${KPI_CLEAN_ALIAS("te")}
            ${clickKw}
        ) AS clicks,
        (
          SELECT COUNT(*)::bigint
          FROM tracking_events lead
          WHERE lead.user_id = ${userId}
            AND lead.created_at >= ${rangeStart}
            AND lead.created_at <= ${rangeEnd}
            AND lead.event_type::text = 'lead'
            AND lead.metadata->>'funnel_step' = 'checkout'
            AND ${KPI_CLEAN_ALIAS("lead")}
            ${leadKw}
        ) AS checkouts,
        (
          SELECT COUNT(*)::bigint
          FROM conversions c
          WHERE c.user_id = ${userId}
            AND c.created_at >= ${rangeStart}
            AND c.created_at <= ${rangeEnd}
            AND c.status = 'approved'
            ${saleKw}
        ) AS sales,
        (
          SELECT COALESCE(SUM(c.amount), 0)
          FROM conversions c
          WHERE c.user_id = ${userId}
            AND c.created_at >= ${rangeStart}
            AND c.created_at <= ${rangeEnd}
            AND c.status = 'approved'
            ${saleKw}
        ) AS revenue
    `),
    systemPrisma.$queryRaw<Array<{ day: Date; event_type: string; ct: bigint }>>(Prisma.sql`
      SELECT (te.created_at AT TIME ZONE 'UTC')::date AS day,
             te.event_type::text AS event_type,
             COUNT(*)::bigint AS ct
      FROM tracking_events te
      WHERE te.user_id = ${userId}
        AND te.created_at >= ${rangeStart}
        AND te.created_at <= ${rangeEnd}
        AND te.event_type::text IN ('click', 'impression')
        AND ${KPI_CLEAN_ALIAS("te")}
        ${clickKw}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `),
    systemPrisma.$queryRaw<Array<{ day: Date; ct: bigint }>>(Prisma.sql`
      SELECT (lead.created_at AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::bigint AS ct
      FROM tracking_events lead
      WHERE lead.user_id = ${userId}
        AND lead.created_at >= ${rangeStart}
        AND lead.created_at <= ${rangeEnd}
        AND lead.event_type::text = 'lead'
        AND lead.metadata->>'funnel_step' = 'checkout'
        AND ${KPI_CLEAN_ALIAS("lead")}
        ${leadKw}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    systemPrisma.$queryRaw<
      Array<{
        day: Date;
        paid_sales: bigint;
        paid_untracked_sales: bigint;
        organic_sales: bigint;
      }>
    >(Prisma.sql`
      SELECT (c.created_at AT TIME ZONE 'UTC')::date AS day,
             COUNT(*) FILTER (
               WHERE te.id IS NOT NULL AND ${paidTe}
             )::bigint AS paid_sales,
             COUNT(*) FILTER (
               WHERE te.id IS NOT NULL AND NOT (${paidTe}) AND ${paidSignalsTe}
             )::bigint AS paid_untracked_sales,
             COUNT(*) FILTER (
               WHERE te.id IS NULL OR (NOT (${paidTe}) AND NOT (${paidSignalsTe}))
             )::bigint AS organic_sales
      FROM conversions c
      LEFT JOIN tracking_events te
        ON te.id = c.click_id AND te.user_id = c.user_id
      WHERE c.user_id = ${userId}
        AND c.created_at >= ${rangeStart}
        AND c.created_at <= ${rangeEnd}
        AND c.status = 'approved'
        ${saleKw}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    systemPrisma.$queryRaw<
      Array<{
        paid_sales: bigint;
        paid_untracked_sales: bigint;
        organic_sales: bigint;
        paid_revenue: unknown;
        paid_untracked_revenue: unknown;
        organic_revenue: unknown;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE te.id IS NOT NULL AND ${paidTe})::bigint AS paid_sales,
        COUNT(*) FILTER (
          WHERE te.id IS NOT NULL AND NOT (${paidTe}) AND ${paidSignalsTe}
        )::bigint AS paid_untracked_sales,
        COUNT(*) FILTER (
          WHERE te.id IS NULL OR (NOT (${paidTe}) AND NOT (${paidSignalsTe}))
        )::bigint AS organic_sales,
        COALESCE(SUM(c.amount) FILTER (WHERE te.id IS NOT NULL AND ${paidTe}), 0) AS paid_revenue,
        COALESCE(SUM(c.amount) FILTER (
          WHERE te.id IS NOT NULL AND NOT (${paidTe}) AND ${paidSignalsTe}
        ), 0) AS paid_untracked_revenue,
        COALESCE(SUM(c.amount) FILTER (
          WHERE te.id IS NULL OR (NOT (${paidTe}) AND NOT (${paidSignalsTe}))
        ), 0) AS organic_revenue
      FROM conversions c
      LEFT JOIN tracking_events te
        ON te.id = c.click_id AND te.user_id = c.user_id
      WHERE c.user_id = ${userId}
        AND c.created_at >= ${rangeStart}
        AND c.created_at <= ${rangeEnd}
        AND c.status = 'approved'
        ${saleKw}
    `),
    systemPrisma.$queryRaw<
      Array<{ keyword: string; clicks: bigint; sales: bigint; revenue: unknown }>
    >(Prisma.sql`
      SELECT
        ${sqlNormalizedUtmTerm("te")} AS keyword,
        COUNT(*)::bigint AS clicks,
        COUNT(c.id)::bigint AS sales,
        COALESCE(SUM(c.amount), 0) AS revenue
      FROM tracking_events te
      LEFT JOIN conversions c
        ON c.click_id = te.id
       AND c.user_id = te.user_id
       AND c.status = 'approved'
      WHERE te.user_id = ${userId}
        AND te.created_at >= ${rangeStart}
        AND te.created_at <= ${rangeEnd}
        AND te.event_type::text = 'click'
        AND ${KPI_CLEAN_ALIAS("te")}
        ${clickKw}
      GROUP BY 1
      ORDER BY revenue DESC, sales DESC, clicks DESC
      LIMIT 50
    `),
    systemPrisma.$queryRaw<Array<{ keyword: string; checkouts: bigint }>>(Prisma.sql`
      SELECT
        ${sqlNormalizedUtmTerm("clk")} AS keyword,
        COUNT(*)::bigint AS checkouts
      FROM tracking_events lead
      INNER JOIN tracking_events clk
        ON clk.user_id = lead.user_id
       AND clk.id::text = NULLIF(TRIM(COALESCE(lead.metadata->>'attributed_click_id', '')), '')
      WHERE lead.user_id = ${userId}
        AND lead.created_at >= ${rangeStart}
        AND lead.created_at <= ${rangeEnd}
        AND lead.event_type::text = 'lead'
        AND lead.metadata->>'funnel_step' = 'checkout'
        AND ${KPI_CLEAN_ALIAS("lead")}
        AND ${KPI_CLEAN_ALIAS("clk")}
        ${keywordClickFilter("clk", keyword)}
      GROUP BY 1
    `),
    sumPersistedSpend({ userId, from: rangeStart, to: rangeEnd }).catch(() => ({
      total: 0,
      by_platform: {} as Record<string, number>,
    })),
    sumPersistedKeywordCosts({ userId, from: rangeStart, to: rangeEnd }).catch(
      () => new Map<string, number>(),
    ),
  ]);

  const s = stageRow[0];
  const impressions = Number(s?.impressions ?? 0);
  const clicks = Number(s?.clicks ?? 0);
  const checkouts = Number(s?.checkouts ?? 0);
  const sales = Number(s?.sales ?? 0);
  const revenue = Math.round(Number(s?.revenue ?? 0) * 100) / 100;

  const stages = buildFunnelStages({ impressions, clicks, checkouts, sales });

  const seriesMap = new Map<
    string,
    {
      impressions: number;
      clicks: number;
      checkouts: number;
      sales: number;
      paid_sales: number;
      paid_untracked_sales: number;
      organic_sales: number;
    }
  >();
  const ensure = (date: string) => {
    let row = seriesMap.get(date);
    if (!row) {
      row = {
        impressions: 0,
        clicks: 0,
        checkouts: 0,
        sales: 0,
        paid_sales: 0,
        paid_untracked_sales: 0,
        organic_sales: 0,
      };
      seriesMap.set(date, row);
    }
    return row;
  };

  for (const row of dayTrafficRows) {
    const d = dayKey(row.day);
    const cell = ensure(d);
    const n = Number(row.ct);
    if (row.event_type === "impression") cell.impressions = n;
    if (row.event_type === "click") cell.clicks = n;
  }
  for (const row of dayCheckoutRows) {
    ensure(dayKey(row.day)).checkouts = Number(row.ct);
  }
  for (const row of daySaleRows) {
    const cell = ensure(dayKey(row.day));
    cell.paid_sales = Number(row.paid_sales);
    cell.paid_untracked_sales = Number(row.paid_untracked_sales);
    cell.organic_sales = Number(row.organic_sales);
    cell.sales = cell.paid_sales + cell.paid_untracked_sales + cell.organic_sales;
  }

  const series = [...seriesMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const t = trafficRow[0];
  const paid_sales = Number(t?.paid_sales ?? 0);
  const paid_untracked_sales = Number(t?.paid_untracked_sales ?? 0);
  const organic_sales = Number(t?.organic_sales ?? 0);
  const paid_revenue = Math.round(Number(t?.paid_revenue ?? 0) * 100) / 100;
  const paid_untracked_revenue = Math.round(Number(t?.paid_untracked_revenue ?? 0) * 100) / 100;
  const organic_revenue = Math.round(Number(t?.organic_revenue ?? 0) * 100) / 100;
  const salesTotal = paid_sales + paid_untracked_sales + organic_sales;
  const share = (n: number) =>
    salesTotal > 0 ? Math.round((n / salesTotal) * 10000) / 100 : n > 0 ? 100 : null;

  /**
   * Custo no mesmo âmbito do filtro:
   * - sem keyword → custo sync da conta no período (como Resultados `persisted`)
   * - com keyword → só custo dessa keyword (nunca gasto da conta inteira)
   */
  let spend: number | null = null;
  let spend_source: "persisted" | "keyword" | "none" = "none";
  const spend_currency: string | null = "USD";
  if (keyword) {
    if (keyword !== "(sem keyword)") {
      const kwCost = keywordCosts.get(keyword.trim().toLowerCase());
      if (kwCost != null && kwCost > 0) {
        spend = Math.round(kwCost * 100) / 100;
        spend_source = "keyword";
      }
    }
  } else if (persisted.total > 0) {
    spend = Math.round(persisted.total * 100) / 100;
    spend_source = "persisted";
  }

  const perf = computePerf({
    clicks,
    conversions: sales,
    revenue,
    spend: spend_source === "none" ? null : spend,
  });
  const roi_pct =
    perf.profit != null && spend != null && spend > 0
      ? Math.round((perf.profit / spend) * 10000) / 100
      : null;

  const checkoutByKw = new Map(
    keywordCheckoutRows.map((r) => [r.keyword, Number(r.checkouts)]),
  );

  const keywords = keywordClickRows.map((row) => {
    const kw = row.keyword;
    const kClicks = Number(row.clicks);
    const kSales = Number(row.sales);
    const kRev = Math.round(Number(row.revenue ?? 0) * 100) / 100;
    const kCheckouts = checkoutByKw.get(kw) ?? 0;
    const cost =
      kw === "(sem keyword)" ? null : keywordCosts.get(kw.trim().toLowerCase()) ?? null;
    const costR = cost != null ? Math.round(cost * 100) / 100 : null;
    const profit = costR != null ? Math.round((kRev - costR) * 100) / 100 : null;
    const roas = costR != null && costR > 0 ? Math.round((kRev / costR) * 100) / 100 : null;
    const kwRoi =
      profit != null && costR != null && costR > 0
        ? Math.round((profit / costR) * 10000) / 100
        : null;
    return {
      keyword: kw,
      clicks: kClicks,
      checkouts: kCheckouts,
      sales: kSales,
      revenue: kRev,
      cost: costR,
      profit,
      roas,
      roi_pct: kwRoi,
      epc: kClicks > 0 ? Math.round((kRev / kClicks) * 10000) / 10000 : null,
      cvr: kClicks > 0 ? Math.round((kSales / kClicks) * 10000) / 100 : null,
    };
  });

  const alerts = buildMediaBuyerAlerts({
    clicks,
    conversions: sales,
    revenue,
    spend: spend_source === "none" ? null : spend,
    spendSource: spend_source === "keyword" ? "persisted" : spend_source,
    checkouts,
    paidSales: paid_sales,
    paidUntrackedSales: paid_untracked_sales,
    organicSales: organic_sales,
  });

  const result: ConversionFunnelResult = {
    period: { from: ymd(rangeStart), to: ymd(rangeEnd), timezone: "UTC" },
    filter: { keyword },
    stages,
    series,
    traffic: {
      paid_sales,
      paid_untracked_sales,
      organic_sales,
      paid_revenue,
      paid_untracked_revenue,
      organic_revenue,
      paid_pct: share(paid_sales),
      paid_untracked_pct: share(paid_untracked_sales),
      organic_pct: share(organic_sales),
    },
    roi: {
      spend,
      spend_source,
      spend_currency: spend != null ? spend_currency : null,
      revenue,
      profit: perf.profit,
      roi_pct,
      roas: perf.roas,
      cpa: perf.cpa,
      epc: perf.epc,
      conversion_rate: perf.conversion_rate,
    },
    alerts,
    keywords,
    definitions: {
      impressions: "Eventos impression no período, sem bots nem tráfego excluído dos KPIs.",
      clicks: "Eventos click no período (mesmos filtros KPI que Resultados).",
      checkouts: "Eventos lead com funnel_step=checkout (página de checkout / hoplink).",
      sales: "Conversões aprovadas por postback da rede — fonte de verdade de receita.",
      paid: "Venda ligada a clique com ID de rede real (gclid, gbraid, wbraid, msclkid, fbclid ou ttclid).",
      paid_untracked:
        "Sinais de ads (UTM/medium) sem ID de clique real — não conta como Pago atribuível.",
      organic: "Sem ID de rede nem sinais de ads no clique (ou venda sem clique atribuído).",
      kpi_noise: "Bots e IPs de relatório cloud (exclude_from_kpi) ficam fora destas contagens.",
    },
  };

  assertFunnelInvariants(result);
  return result;
}
