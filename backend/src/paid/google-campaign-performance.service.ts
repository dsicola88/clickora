/**
 * Séries simples de desempenho (GAQL) para o estúdio — mesma conta OAuth do projecto Paid.
 */
import { runGoogleAdsSearch } from "./google-ads.api";
import { resolveGoogleAdsAccess } from "./google-ads-connection";
import { parseGoogleAdsMetrics } from "./google-ads-metric-fields";
import { prisma } from "./paidPrisma";

export type GoogleCampaignPerformanceDayRow = {
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

async function googleAccessCtx(projectId: string): Promise<
  | { ok: false; error: string }
  | { ok: true; access: string; customerId: string; dev: string; loginCustomerId?: string }
> {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  return {
    ok: true,
    access: ctx.access,
    customerId: ctx.customerId,
    dev: ctx.dev,
    loginCustomerId: ctx.loginCustomerId,
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

  const s = await runGoogleAdsSearch(c0.access, c0.customerId, c0.dev, q, c0.loginCustomerId);
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
    const m = parseGoogleAdsMetrics(row);
    if (!date) continue;
    rows.push({
      date,
      impressions: m.impressions,
      clicks: m.clicks,
      cost_micros: m.cost_micros,
      conversions: m.conversions,
    });
    impressions += m.impressions;
    clicks += m.clicks;
    cost_micros += m.cost_micros;
    conversions += m.conversions;
  }
  return {
    ok: true,
    rows,
    totals: { impressions, clicks, cost_micros, conversions },
  };
}
