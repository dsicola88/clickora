/**
 * Centro de operações Google Ads (Paid) — métricas de conta, inventário e recomendações via API oficial.
 * Não inventa números: sem OAuth / sem developer token → erro explícito.
 */
import { fetchCustomerMeta, runGoogleAdsCustomerAction, runGoogleAdsSearch } from "./google-ads.api";
import { parseGoogleBudgetShareFromRow } from "./google-ads-budget";
import { computeClickCapture } from "./google-ads-click-capture";
import {
  deriveMetricRates,
  resolveGoogleAdsAccess,
  resolveGoogleAdsDateRange,
} from "./google-ads-connection";
import { detachStaleGoogleCampaignLinks } from "./google-ads-detach-stale";
import { aggregateTrackingMetricsForCampaign } from "./optimizer/tracking-metrics";
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
  const linked = local.filter((c) => Boolean(c.externalCampaignId?.replace(/\D/g, "")));
  const draftsOnly = local.filter((c) => !c.externalCampaignId?.replace(/\D/g, ""));
  const counts = {
    connected_accounts: 0,
    /** Contagens locais do projecto — não confundir com inventário remoto. */
    campaigns_total: local.length,
    campaigns_linked: linked.length,
    campaigns_local_drafts: draftsOnly.length,
    campaigns_live: linked.filter((c) => c.status === "live").length,
    campaigns_paused: linked.filter((c) => c.status === "paused").length,
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

  const meta = await fetchCustomerMeta(ctx.access, ctx.customerId, ctx.loginCustomerId);
  if (meta?.manager) {
    return {
      ok: true as const,
      connected: true,
      range,
      counts,
      metrics: null,
      source: "local_only" as const,
      inventory_scope: "local_drafts" as const,
      connection_error:
        "A conta ligada é MCC (gestor). Em Integrações → Google escolha a conta cliente onde estão os anúncios — não a conta gestor.",
      connection_error_code: "manager_account",
      account: {
        customer_id: ctx.customerId,
        account_name: meta.name ?? ctx.accountName,
      },
    };
  }

  const qCustomer = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
  `;
  let s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, qCustomer, ctx.loginCustomerId);

  /** Fallback: algumas contas rejeitam métricas ao nível customer — agregar por campanha. */
  if (s.error) {
    const qCampaign = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
        AND campaign.status != 'REMOVED'
    `;
    const retry = await runGoogleAdsSearch(
      ctx.access,
      ctx.customerId,
      ctx.dev,
      qCampaign,
      ctx.loginCustomerId,
    );
    if (!retry.error) s = retry;
  }

  if (s.error) {
    return {
      ok: true as const,
      connected: true,
      range,
      counts,
      metrics: null,
      source: "local_only" as const,
      inventory_scope: "local_drafts" as const,
      connection_error: s.error.message ?? "Falha ao ler métricas da conta Google Ads.",
      account: {
        customer_id: ctx.customerId,
        account_name: meta?.name ?? ctx.accountName,
      },
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
    /** Métricas de conta são reais; inventário de campanhas só se houver IDs importados. */
    inventory_scope: linked.length > 0 ? ("google_network" as const) : ("local_drafts" as const),
    account: {
      customer_id: ctx.customerId,
      account_name: meta?.name ?? ctx.accountName,
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
  const budgetByExternal = new Map<
    string,
    { explicitly_shared: boolean; reference_count: number; budget_editable: boolean; amount_micros: number | null }
  >();
  let networkError: string | null = null;

  if (ctx.ok) {
    const ids = local
      .map((c) => c.externalCampaignId?.replace(/\D/g, ""))
      .filter((id): id is string => Boolean(id));

    /** Sem IDs importados ainda — sonda a conta para não fingir «rede OK» com só rascunhos. */
    if (ids.length === 0) {
      const probe = await runGoogleAdsSearch(
        ctx.access,
        ctx.customerId,
        ctx.dev,
        "SELECT campaign.id FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 1",
        ctx.loginCustomerId,
      );
      if (probe.error) {
        networkError = probe.error.message ?? "Falha ao ler a conta Google Ads.";
      }
    } else {
      /** Confirma quais IDs ainda existem nesta conta — órfãos voltam a rascunho local. */
      const existQ = `
        SELECT campaign.id
        FROM campaign
        WHERE campaign.id IN (${ids.join(",")})
          AND campaign.status != 'REMOVED'
      `;
      const existS = await runGoogleAdsSearch(
        ctx.access,
        ctx.customerId,
        ctx.dev,
        existQ,
        ctx.loginCustomerId,
      );
      if (existS.error) {
        networkError = existS.error.message ?? "Falha ao validar campanhas na Google.";
      } else {
        const alive = new Set<string>();
        for (const raw of Array.isArray(existS.results) ? existS.results : []) {
          const row = raw as { campaign?: { id?: string } };
          const id = String(row.campaign?.id ?? "").replace(/\D/g, "");
          if (id) alive.add(id);
        }
        if (alive.size < ids.length) {
          await detachStaleGoogleCampaignLinks(projectId, { keepExternalIds: alive });
        }
        const liveIds = ids.filter((id) => alive.has(id));
        if (liveIds.length === 0) {
          /* só rascunhos após detach — já tratado pelo probe no próximo load */
        } else {
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
            WHERE campaign.id IN (${liveIds.join(",")})
              AND segments.date BETWEEN '${range.from}' AND '${range.to}'
          `;
          const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
          if (s.error) {
            networkError = s.error.message ?? "Falha ao ler métricas das campanhas.";
          }
          for (const raw of !s.error && Array.isArray(s.results) ? s.results : []) {
            const row = raw as Record<string, unknown>;
            const camp = row.campaign as { id?: string } | undefined;
            const id = String(camp?.id ?? "").replace(/\D/g, "");
            if (!id) continue;
            const prev =
              byExternal.get(id) ??
              deriveMetricRates({ impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 });
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

          const bq = `
            SELECT
              campaign.id,
              campaign_budget.amount_micros,
              campaign_budget.explicitly_shared,
              campaign_budget.reference_count
            FROM campaign
            WHERE campaign.id IN (${liveIds.join(",")})
          `;
          const bs = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, bq, ctx.loginCustomerId);
          if (!bs.error) {
            for (const raw of Array.isArray(bs.results) ? bs.results : []) {
              const row = raw as Record<string, unknown>;
              const camp = row.campaign as { id?: string } | undefined;
              const id = String(camp?.id ?? "").replace(/\D/g, "");
              if (!id) continue;
              const share = parseGoogleBudgetShareFromRow(row);
              budgetByExternal.set(id, {
                explicitly_shared: share.explicitly_shared,
                reference_count: share.reference_count,
                budget_editable: share.budget_editable,
                amount_micros: share.amount_micros,
              });
            }
          }
        }
      }
    }
  }

  /** Re-ler após possível detach de IDs que já não existem na conta Google. */
  const localRows = ctx.ok
    ? await prisma.paidAdsCampaign.findMany({
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
      })
    : local;

  const project = await prisma.paidAdsProject.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  const since = new Date(`${range.from}T00:00:00.000Z`);
  const trackingByCampaign = new Map<string, number>();
  if (project?.userId && Number.isFinite(since.getTime())) {
    const targets = localRows.slice(0, 60);
    const settled = await Promise.all(
      targets.map(async (c) => {
        try {
          const t = await aggregateTrackingMetricsForCampaign({
            userId: project.userId,
            campaignId: c.id,
            since,
          });
          return [c.id, t.clicks] as const;
        } catch {
          return [c.id, 0] as const;
        }
      }),
    );
    for (const [id, clicks] of settled) trackingByCampaign.set(id, clicks);
  }

  const campaigns = localRows.map((c) => {
    const ext = c.externalCampaignId?.replace(/\D/g, "") ?? null;
    const metrics = ext ? byExternal.get(ext) ?? null : null;
    const budgetMeta = ext ? budgetByExternal.get(ext) : undefined;
    const bidding = (c.biddingConfig ?? {}) as { google?: { strategy?: string } };
    const localBudget = c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null;
    const capture = computeClickCapture(metrics?.clicks ?? null, trackingByCampaign.get(c.id) ?? 0);
    return {
      id: c.id,
      name: c.name,
      local_status: c.status,
      external_campaign_id: ext,
      inventory_origin: ext ? ("google" as const) : ("local_draft" as const),
      daily_budget_micros: budgetMeta?.amount_micros ?? localBudget,
      bidding_strategy: bidding.google?.strategy ?? null,
      created_at: c.createdAt.toISOString(),
      metrics,
      metrics_available: Boolean(ext && ctx.ok && !networkError),
      budget_shared: budgetMeta?.explicitly_shared ?? false,
      budget_reference_count: budgetMeta?.reference_count ?? 1,
      budget_editable: budgetMeta ? budgetMeta.budget_editable : false,
      tracking_clicks: capture.tracking_clicks,
      google_clicks: capture.google_clicks,
      click_delta: capture.click_delta,
      click_capture_ratio: capture.click_capture_ratio,
      funnel_risk: capture.funnel_risk,
    };
  });

  const funnelRiskCount = campaigns.filter((c) => c.funnel_risk).length;
  const linkedCount = campaigns.filter((c) => c.external_campaign_id).length;
  const networkOk = ctx.ok && !networkError;
  const inventoryScope =
    !networkOk || linkedCount === 0 ? ("local_drafts" as const) : ("google_network" as const);

  return {
    ok: true as const,
    connected: ctx.ok,
    connection_error: ctx.ok ? networkError : ctx.error,
    connection_error_code: ctx.ok ? (networkError ? "gaql_error" : null) : ctx.code,
    account: ctx.ok
      ? { customer_id: ctx.customerId, account_name: ctx.accountName }
      : null,
    range,
    campaigns,
    totals: {
      funnel_risk: funnelRiskCount,
      with_google_clicks: campaigns.filter((c) => (c.google_clicks ?? 0) > 0).length,
      linked_to_google: linkedCount,
      local_drafts: campaigns.filter((c) => !c.external_campaign_id).length,
    },
    source: networkOk ? ("google_ads_api" as const) : ("local_only" as const),
    inventory_scope: inventoryScope,
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
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
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
      ctx.loginCustomerId,
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
    ctx.loginCustomerId,
  );
  if (!out.ok) return { ok: false as const, error: out.error, code: "apply_failed" };
  return { ok: true as const, action: "apply" as const };
}

function accumulateDeviceMetrics(
  map: Map<string, ReturnType<typeof deriveMetricRates>>,
  device: string,
  cur: ReturnType<typeof deriveMetricRates>,
) {
  const prev = map.get(device);
  map.set(
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

export async function fetchGoogleAdsDevicePerformance(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
  opts?: { campaign_id?: string },
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const local = await prisma.paidAdsCampaign.findMany({
    where: {
      projectId,
      platform: "google_ads",
      status: { not: "archived" },
      externalCampaignId: { not: null },
      ...(opts?.campaign_id ? { id: opts.campaign_id } : {}),
    },
    select: { id: true, name: true, externalCampaignId: true },
    take: 80,
  });
  const byExt = new Map(
    local
      .map((c) => {
        const ext = (c.externalCampaignId ?? "").replace(/\D/g, "");
        return ext ? ([ext, c] as const) : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
  );

  // Conta (rollup) — útil para vista rápida; se filtrar campanha, o rollup vem do breakdown.
  const byDevice = new Map<string, ReturnType<typeof deriveMetricRates>>();
  if (!opts?.campaign_id) {
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
    const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
    if (s.error) {
      return {
        ok: false as const,
        error: s.error.message ?? "Falha ao ler desempenho por dispositivo.",
        code: "gaql_error",
      };
    }
    for (const raw of Array.isArray(s.results) ? s.results : []) {
      const row = raw as Record<string, unknown>;
      const device = String((row.segments as { device?: string } | undefined)?.device ?? "UNKNOWN");
      const met = (row.metrics ?? {}) as Record<string, unknown>;
      accumulateDeviceMetrics(
        byDevice,
        device,
        deriveMetricRates({
          impressions: num(met.impressions),
          clicks: num(met.clicks),
          cost_micros: num(met.cost_micros),
          conversions: num(met.conversions),
          conversions_value: num(met.conversions_value),
        }),
      );
    }
  }

  const byCampaign: Array<{
    campaign_id: string;
    campaign_name: string;
    external_campaign_id: string;
    device: string;
    metrics: ReturnType<typeof deriveMetricRates>;
  }> = [];

  if (byExt.size > 0) {
    const ids = [...byExt.keys()];
    const cq = `
      SELECT
        campaign.id,
        campaign.name,
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE campaign.id IN (${ids.join(",")})
        AND segments.date BETWEEN '${range.from}' AND '${range.to}'
    `;
    const cs = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, cq, ctx.loginCustomerId);
    if (cs.error) {
      return {
        ok: false as const,
        error: cs.error.message ?? "Falha ao ler dispositivo por campanha.",
        code: "gaql_error",
      };
    }

    type AggKey = string;
    const agg = new Map<
      AggKey,
      {
        campaign_id: string;
        campaign_name: string;
        external_campaign_id: string;
        device: string;
        metrics: ReturnType<typeof deriveMetricRates>;
      }
    >();

    for (const raw of Array.isArray(cs.results) ? cs.results : []) {
      const row = raw as Record<string, unknown>;
      const camp = (row.campaign ?? {}) as { id?: string; name?: string };
      const ext = String(camp.id ?? "").replace(/\D/g, "");
      const localCamp = byExt.get(ext);
      if (!localCamp) continue;
      const device = String((row.segments as { device?: string } | undefined)?.device ?? "UNKNOWN");
      const met = (row.metrics ?? {}) as Record<string, unknown>;
      const cur = deriveMetricRates({
        impressions: num(met.impressions),
        clicks: num(met.clicks),
        cost_micros: num(met.cost_micros),
        conversions: num(met.conversions),
        conversions_value: num(met.conversions_value),
      });
      const key = `${localCamp.id}::${device}`;
      const prev = agg.get(key);
      if (prev) {
        prev.metrics = deriveMetricRates({
          impressions: prev.metrics.impressions + cur.impressions,
          clicks: prev.metrics.clicks + cur.clicks,
          cost_micros: prev.metrics.cost_micros + cur.cost_micros,
          conversions: prev.metrics.conversions + cur.conversions,
          conversions_value: prev.metrics.conversions_value + cur.conversions_value,
        });
      } else {
        agg.set(key, {
          campaign_id: localCamp.id,
          campaign_name: localCamp.name || String(camp.name ?? ""),
          external_campaign_id: ext,
          device,
          metrics: cur,
        });
      }
      if (opts?.campaign_id) {
        accumulateDeviceMetrics(byDevice, device, cur);
      }
    }

    byCampaign.push(
      ...[...agg.values()].sort(
        (a, b) => b.metrics.cost_micros - a.metrics.cost_micros || a.campaign_name.localeCompare(b.campaign_name),
      ),
    );
  }

  const devices = [...byDevice.entries()]
    .map(([device, metrics]) => ({ device, metrics }))
    .sort((a, b) => b.metrics.cost_micros - a.metrics.cost_micros);

  return {
    ok: true as const,
    range,
    devices,
    by_campaign: byCampaign,
    filter_campaign_id: opts?.campaign_id ?? null,
    campaigns_scoped: byExt.size,
    source: "google_ads_api" as const,
  };
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
