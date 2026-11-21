/**
 * Campaign Manager TikTok — overview + métricas por campanha.
 */
import { resolveGoogleAdsDateRange, deriveMetricRates } from "./google-ads-connection";
import { prisma } from "./paidPrisma";
import { ensureTikTokAccessToken, tiktokApiGetWithTokenRetry } from "./tiktok-oauth.api";

function mapTiktokStatus(s: string | undefined): "live" | "paused" | "archived" {
  const u = (s ?? "").toUpperCase();
  if (u === "ENABLE" || u === "STATUS_ENABLE" || u === "ACTIVE") return "live";
  if (u === "DELETE" || u === "STATUS_DELETE") return "archived";
  return "paused";
}

export async function fetchTikTokAdsAccountOverview(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "tiktok_ads", status: { not: "archived" } },
    select: { id: true, status: true, externalCampaignId: true },
  });
  const linked = local.filter((c) => Boolean(c.externalCampaignId?.trim()));
  const counts = {
    connected_accounts: 0,
    campaigns_total: local.length,
    campaigns_linked: linked.length,
    campaigns_local_drafts: local.filter((c) => !c.externalCampaignId).length,
    campaigns_live: linked.filter((c) => c.status === "live").length,
    campaigns_paused: linked.filter((c) => c.status === "paused").length,
    campaigns_draft: local.filter((c) => c.status === "draft" || c.status === "pending_publish").length,
    campaigns_error: local.filter((c) => c.status === "error").length,
  };

  const auth = await ensureTikTokAccessToken(projectId);
  if (!auth.ok) {
    return {
      ok: true as const,
      connected: false,
      range,
      counts: { ...counts, connected_accounts: 0 },
      metrics: null,
      source: "local_only" as const,
      connection_error: auth.error,
      connection_error_code: "not_connected",
    };
  }
  counts.connected_accounts = 1;

  const metricsPack = await fetchTikTokAdsCampaignsMetrics(projectId, preset, customFrom, customTo);
  if (!metricsPack.ok) {
    return {
      ok: true as const,
      connected: true,
      range,
      counts,
      metrics: null,
      source: "network_error" as const,
      connection_error: metricsPack.error,
      connection_error_code: metricsPack.code,
    };
  }

  let impressions = 0;
  let clicks = 0;
  let cost_micros = 0;
  let conversions = 0;
  let conversions_value = 0;
  for (const c of metricsPack.campaigns) {
    if (!c.metrics) continue;
    impressions += c.metrics.impressions;
    clicks += c.metrics.clicks;
    cost_micros += c.metrics.cost_micros;
    conversions += c.metrics.conversions;
    conversions_value += c.metrics.conversions_value ?? 0;
  }

  return {
    ok: true as const,
    connected: true,
    range,
    counts,
    metrics: deriveMetricRates({
      impressions,
      clicks,
      cost_micros,
      conversions,
      conversions_value,
    }),
    source: "tiktok_api" as const,
  };
}

export async function fetchTikTokAdsCampaignsMetrics(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "tiktok_ads" },
    select: {
      id: true,
      name: true,
      status: true,
      externalCampaignId: true,
      dailyBudgetMicros: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const auth = await ensureTikTokAccessToken(projectId);
  const byExternal = new Map<string, ReturnType<typeof deriveMetricRates>>();
  let networkError: string | null = null;

  if (auth.ok) {
    const ids = local
      .map((c) => c.externalCampaignId?.trim())
      .filter((id): id is string => Boolean(id));

    if (ids.length > 0) {
      const filtering = JSON.stringify([
        {
          field_name: "campaign_ids",
          filter_type: "IN",
          filter_value: JSON.stringify(ids),
        },
      ]);
      try {
        const j = await tiktokApiGetWithTokenRetry<{
          list?: Array<{
            dimensions?: { campaign_id?: string };
            metrics?: {
              spend?: string | number;
              impressions?: string | number;
              clicks?: string | number;
              conversion?: string | number;
              total_purchase_value?: string | number;
            };
          }>;
        }>(projectId, "report/integrated/get/", {
          advertiser_id: auth.advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: ["campaign_id"],
          metrics: ["spend", "impressions", "clicks", "conversion", "total_purchase_value"],
          start_date: range.from,
          end_date: range.to,
          filtering,
        });
        if (j.code !== 0) {
          networkError = j.message || `TikTok report code ${j.code}`;
        } else {
          for (const row of j.data?.list ?? []) {
            const id = String(row.dimensions?.campaign_id ?? "").trim();
            if (!id) continue;
            const spend = Number(row.metrics?.spend ?? 0) || 0;
            const impressions = Number(row.metrics?.impressions ?? 0) || 0;
            const clicks = Number(row.metrics?.clicks ?? 0) || 0;
            const conversions = Number(row.metrics?.conversion ?? 0) || 0;
            const conversions_value = Number(row.metrics?.total_purchase_value ?? 0) || 0;
            byExternal.set(
              id,
              deriveMetricRates({
                impressions,
                clicks,
                cost_micros: Math.round(spend * 1_000_000),
                conversions,
                conversions_value,
              }),
            );
          }
        }
      } catch (e) {
        networkError = e instanceof Error ? e.message : "TikTok report falhou.";
      }
    }
  }

  const campaigns = local.map((c) => {
    const ext = c.externalCampaignId?.trim() ?? "";
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      external_campaign_id: c.externalCampaignId,
      daily_budget_micros: c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null,
      created_at: c.createdAt.toISOString(),
      metrics: ext ? byExternal.get(ext) ?? null : null,
    };
  });

  return {
    ok: true as const,
    range,
    connected: auth.ok,
    network_error: networkError,
    campaigns,
    source: auth.ok ? ("tiktok_api" as const) : ("local_only" as const),
  };
}

export async function listRemoteTikTokCampaigns(projectId: string) {
  const auth = await ensureTikTokAccessToken(projectId);
  if (!auth.ok) {
    return { ok: false as const, error: auth.error, code: "not_connected" as const };
  }

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "tiktok_ads", externalCampaignId: { not: null } },
    select: { id: true, externalCampaignId: true },
  });
  const byExt = new Map(
    local
      .map((c) => [String(c.externalCampaignId).trim(), c.id] as const)
      .filter(([id]) => Boolean(id)),
  );

  const j = await tiktokApiGetWithTokenRetry<{
    list?: Array<{
      campaign_id?: string;
      campaign_name?: string;
      operation_status?: string;
      budget?: number | string;
      budget_mode?: string;
      objective_type?: string;
    }>;
  }>(projectId, "campaign/get/", {
    advertiser_id: auth.advertiserId,
    page_size: 100,
    fields: JSON.stringify([
      "campaign_id",
      "campaign_name",
      "operation_status",
      "budget",
      "budget_mode",
      "objective_type",
    ]),
  });

  if (j.code !== 0) {
    return {
      ok: false as const,
      error: j.message || `TikTok campaign/get ${j.code}`,
      code: "tiktok_error" as const,
    };
  }

  const campaigns = (j.data?.list ?? []).map((row) => {
    const ext = String(row.campaign_id ?? "").trim();
    const budget = row.budget != null ? Number(row.budget) : null;
    const localId = byExt.get(ext) ?? null;
    const dailyMicros =
      row.budget_mode === "BUDGET_MODE_DAY" && Number.isFinite(budget)
        ? Math.round(Number(budget) * 1_000_000)
        : null;
    return {
      external_campaign_id: ext,
      name: String(row.campaign_name ?? ext).slice(0, 255),
      status: mapTiktokStatus(row.operation_status),
      objective: row.objective_type ?? null,
      daily_budget_micros: dailyMicros,
      budget_editable: dailyMicros != null,
      already_imported: Boolean(localId),
      local_campaign_id: localId,
    };
  });

  return {
    ok: true as const,
    campaigns,
    totals: {
      remote: campaigns.length,
      imported: campaigns.filter((c) => c.already_imported).length,
      new: campaigns.filter((c) => !c.already_imported).length,
    },
  };
}

/** Inventário local TikTok (campanhas + IDs de ad group / ad). */
export async function fetchTikTokAdsProjectInventory(projectId: string) {
  const campaigns = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "tiktok_ads", status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
  });

  return {
    ok: true as const,
    campaigns: campaigns.map((c) => {
      const landing =
        c.biddingConfig &&
        typeof c.biddingConfig === "object" &&
        !Array.isArray(c.biddingConfig) &&
        typeof (c.biddingConfig as Record<string, unknown>).clickora_landing_url === "string"
          ? String((c.biddingConfig as Record<string, unknown>).clickora_landing_url)
          : null;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        external_campaign_id: c.externalCampaignId,
        tiktok_ad_group_id: c.tiktokAdGroupId,
        tiktok_ad_id: c.tiktokAdId,
        daily_budget_micros: c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null,
        landing_url: landing,
      };
    }),
    totals: {
      campaigns: campaigns.length,
      linked: campaigns.filter((c) => Boolean(c.externalCampaignId)).length,
      with_ad_group: campaigns.filter((c) => Boolean(c.tiktokAdGroupId)).length,
      with_ad: campaigns.filter((c) => Boolean(c.tiktokAdId)).length,
    },
  };
}

export { mapTiktokStatus };
