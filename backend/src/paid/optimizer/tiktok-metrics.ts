/**
 * Gasto de campanha TikTok (Marketing API report) — moeda do advertiser (tipicamente USD).
 * Usa a mesma autenticação OAuth do publish (`tiktokApiGetWithTokenRetry`).
 */
import { ensureTikTokAccessToken, tiktokApiGetWithTokenRetry } from "../tiktok-oauth.api";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchTikTokCampaignSpendUsd(args: {
  projectId: string;
  externalCampaignId: string | null;
  from: Date;
  to: Date;
}): Promise<{ ok: true; spendUsd: number } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.trim();
  if (!ext) return { ok: false, error: "Sem campanha TikTok remota." };

  const auth = await ensureTikTokAccessToken(args.projectId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const start = ymd(args.from);
  const end = ymd(args.to <= args.from ? new Date(args.from.getTime() + 86400_000) : args.to);

  const filtering = JSON.stringify([
    {
      field_name: "campaign_ids",
      filter_type: "IN",
      filter_value: JSON.stringify([ext]),
    },
  ]);

  const j = await tiktokApiGetWithTokenRetry<{
    list?: Array<{
      metrics?: { spend?: string | number };
    }>;
  }>(args.projectId, "report/integrated/get/", {
    advertiser_id: auth.advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: ["campaign_id"],
    metrics: ["spend"],
    start_date: start,
    end_date: end,
    filtering,
  });

  if (j.code !== 0) {
    return { ok: false, error: j.message || `TikTok report code ${j.code}` };
  }

  let total = 0;
  for (const row of j.data?.list ?? []) {
    const n = Number(row.metrics?.spend);
    if (Number.isFinite(n)) total += n;
  }
  return { ok: true, spendUsd: total };
}
