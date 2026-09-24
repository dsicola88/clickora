import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

export function campaignUtmSlug(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return s || "campanha";
}

export type CampaignPerf = {
  clicks: number;
  conversions: number;
  revenue: number;
  conversion_rate: number;
  epc: number | null;
  cpa: number | null;
  roas: number | null;
  profit: number | null;
};

export function computePerf(args: {
  clicks: number;
  conversions: number;
  revenue: number;
  spend: number | null;
}): CampaignPerf {
  const { clicks, conversions, revenue, spend } = args;
  const conversion_rate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const epc = clicks > 0 ? revenue / clicks : null;
  const cpa = spend != null && spend > 0 && conversions > 0 ? spend / conversions : null;
  const roas = spend != null && spend > 0 ? revenue / spend : null;
  const profit = spend != null ? revenue - spend : null;
  return {
    clicks,
    conversions,
    revenue: Math.round(revenue * 100) / 100,
    conversion_rate: Math.round(conversion_rate * 100) / 100,
    epc: epc != null ? Math.round(epc * 10000) / 10000 : null,
    cpa: cpa != null ? Math.round(cpa * 100) / 100 : null,
    roas: roas != null ? Math.round(roas * 100) / 100 : null,
    profit: profit != null ? Math.round(profit * 100) / 100 : null,
  };
}

/** Cliques + conversões/receita atribuídos a uma campanha (nome ou utm slug). */
export async function loadCampaignPerf(args: {
  userId: string;
  campaignName: string;
  spend: number | null;
  from?: Date;
  to?: Date;
}): Promise<CampaignPerf> {
  const slug = campaignUtmSlug(args.campaignName);
  const name = args.campaignName.trim();

  const fromSql = args.from ? Prisma.sql`AND created_at >= ${args.from}` : Prisma.empty;
  const toSql = args.to ? Prisma.sql`AND created_at <= ${args.to}` : Prisma.empty;

  const [clickRow] = await systemPrisma.$queryRaw<Array<{ cnt: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS cnt
    FROM tracking_events
    WHERE user_id = ${args.userId}
      AND event_type::text = 'click'
      AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
      ${fromSql}
      ${toSql}
      AND (
        LOWER(TRIM(COALESCE(campaign, ''))) = LOWER(${name})
        OR LOWER(TRIM(COALESCE(metadata->>'utm_campaign', ''))) = LOWER(${slug})
        OR LOWER(TRIM(COALESCE(metadata->>'utm_campaign', ''))) = LOWER(${name})
      )
  `);

  const [convRow] = await systemPrisma.$queryRaw<Array<{ cnt: bigint; rev: unknown }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS cnt, COALESCE(SUM(amount), 0) AS rev
    FROM conversions
    WHERE user_id = ${args.userId}
      AND status = 'approved'
      ${fromSql}
      ${toSql}
      AND (
        LOWER(TRIM(COALESCE(campaign, ''))) = LOWER(${name})
        OR LOWER(TRIM(COALESCE(metadata->>'utm_campaign', ''))) = LOWER(${slug})
        OR LOWER(TRIM(COALESCE(metadata->>'utm_campaign', ''))) = LOWER(${name})
      )
  `);

  const clicks = Number(clickRow?.cnt ?? 0);
  const conversions = Number(convRow?.cnt ?? 0);
  const revenue = convRow?.rev != null ? Number(convRow.rev) : 0;
  return computePerf({ clicks, conversions, revenue, spend: args.spend });
}

export type MediaBuyerAlert = {
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export function buildMediaBuyerAlerts(args: {
  clicks: number;
  conversions: number;
  revenue: number;
  spend: number | null;
  spendSource: "google_ads" | "manual" | "none";
  googleError?: string | null;
}): MediaBuyerAlert[] {
  const alerts: MediaBuyerAlert[] = [];
  const { clicks, conversions, revenue, spend, spendSource, googleError } = args;

  if (googleError) {
    alerts.push({
      code: "google_spend_unavailable",
      severity: "warning",
      title: "Custo Google indisponível",
      detail: googleError.slice(0, 200),
    });
  }

  if (spendSource === "none") {
    alerts.push({
      code: "no_spend",
      severity: "info",
      title: "ROI incompleto",
      detail:
        "Ligue o Google Ads (gasto do mesmo período) para ver lucro, ROAS e CPA. Gasto manual acumulado nas campanhas não entra neste cálculo.",
    });
  }

  if (spend != null && spend >= 30 && conversions === 0) {
    alerts.push({
      code: "spend_no_sales",
      severity: "critical",
      title: "Gasto sem vendas",
      detail: `Gastou ${spend.toFixed(2)} neste período sem conversões aprovadas. Pause ou revise o anúncio.`,
    });
  }

  if (spend != null && spend > 0 && conversions > 0) {
    const cpa = spend / conversions;
    const avgOrder = revenue / conversions;
    if (avgOrder > 0 && cpa > avgOrder) {
      alerts.push({
        code: "cpa_above_aov",
        severity: "critical",
        title: "CPA acima da comissão média",
        detail: `CPA ${cpa.toFixed(2)} vs comissão média ${avgOrder.toFixed(2)}. Está a perder dinheiro por venda.`,
      });
    }
  }

  if (clicks >= 80 && conversions === 0) {
    alerts.push({
      code: "clicks_no_sales",
      severity: "warning",
      title: "Muitos cliques, zero vendas",
      detail: `${clicks} cliques sem conversão. Verifique oferta, postback e página.`,
    });
  }

  if (clicks >= 50) {
    const cvr = (conversions / clicks) * 100;
    if (cvr > 0 && cvr < 0.8) {
      alerts.push({
        code: "low_cvr",
        severity: "warning",
        title: "Taxa de conversão baixa",
        detail: `CVR ${cvr.toFixed(2)}%. Teste outro ângulo de presell ou tráfego.`,
      });
    }
  }

  return alerts;
}
