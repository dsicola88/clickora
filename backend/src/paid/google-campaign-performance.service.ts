/**
 * Séries simples de desempenho (GAQL) para o estúdio — mesma conta OAuth do projecto Paid.
 */
import { getAccessFromRefreshToken, getGoogleDeveloperToken, runGoogleAdsSearch } from "./google-ads.api";
import { prisma } from "./paidPrisma";

const LOGIN = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") || undefined;

export type GoogleCampaignPerformanceDayRow = {
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

async function googleAccessCtx(projectId: string): Promise<
  | { ok: false; error: string }
  | { ok: true; access: string; customerId: string; dev: string }
> {
  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { ok: false, error: "Ligue a conta Google Ads (OAuth)." };
  }
  const dev = getGoogleDeveloperToken();
  if (!dev) return { ok: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN em falta." };
  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token Google inválido." };
  }
  return {
    ok: true,
    access,
    customerId: conn.googleCustomerId.replace(/\D/g, ""),
    dev,
  };
}

function parseGaqlLocalDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length < 10) return null;
  const d = new Date(`${raw.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `fromIso`/`toIso` formato `YYYY-MM-DD` inclusive. */
export async function fetchGoogleCampaignPerformanceSeries(
  projectId: string,
  localCampaignId: string,
  fromIso: string,
  toIso: string,
): Promise<
  | {
      ok: true;
      rows: GoogleCampaignPerformanceDayRow[];
      totals: Omit<GoogleCampaignPerformanceDayRow, "date">;
    }
  | { ok: false; error: string }
> {
  const c0 = await googleAccessCtx(projectId);
  if (!c0.ok) return { ok: false, error: c0.error };

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: localCampaignId, projectId, platform: "google_ads" },
    select: { externalCampaignId: true },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha sem ID na Google — métricas disponíveis após publicação." };
  }
  const extId = camp.externalCampaignId.replace(/\D/g, "");
  const fromTrim = String(fromIso).trim().slice(0, 10);
  const toTrim = String(toIso).trim().slice(0, 10);

  const d0 = parseGaqlLocalDate(fromTrim);
  const d1 = parseGaqlLocalDate(toTrim);
  if (!d0 || !d1 || d0 > d1) {
    return { ok: false, error: "Intervalo de datas inválido." };
  }
  const maxSpanDays = 95;
  if ((d1.getTime() - d0.getTime()) / 86400000 > maxSpanDays) {
    return { ok: false, error: `Escolha no máximo ${maxSpanDays} dias por pedido.` };
  }

  const q = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE campaign.id = ${extId}
      AND segments.date BETWEEN '${fromTrim}' AND '${toTrim}'
    ORDER BY segments.date
    LIMIT 10000
  `;

  const s = await runGoogleAdsSearch(c0.access, c0.customerId, c0.dev, q, LOGIN);
  if (s.error) {
    return { ok: false, error: s.error.message ?? "Falha ao ler estatísticas." };
  }
  const list = Array.isArray(s.results) ? s.results : [];
  const rows: GoogleCampaignPerformanceDayRow[] = [];
  let impressions = 0;
  let clicks = 0;
  let cost_micros = 0;
  let conversions = 0;
  for (const raw of list) {
    const row = raw as Record<string, unknown>;
    const date = ((row.segments as { date?: string } | undefined)?.date ?? "").slice(0, 10);
    const met = row.metrics as
      | { impressions?: unknown; clicks?: unknown; cost_micros?: unknown; conversions?: unknown }
      | undefined;
    const im = Number(met?.impressions ?? 0);
    const cl = Number(met?.clicks ?? 0);
    const co = Number(met?.cost_micros ?? 0);
    const cv = Number(met?.conversions ?? 0);
    if (!date) continue;
    rows.push({
      date,
      impressions: im,
      clicks: cl,
      cost_micros: co,
      conversions: cv,
    });
    impressions += im;
    clicks += cl;
    cost_micros += co;
    conversions += cv;
  }
  return {
    ok: true,
    rows,
    totals: { impressions, clicks, cost_micros, conversions },
  };
}
