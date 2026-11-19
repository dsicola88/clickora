/**
 * Centro de operações Google Ads (Paid) — métricas de conta, inventário e recomendações via API oficial.
 * Não inventa números: sem OAuth / sem developer token → erro explícito.
 */
import { runGoogleAdsCustomerAction, runGoogleAdsSearch } from "./google-ads.api";
import {
  deriveMetricRates,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  resolveGoogleAdsAccess,
  resolveGoogleAdsDateRange,
} from "./google-ads-connection";
import { prisma } from "./paidPrisma";

/** Tipos em que `recommendations:apply` sem parâmetros extra costuma funcionar. */
const APPLYABLE_RECOMMENDATION_TYPES = new Set([
  "CAMPAIGN_BUDGET",
  "KEYWORD",
  "TEXT_AD",
  "MAXIMIZE_CONVERSIONS_OPT_IN",
  "MAXIMIZE_CONVERSION_VALUE_OPT_IN",
  "TARGET_CPA_OPT_IN",
  "TARGET_ROAS_OPT_IN",
  "ENHANCED_CPC_OPT_IN",
  "SEARCH_PARTNERS_OPT_IN",
  "MOVE_UNUSED_BUDGET",
  "FORECASTING_CAMPAIGN_BUDGET",
  "RESPONSIVE_SEARCH_AD",
  "RESPONSIVE_SEARCH_AD_IMPROVE_AD_STRENGTH",
  "RAISE_TARGET_CPA_BID_TOO_LOW",
  "LOWER_TARGET_ROAS",
  "IMPROVE_GOOGLE_TAG_COVERAGE",
]);

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseMetrics(row: Record<string, unknown>) {
  const met = (row.metrics ?? {}) as Record<string, unknown>;
  return deriveMetricRates({
    impressions: num(met.impressions),
    clicks: num(met.clicks),
    cost_micros: num(met.cost_micros),
    conversions: num(met.conversions),
    conversions_value: num(met.conversions_value),
  });
}

export async function fetchGoogleAdsAccountOverview(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads", status: { not: "archived" } },
    select: { id: true, status: true, externalCampaignId: true, name: true, dailyBudgetMicros: true },
  });
  const counts = {
    connected_accounts: 0,
    campaigns_total: local.length,
    campaigns_live: local.filter((c) => c.status === "live").length,
    campaigns_paused: local.filter((c) => c.status === "paused").length,
    campaigns_draft: local.filter((c) => c.status === "draft" || c.status === "pending_publish").length,
    campaigns_error: local.filter((c) => c.status === "error").length,
  };

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) {
    return {
      ok: true as const,
      connected: false,
      range,
      counts: { ...counts, connected_accounts: 0 },
      metrics: null,
      source: "local_only" as const,
      connection_error: ctx.error,
      connection_error_code: ctx.code,
    };
  }
  counts.connected_accounts = 1;

  const q = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (s.error) {
    return {
      ok: false as const,
      error: s.error.message ?? "Falha ao ler métricas da conta Google Ads.",
      code: "gaql_error",
    };
  }
  const list = Array.isArray(s.results) ? s.results : [];
  let impressions = 0;
  let clicks = 0;
  let cost_micros = 0;
  let conversions = 0;
  let conversions_value = 0;
  for (const raw of list) {
    const m = parseMetrics(raw as Record<string, unknown>);
    impressions += m.impressions;
    clicks += m.clicks;
    cost_micros += m.cost_micros;
    conversions += m.conversions;
    conversions_value += m.conversions_value;
  }
  const metrics = deriveMetricRates({
    impressions,
    clicks,
    cost_micros,
    conversions,
    conversions_value,
  });

  return {
    ok: true as const,
    connected: true,
    range,
    counts,
    metrics,
    source: "google_ads_api" as const,
    account: {
      customer_id: ctx.customerId,
      account_name: ctx.accountName,
    },
  };
}

export async function fetchGoogleAdsCampaignsMetrics(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads" },
    select: {
      id: true,
      name: true,
      status: true,
      externalCampaignId: true,
      dailyBudgetMicros: true,
      biddingConfig: true,
      createdAt: true,
      geoTargets: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const ctx = await resolveGoogleAdsAccess(projectId);
  const byExternal = new Map<string, ReturnType<typeof deriveMetricRates>>();

  if (ctx.ok) {
    const ids = local
      .map((c) => c.externalCampaignId?.replace(/\D/g, ""))
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const q = `
        SELECT
          campaign.id,
          campaign.status,
          campaign.advertising_channel_type,
          campaign_budget.amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE campaign.id IN (${ids.join(",")})
          AND segments.date BETWEEN '${range.from}' AND '${range.to}'
      `;
      const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
      if (s.error) {
        return { ok: false as const, error: s.error.message ?? "Falha ao ler métricas das campanhas.", code: "gaql_error" };
      }
      for (const raw of Array.isArray(s.results) ? s.results : []) {
        const row = raw as Record<string, unknown>;
        const camp = row.campaign as { id?: string } | undefined;
        const id = String(camp?.id ?? "").replace(/\D/g, "");
        if (!id) continue;
        const prev = byExternal.get(id) ?? deriveMetricRates({ impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 });
        const cur = parseMetrics(row);
        byExternal.set(
          id,
          deriveMetricRates({
            impressions: prev.impressions + cur.impressions,
            clicks: prev.clicks + cur.clicks,
            cost_micros: prev.cost_micros + cur.cost_micros,
            conversions: prev.conversions + cur.conversions,
            conversions_value: prev.conversions_value + cur.conversions_value,
          }),
        );
      }
    }
  }

  const campaigns = local.map((c) => {
    const ext = c.externalCampaignId?.replace(/\D/g, "") ?? null;
    const metrics = ext ? byExternal.get(ext) ?? null : null;
    const bidding = (c.biddingConfig ?? {}) as { google?: { strategy?: string } };
    return {
      id: c.id,
      name: c.name,
      local_status: c.status,
      external_campaign_id: ext,
      daily_budget_micros: c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null,
      bidding_strategy: bidding.google?.strategy ?? null,
      created_at: c.createdAt.toISOString(),
      metrics,
      metrics_available: Boolean(ext && ctx.ok),
    };
  });

  return {
    ok: true as const,
    connected: ctx.ok,
    connection_error: ctx.ok ? null : ctx.error,
    range,
    campaigns,
    source: ctx.ok ? ("google_ads_api" as const) : ("local_only" as const),
  };
}

export async function fetchGoogleAdsProjectInventory(projectId: string) {
  const campaigns = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads", status: { not: "archived" } },
    include: {
      adGroups: {
        include: {
          keywords: true,
          adsRsa: true,
          negativeKeywords: true,
        },
      },
      campaignNegativeKeywords: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const ad_groups = campaigns.flatMap((c) =>
    c.adGroups.map((ag) => ({
      id: ag.id,
      campaign_id: c.id,
      campaign_name: c.name,
      name: ag.name,
      status: ag.status,
      external_ad_group_id: ag.externalAdGroupId,
      cpc_bid_micros: ag.cpcBidMicros != null ? Number(ag.cpcBidMicros) : null,
      keywords_count: ag.keywords.length,
      ads_count: ag.adsRsa.length,
    })),
  );

  const keywords = campaigns.flatMap((c) =>
    c.adGroups.flatMap((ag) =>
      ag.keywords.map((k) => ({
        id: k.id,
        campaign_id: c.id,
        campaign_name: c.name,
        ad_group_id: ag.id,
        ad_group_name: ag.name,
        text: k.text,
        match_type: k.matchType,
        status: k.status,
        external_criterion_id: k.externalCriterionId,
      })),
    ),
  );

  const ads = campaigns.flatMap((c) =>
    c.adGroups.flatMap((ag) =>
      ag.adsRsa.map((ad) => ({
        id: ad.id,
        campaign_id: c.id,
        campaign_name: c.name,
        ad_group_id: ag.id,
        ad_group_name: ag.name,
        status: ad.status,
        headlines: ad.headlines,
        descriptions: ad.descriptions,
        final_urls: ad.finalUrls,
        display_path_1: ad.displayPath1,
        display_path_2: ad.displayPath2,
        external_ad_id: ad.externalAdId,
      })),
    ),
  );

  const budgets = campaigns.map((c) => ({
    campaign_id: c.id,
    campaign_name: c.name,
    local_status: c.status,
    external_campaign_id: c.externalCampaignId,
    daily_budget_micros: c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null,
  }));

  const negative_keywords = {
    campaign_level: campaigns.flatMap((c) =>
      c.campaignNegativeKeywords.map((n) => ({
        id: n.id,
        campaign_id: c.id,
        campaign_name: c.name,
        text: n.text,
        match_type: n.matchType,
      })),
    ),
    ad_group_level: campaigns.flatMap((c) =>
      c.adGroups.flatMap((ag) =>
        ag.negativeKeywords.map((n) => ({
          id: n.id,
          campaign_id: c.id,
          campaign_name: c.name,
          ad_group_id: ag.id,
          ad_group_name: ag.name,
          text: n.text,
          match_type: n.matchType,
        })),
      ),
    ),
  };

  return {
    ok: true as const,
    ad_groups,
    keywords,
    ads,
    budgets,
    negative_keywords,
    totals: {
      campaigns: campaigns.length,
      ad_groups: ad_groups.length,
      keywords: keywords.length,
      ads: ads.length,
    },
  };
}

export async function fetchGoogleAdsRecommendations(projectId: string) {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) {
    return { ok: false as const, error: ctx.error, code: ctx.code };
  }

  const q = `
    SELECT
      recommendation.resource_name,
      recommendation.type,
      recommendation.campaign,
      recommendation.impact
    FROM recommendation
    WHERE recommendation.dismissed = FALSE
    LIMIT 100
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (s.error) {
    return {
      ok: false as const,
      error: s.error.message ?? "Não foi possível consultar recomendações Google Ads.",
      code: "gaql_error",
    };
  }

  const recommendations = (Array.isArray(s.results) ? s.results : []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const rec = (row.recommendation ?? {}) as {
      resourceName?: string;
      type?: string;
      campaign?: string;
      impact?: { baseMetrics?: Record<string, unknown>; potentialMetrics?: Record<string, unknown> };
    };
    const type = rec.type ?? "UNKNOWN";
    const apply_supported = Boolean(rec.resourceName) && APPLYABLE_RECOMMENDATION_TYPES.has(type);
    return {
      resource_name: rec.resourceName ?? null,
      type,
      campaign_resource: rec.campaign ?? null,
      impact: rec.impact ?? null,
      apply_supported,
      dismiss_supported: Boolean(rec.resourceName),
      note: apply_supported
        ? "Pode aplicar ou rejeitar aqui com confirmação explícita."
        : "Pode rejeitar (dismiss) aqui. Aplicar este tipo ainda requer a consola Google ou parâmetros avançados.",
    };
  });

  return {
    ok: true as const,
    customer_id: ctx.customerId,
    recommendations,
    apply_policy: "manual_confirmation_required" as const,
  };
}

export async function applyOrDismissGoogleRecommendation(
  projectId: string,
  opts: { resource_name: string; action: "apply" | "dismiss" },
) {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const rn = opts.resource_name.trim();
  if (!rn.includes("/recommendations/")) {
    return { ok: false as const, error: "resource_name de recomendação inválido.", code: "invalid_resource" };
  }

  if (opts.action === "dismiss") {
    const out = await runGoogleAdsCustomerAction(
      ctx.access,
      ctx.customerId,
      ctx.dev,
      "recommendations:dismiss",
      { operations: [{ resourceName: rn }] },
      GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    );
    if (!out.ok) return { ok: false as const, error: out.error, code: "dismiss_failed" };
    return { ok: true as const, action: "dismiss" as const };
  }

  const out = await runGoogleAdsCustomerAction(
    ctx.access,
    ctx.customerId,
    ctx.dev,
    "recommendations:apply",
    { operations: [{ resourceName: rn }] },
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  );
  if (!out.ok) return { ok: false as const, error: out.error, code: "apply_failed" };
  return { ok: true as const, action: "apply" as const };
}

export async function fetchGoogleAdsDevicePerformance(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const q = `
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (s.error) {
    return { ok: false as const, error: s.error.message ?? "Falha ao ler desempenho por dispositivo.", code: "gaql_error" };
  }

  const byDevice = new Map<string, ReturnType<typeof deriveMetricRates>>();
  for (const raw of Array.isArray(s.results) ? s.results : []) {
    const row = raw as Record<string, unknown>;
    const device = String((row.segments as { device?: string } | undefined)?.device ?? "UNKNOWN");
    const met = (row.metrics ?? {}) as Record<string, unknown>;
    const cur = deriveMetricRates({
      impressions: num(met.impressions),
      clicks: num(met.clicks),
      cost_micros: num(met.cost_micros),
      conversions: num(met.conversions),
      conversions_value: num(met.conversions_value),
    });
    const prev = byDevice.get(device);
    byDevice.set(
      device,
      prev
        ? deriveMetricRates({
            impressions: prev.impressions + cur.impressions,
            clicks: prev.clicks + cur.clicks,
            cost_micros: prev.cost_micros + cur.cost_micros,
            conversions: prev.conversions + cur.conversions,
            conversions_value: prev.conversions_value + cur.conversions_value,
          })
        : cur,
    );
  }

  const devices = [...byDevice.entries()].map(([device, metrics]) => ({ device, metrics }));
  return { ok: true as const, range, devices, source: "google_ads_api" as const };
}

export async function buildGoogleAdsAiInsights(
  projectId: string,
  question: string,
  preset = "last_7",
) {
  const metricsPack = await fetchGoogleAdsCampaignsMetrics(projectId, preset);
  if (!metricsPack.ok) {
    return { ok: false as const, error: metricsPack.error, code: metricsPack.code };
  }

  const withMetrics = metricsPack.campaigns.filter((c) => c.metrics);
  const sortedBySpend = [...withMetrics].sort(
    (a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0),
  );
  const sortedByConv = [...withMetrics].sort(
    (a, b) => (b.metrics?.conversions ?? 0) - (a.metrics?.conversions ?? 0),
  );
  const waste = withMetrics.filter(
    (c) => (c.metrics?.cost_micros ?? 0) >= 10_000_000 && (c.metrics?.conversions ?? 0) < 0.5,
  );
  const topRoas = [...withMetrics]
    .filter((c) => (c.metrics?.cost_micros ?? 0) > 0)
    .sort((a, b) => (b.metrics?.roas ?? 0) - (a.metrics?.roas ?? 0));

  const q = question.toLowerCase();
  const evidence: Array<{ label: string; detail: string; campaign_id?: string }> = [];
  const suggestions: Array<{
    action: string;
    risk: string;
    evidence: string;
    campaign_id?: string;
    suggested_op?: "pause_campaign" | "increase_budget_20";
    daily_budget_micros?: number | null;
  }> = [];

  if (q.includes("gast") || q.includes("spend") || q.includes("custo")) {
    for (const c of sortedBySpend.slice(0, 5)) {
      evidence.push({
        label: c.name,
        campaign_id: c.id,
        detail: `Custo ${(c.metrics!.cost_micros / 1_000_000).toFixed(2)} USD · ${c.metrics!.clicks} cliques · ${c.metrics!.conversions.toFixed(1)} conv.`,
      });
    }
  } else if (q.includes("convert") || q.includes("melhor")) {
    for (const c of sortedByConv.slice(0, 5)) {
      evidence.push({
        label: c.name,
        campaign_id: c.id,
        detail: `${c.metrics!.conversions.toFixed(1)} conversões · CPA ${(c.metrics!.cost_per_conversion_micros / 1_000_000).toFixed(2)} USD · ROAS ${c.metrics!.roas.toFixed(2)}`,
      });
    }
  } else if (q.includes("paus")) {
    for (const c of waste.slice(0, 5)) {
      evidence.push({
        label: c.name,
        campaign_id: c.id,
        detail: `Gastou ${(c.metrics!.cost_micros / 1_000_000).toFixed(2)} USD sem conversões relevantes.`,
      });
      suggestions.push({
        action: `Pausar «${c.name}» (requer confirmação)`,
        risk: "Pode cortar volume de testes em ofertas novas",
        evidence: "Gasto sem conversões no período",
        campaign_id: c.id,
        suggested_op: "pause_campaign",
        daily_budget_micros: c.daily_budget_micros,
      });
    }
  } else if (q.includes("orçamento") || q.includes("budget") || q.includes("aument")) {
    for (const c of topRoas.slice(0, 5)) {
      evidence.push({
        label: c.name,
        campaign_id: c.id,
        detail: `ROAS ${c.metrics!.roas.toFixed(2)} · custo ${(c.metrics!.cost_micros / 1_000_000).toFixed(2)} USD`,
      });
      if ((c.metrics?.roas ?? 0) >= 2 && c.daily_budget_micros != null) {
        suggestions.push({
          action: `Aumentar orçamento de «${c.name}» ~20% (requer confirmação)`,
          risk: "ROAS pode diluir com escala; confirme guardrails e orçamento partilhado",
          evidence: `ROAS ${c.metrics!.roas.toFixed(2)} no período`,
          campaign_id: c.id,
          suggested_op: "increase_budget_20",
          daily_budget_micros: c.daily_budget_micros,
        });
      }
    }
  } else {
    for (const c of sortedBySpend.slice(0, 5)) {
      evidence.push({
        label: c.name,
        campaign_id: c.id,
        detail: `Estado ${c.local_status} · custo ${(c.metrics?.cost_micros ?? 0) / 1_000_000} USD · conv. ${c.metrics?.conversions?.toFixed(1) ?? "—"}`,
      });
    }
  }

  if (waste.length > 0 && suggestions.length === 0) {
    for (const w of waste.slice(0, 3)) {
      suggestions.push({
        action: `Rever/pausar «${w.name}» (gasto sem conversões)`,
        risk: "Pausa prematura em funis novos",
        evidence: `Custo ${(w.metrics!.cost_micros / 1_000_000).toFixed(2)} USD`,
        campaign_id: w.id,
        suggested_op: "pause_campaign",
        daily_budget_micros: w.daily_budget_micros,
      });
    }
  }

  return {
    ok: true as const,
    question,
    range: metricsPack.range,
    source: metricsPack.source,
    diagnosis:
      withMetrics.length === 0
        ? "Sem métricas Google disponíveis neste período (campanhas sem ID externo ou conta não ligada)."
        : `Análise baseada em ${withMetrics.length} campanha(s) com dados reais da Google Ads API (${metricsPack.range.from} → ${metricsPack.range.to}).`,
    evidence,
    suggestions,
    executes_mutations: false,
    note: "A IA só sugere. Qualquer pausa/orçamento exige confirmação e passa por Copilot/Autopilot.",
  };
}
