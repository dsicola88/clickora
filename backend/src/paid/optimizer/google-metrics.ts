/**
 * Gasto e métricas ao nível da campanha via Google Ads API (REST search).
 */
import { getAccessFromRefreshToken, getGoogleDeveloperToken, runGoogleAdsSearch } from "../google-ads.api";
import { prisma } from "../paidPrisma";

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
    ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
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
