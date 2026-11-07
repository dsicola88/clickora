/**
 * Gasto e métricas ao nível da campanha via Google Ads API (REST search).
 */
import { getAccessFromRefreshToken, getGoogleDeveloperToken, runGoogleAdsSearch } from "../google-ads.api";
import { prisma } from "../paidPrisma";
import { isOAuthPendingToken, loadPaidToken } from "../tokenSecrets";

const LOGIN = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") || undefined;

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

  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId: args.projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { ok: false, error: "Google Ads não ligado." };
  }
  const dev = getGoogleDeveloperToken();
  if (!dev) return { ok: false, error: "Developer token em falta." };

  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(loadPaidToken(conn.tokenRef)!));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token Google." };
  }

  const customerId = conn.googleCustomerId.replace(/\D/g, "");
  const fromStr = gaDate(args.from);
  const toStr = gaDate(args.to);

  const q = `
    SELECT campaign.id, metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${ext}
      AND segments.date BETWEEN '${fromStr}' AND '${toStr}'
  `;

  const s = await runGoogleAdsSearch(access, customerId, dev, q, LOGIN);
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

  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId: args.projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { ok: false, error: "Google Ads não ligado." };
  }
  const dev = getGoogleDeveloperToken();
  if (!dev) return { ok: false, error: "Developer token em falta." };

  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(loadPaidToken(conn.tokenRef)!));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token Google." };
  }

  const to = args.to ?? new Date();
  const from = args.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const customerId = conn.googleCustomerId.replace(/\D/g, "");
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

  const s = await runGoogleAdsSearch(access, customerId, dev, q, LOGIN);
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
    const adIdRaw =
      row.adGroupAd?.ad?.id ?? row.ad_group_ad?.ad?.id ?? null;
    const ad_id = adIdRaw != null ? String(adIdRaw).replace(/\D/g, "") : "";
    if (!ad_id) continue;

    const n = (v: unknown) => {
      const x = typeof v === "string" ? Number(v) : Number(v ?? 0);
      return Number.isFinite(x) ? x : 0;
    };
    const prev = byAd.get(ad_id) ?? {
      ad_id,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      cost_micros: 0,
    };
    prev.impressions += n(row.metrics?.impressions);
    prev.clicks += n(row.metrics?.clicks);
    prev.conversions += n(row.metrics?.conversions);
    prev.cost_micros += n(row.metrics?.costMicros ?? row.metrics?.cost_micros);
    byAd.set(ad_id, prev);
  }

  return { ok: true, rows: [...byAd.values()] };
}
