/**
 * Gasto estimado campanha Meta (Graph insights) — USD.
 * Insights por anúncio (level=ad) para ranking de criativos.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export async function fetchMetaCampaignSpendUsd(args: {
  accessToken: string;
  externalCampaignId: string | null;
}): Promise<{ ok: true; spendUsd: number } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.trim();
  if (!ext) return { ok: false, error: "Sem campanha Meta remota." };

  const u = new URL(`${GRAPH}/${ext.replace(/\D/g, "")}/insights`);
  u.searchParams.set("access_token", args.accessToken);
  u.searchParams.set("fields", "spend");
  u.searchParams.set("date_preset", "last_7d");

  const res = await fetch(u.toString());
  const j = (await res.json()) as {
    data?: Array<{ spend?: string }>;
    error?: { message?: string };
  };
  if (!res.ok || j.error) {
    return { ok: false, error: j.error?.message ?? `Meta insights ${res.status}` };
  }
  let total = 0;
  for (const row of j.data ?? []) {
    const n = Number(row.spend);
    if (Number.isFinite(n)) total += n;
  }
  return { ok: true, spendUsd: total };
}

export type MetaAdInsightRow = {
  ad_id: string;
  ad_name: string;
  impressions: number;
  clicks: number;
  spend_usd: number;
  conversions: number;
};

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

/** Insights Meta por anúncio (últimos 7 dias) para ranking A/B. */
export async function fetchMetaAdInsights(args: {
  accessToken: string;
  externalCampaignId: string | null;
}): Promise<{ ok: true; rows: MetaAdInsightRow[] } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.trim();
  if (!ext) return { ok: false, error: "Sem campanha Meta remota." };

  const u = new URL(`${GRAPH}/${ext.replace(/\D/g, "")}/insights`);
  u.searchParams.set("access_token", args.accessToken);
  u.searchParams.set("level", "ad");
  u.searchParams.set("fields", "ad_id,ad_name,impressions,clicks,spend,actions");
  u.searchParams.set("date_preset", "last_7d");
  u.searchParams.set("limit", "100");

  const res = await fetch(u.toString());
  const j = (await res.json()) as {
    data?: Array<{
      ad_id?: string;
      ad_name?: string;
      impressions?: string;
      clicks?: string;
      spend?: string;
      actions?: Array<{ action_type?: string; value?: string }>;
    }>;
    error?: { message?: string };
  };
  if (!res.ok || j.error) {
    return { ok: false, error: j.error?.message ?? `Meta ad insights ${res.status}` };
  }

  const rows: MetaAdInsightRow[] = [];
  for (const row of j.data ?? []) {
    const adId = String(row.ad_id ?? "").trim();
    if (!adId) continue;
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const spend_usd = Number(row.spend ?? 0);
    rows.push({
      ad_id: adId,
      ad_name: String(row.ad_name ?? adId).slice(0, 120),
      impressions: Number.isFinite(impressions) ? impressions : 0,
      clicks: Number.isFinite(clicks) ? clicks : 0,
      spend_usd: Number.isFinite(spend_usd) ? spend_usd : 0,
      conversions: metaActionConversions(row.actions),
    });
  }
  return { ok: true, rows };
}
