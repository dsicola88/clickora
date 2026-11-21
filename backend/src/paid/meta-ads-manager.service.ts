/**
 * Campaign Manager Meta — overview + métricas por campanha (Graph insights).
 * Não toca em Google; espelho fino do shape usado na UI do gestor.
 */
import { resolveGoogleAdsDateRange, deriveMetricRates } from "./google-ads-connection";
import { prisma } from "./paidPrisma";
import { isOAuthPendingToken, loadPaidToken } from "./tokenSecrets";

const GRAPH = "https://graph.facebook.com/v21.0";

function mapMetaStatus(s: string | undefined): "live" | "paused" | "archived" {
  const u = (s ?? "").toUpperCase();
  if (u === "ACTIVE") return "live";
  if (u === "DELETED" || u === "ARCHIVED") return "archived";
  return "paused";
}

function metaActionConversions(
  actions: Array<{ action_type?: string; value?: string }> | undefined,
): number {
  if (!actions?.length) return 0;
  const prefer = new Set([
    "purchase",
    "omni_purchase",
    "lead",
    "complete_registration",
    "offsite_conversion.fb_pixel_purchase",
    "offsite_conversion.fb_pixel_lead",
  ]);
  let sum = 0;
  let anyPrefer = false;
  for (const a of actions) {
    const t = (a.action_type ?? "").toLowerCase();
    const v = Number(a.value);
    if (!Number.isFinite(v)) continue;
    if (prefer.has(t)) {
      sum += v;
      anyPrefer = true;
    }
  }
  if (anyPrefer) return sum;
  for (const a of actions) {
    if ((a.action_type ?? "").toLowerCase() === "link_click") continue;
    const v = Number(a.value);
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

async function resolveMetaAccess(projectId: string) {
  const conn = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.adAccountId) {
    return { ok: false as const, error: "Ligue a conta Meta (OAuth) e o Ad Account.", code: "not_connected" };
  }
  if (isOAuthPendingToken(conn.tokenRef)) {
    return { ok: false as const, error: "Sessão Meta inválida.", code: "token_pending" };
  }
  const token = loadPaidToken(conn.tokenRef);
  if (!token) {
    return { ok: false as const, error: "Token Meta em falta.", code: "token_missing" };
  }
  return {
    ok: true as const,
    token,
    adAccountId: conn.adAccountId.replace(/^act_/, ""),
  };
}

export async function fetchMetaAdsAccountOverview(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "meta_ads", status: { not: "archived" } },
    select: { id: true, status: true, externalCampaignId: true, name: true, dailyBudgetMicros: true },
  });
  const linked = local.filter((c) => Boolean(c.externalCampaignId?.replace(/\D/g, "")));
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

  const ctx = await resolveMetaAccess(projectId);
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

  const metricsPack = await fetchMetaAdsCampaignsMetrics(projectId, preset, customFrom, customTo);
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
    source: "meta_graph" as const,
  };
}

export async function fetchMetaAdsCampaignsMetrics(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "meta_ads" },
    select: {
      id: true,
      name: true,
      status: true,
      externalCampaignId: true,
      dailyBudgetMicros: true,
      createdAt: true,
      metaAdsets: {
        select: { id: true, dailyBudgetCents: true, externalId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const ctx = await resolveMetaAccess(projectId);
  const byExternal = new Map<string, ReturnType<typeof deriveMetricRates>>();
  let networkError: string | null = null;

  if (ctx.ok) {
    const ids = local
      .map((c) => c.externalCampaignId?.replace(/\D/g, ""))
      .filter((id): id is string => Boolean(id));

    if (ids.length > 0) {
      const filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: ids }]);
      const u = new URL(`${GRAPH}/act_${ctx.adAccountId}/insights`);
      u.searchParams.set("access_token", ctx.token);
      u.searchParams.set("level", "campaign");
      u.searchParams.set(
        "fields",
        "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values",
      );
      u.searchParams.set("time_range", JSON.stringify({ since: range.from, until: range.to }));
      u.searchParams.set("filtering", filtering);
      u.searchParams.set("limit", "200");

      try {
        const res = await fetch(u.toString());
        const j = (await res.json()) as {
          data?: Array<{
            campaign_id?: string;
            impressions?: string;
            clicks?: string;
            spend?: string;
            actions?: Array<{ action_type?: string; value?: string }>;
            action_values?: Array<{ action_type?: string; value?: string }>;
          }>;
          error?: { message?: string };
        };
        if (!res.ok || j.error) {
          networkError = j.error?.message ?? `Meta insights ${res.status}`;
        } else {
          for (const row of j.data ?? []) {
            const id = String(row.campaign_id ?? "").replace(/\D/g, "");
            if (!id) continue;
            const impressions = Number(row.impressions ?? 0) || 0;
            const clicks = Number(row.clicks ?? 0) || 0;
            const spend = Number(row.spend ?? 0) || 0;
            const conversions = metaActionConversions(row.actions);
            const conversions_value = metaActionConversions(row.action_values);
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
        networkError = e instanceof Error ? e.message : "Meta insights falhou.";
      }
    }
  }

  const campaigns = local.map((c) => {
    const ext = c.externalCampaignId?.replace(/\D/g, "") ?? "";
    const adsetCents = c.metaAdsets[0]?.dailyBudgetCents;
    const budgetMicros =
      adsetCents != null
        ? Number(adsetCents) * 10_000
        : c.dailyBudgetMicros != null
          ? Number(c.dailyBudgetMicros)
          : null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      external_campaign_id: c.externalCampaignId,
      daily_budget_micros: budgetMicros,
      created_at: c.createdAt.toISOString(),
      metrics: ext ? byExternal.get(ext) ?? null : null,
      primary_meta_adset_id: c.metaAdsets[0]?.id ?? null,
    };
  });

  return {
    ok: true as const,
    range,
    connected: ctx.ok,
    network_error: networkError,
    campaigns,
    source: ctx.ok ? ("meta_graph" as const) : ("local_only" as const),
  };
}

export async function listRemoteMetaCampaigns(projectId: string) {
  const ctx = await resolveMetaAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "meta_ads", externalCampaignId: { not: null } },
    select: { id: true, externalCampaignId: true },
  });
  const byExt = new Map(
    local
      .map((c) => [c.externalCampaignId!.replace(/\D/g, ""), c.id] as const)
      .filter(([id]) => Boolean(id)),
  );

  const u = new URL(`${GRAPH}/act_${ctx.adAccountId}/campaigns`);
  u.searchParams.set("access_token", ctx.token);
  u.searchParams.set("fields", "id,name,status,daily_budget,lifetime_budget,objective");
  u.searchParams.set("limit", "200");
  u.searchParams.set(
    "filtering",
    JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
  );

  const res = await fetch(u.toString());
  const j = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      objective?: string;
    }>;
    error?: { message?: string };
  };
  if (!res.ok || j.error) {
    return {
      ok: false as const,
      error: j.error?.message ?? `Meta campaigns ${res.status}`,
      code: "graph_error",
    };
  }

  const campaigns = (j.data ?? []).map((row) => {
    const ext = String(row.id ?? "").replace(/\D/g, "");
    const dailyCents = row.daily_budget != null ? Number(row.daily_budget) : null;
    const localId = byExt.get(ext) ?? null;
    return {
      external_campaign_id: ext,
      name: String(row.name ?? ext).slice(0, 255),
      status: mapMetaStatus(row.status),
      objective: row.objective ?? null,
      daily_budget_cents: Number.isFinite(dailyCents) ? dailyCents : null,
      budget_editable: dailyCents != null && Number.isFinite(dailyCents),
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

/** Inventário local Meta (campanhas + ad sets + criativos + ads) — sem Search chrome. */
export async function fetchMetaAdsProjectInventory(projectId: string) {
  const campaigns = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "meta_ads", status: { not: "archived" } },
    include: {
      metaAdsets: {
        include: {
          creatives: true,
          metaAds: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const adsets = campaigns.flatMap((c) =>
    c.metaAdsets.map((a) => ({
      id: a.id,
      campaign_id: c.id,
      campaign_name: c.name,
      name: a.name,
      status: a.status,
      external_id: a.externalId,
      daily_budget_cents: a.dailyBudgetCents != null ? Number(a.dailyBudgetCents) : null,
      creatives_count: a.creatives.length,
      ads_count: a.metaAds.length,
    })),
  );

  const creatives = campaigns.flatMap((c) =>
    c.metaAdsets.flatMap((a) =>
      a.creatives.map((cr) => ({
        id: cr.id,
        campaign_id: c.id,
        campaign_name: c.name,
        adset_id: a.id,
        headline: cr.headline,
        status: cr.status,
        destination_url: cr.destinationUrl,
        external_id: cr.externalId,
      })),
    ),
  );

  const ads = campaigns.flatMap((c) =>
    c.metaAdsets.flatMap((a) =>
      a.metaAds.map((ad) => ({
        id: ad.id,
        campaign_id: c.id,
        campaign_name: c.name,
        adset_id: a.id,
        name: ad.name,
        status: ad.status,
        external_ad_id: ad.externalAdId,
      })),
    ),
  );

  return {
    ok: true as const,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      external_campaign_id: c.externalCampaignId,
      adsets_count: c.metaAdsets.length,
      landing_url:
        c.biddingConfig &&
        typeof c.biddingConfig === "object" &&
        !Array.isArray(c.biddingConfig) &&
        typeof (c.biddingConfig as Record<string, unknown>).clickora_landing_url === "string"
          ? String((c.biddingConfig as Record<string, unknown>).clickora_landing_url)
          : null,
    })),
    adsets,
    creatives,
    ads,
    totals: {
      campaigns: campaigns.length,
      adsets: adsets.length,
      creatives: creatives.length,
      ads: ads.length,
      linked: campaigns.filter((c) => Boolean(c.externalCampaignId)).length,
    },
  };
}

export { mapMetaStatus };
