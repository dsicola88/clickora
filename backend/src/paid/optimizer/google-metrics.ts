/**
 * Gasto e métricas ao nível da campanha via Google Ads API (REST search).
 * Usa resolveGoogleAdsAccess — mesma conta/token/MCC que o Campaign Manager.
 */
import { runGoogleAdsSearch } from "../google-ads.api";
import { resolveGoogleAdsAccess } from "../google-ads-connection";

function gaDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma cost_micros da campanha no intervalo [from, to] (datas inclusivas). */
export async function fetchGoogleCampaignCostMicros(args: {
  projectId: string;
  externalCampaignId: string | null;
  from: Date;
  to: Date;
}): Promise<{ ok: true; costMicros: number } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.replace(/\D/g, "");
  if (!ext) return { ok: false, error: "Sem external_campaign_id Google." };

  const ctx = await resolveGoogleAdsAccess(args.projectId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const fromStr = gaDate(args.from);
  const toStr = gaDate(args.to);

  const q = `
    SELECT campaign.id, metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${ext}
      AND segments.date BETWEEN '${fromStr}' AND '${toStr}'
  `;

  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
  if (s.error?.message) return { ok: false, error: s.error.message };

  let total = 0;
  const rows = Array.isArray(s.results) ? s.results : [];
  for (const row of rows) {
    const m = row as {
      metrics?: { costMicros?: unknown; cost_micros?: unknown };
    };
    const raw = m.metrics?.costMicros ?? m.metrics?.cost_micros ?? 0;
    const micros = typeof raw === "string" ? Number(raw) : Number(raw);
    if (Number.isFinite(micros)) total += micros;
  }
  /** Sem linhas no intervalo = custo 0 real da API, não inventado. */
  return { ok: true, costMicros: total };
}

export type GoogleAdMetricRow = {
  ad_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost_micros: number;
};

/** Métricas por anúncio (RSA) da campanha — últimos 7 dias inclusivos até hoje. */
export async function fetchGoogleAdGroupAdMetrics(args: {
  projectId: string;
  externalCampaignId: string | null;
  from?: Date;
  to?: Date;
}): Promise<{ ok: true; rows: GoogleAdMetricRow[] } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.replace(/\D/g, "");
  if (!ext) return { ok: false, error: "Sem external_campaign_id Google." };

  const ctx = await resolveGoogleAdsAccess(args.projectId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const to = args.to ?? new Date();
  const from = args.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromStr = gaDate(from);
  const toStr = gaDate(to);

  const q = `
    SELECT
      ad_group_ad.ad.id,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE campaign.id = ${ext}
      AND segments.date BETWEEN '${fromStr}' AND '${toStr}'
      AND ad_group_ad.status != 'REMOVED'
  `;

  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
  if (s.error?.message) return { ok: false, error: s.error.message };

  const byAd = new Map<string, GoogleAdMetricRow>();
  const rows = Array.isArray(s.results) ? s.results : [];
  for (const raw of rows) {
    const row = raw as {
      adGroupAd?: { ad?: { id?: string | number } };
      ad_group_ad?: { ad?: { id?: string | number } };
      metrics?: {
        impressions?: unknown;
        clicks?: unknown;
        conversions?: unknown;
        costMicros?: unknown;
        cost_micros?: unknown;
      };
    };
    const adId = String(
      row.adGroupAd?.ad?.id ?? row.ad_group_ad?.ad?.id ?? "",
    ).replace(/\D/g, "");
    if (!adId) continue;
    const impressions = Number(row.metrics?.impressions ?? 0) || 0;
    const clicks = Number(row.metrics?.clicks ?? 0) || 0;
    const conversions = Number(row.metrics?.conversions ?? 0) || 0;
    const costRaw = row.metrics?.costMicros ?? row.metrics?.cost_micros ?? 0;
    const cost_micros = typeof costRaw === "string" ? Number(costRaw) : Number(costRaw) || 0;
    const prev = byAd.get(adId) ?? {
      ad_id: adId,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      cost_micros: 0,
    };
    byAd.set(adId, {
      ad_id: adId,
      impressions: prev.impressions + impressions,
      clicks: prev.clicks + clicks,
      conversions: prev.conversions + conversions,
      cost_micros: prev.cost_micros + (Number.isFinite(cost_micros) ? cost_micros : 0),
    });
  }
  return { ok: true, rows: [...byAd.values()] };
}
