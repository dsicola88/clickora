import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { isGoogleAdsMetricsReadyForUser } from "../modules/googleAds/googleAds.service";
import { planAllowsAffiliateWebhook } from "./planAffiliateWebhook";

export type AccountHealthCheck = {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
  href?: string;
};

export type AccountHealth = {
  score: number;
  checks: AccountHealthCheck[];
  attribution: {
    approved_sales: number;
    attributed_sales: number;
    unattributed_sales: number;
    attribution_rate: number | null;
  };
  last_cost_sync_at: string | null;
  timezone: "UTC";
};

/**
 * Saúde operacional da conta — o que um media buyer verifica antes de confiar no ROAS.
 */
export async function buildAccountHealth(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  pipelineUser: {
    googleAdsEnabled: boolean;
    googleAdsCustomerId: string | null;
    googleAdsConversionActionId: string | null;
    googleAdsLoginCustomerId: string | null;
    googleAdsRefreshToken: string | null;
  } | null;
  macroClicksInPeriod: number;
}): Promise<AccountHealth> {
  const { userId, rangeStart, rangeEnd, pipelineUser, macroClicksInPeriod } = args;

  const [attrRow, costSyncRow, pubPresell, campaignTracked, sub, anySale] = await Promise.all([
    systemPrisma.$queryRaw<Array<{ total: bigint; unattr: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE attribution = 'unattributed')::bigint AS unattr
      FROM conversions
      WHERE user_id = ${userId}
        AND status = 'approved'
        AND created_at >= ${rangeStart}
        AND created_at <= ${rangeEnd}
    `),
    systemPrisma.adPlatformCostDaily
      .findFirst({
        where: { userId },
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true, date: true },
      })
      .catch(() => null),
    systemPrisma.presellPage.count({
      where: { userId, status: "published" },
    }),
    systemPrisma.affiliateCampaign.count({
      where: { userId, status: "active", presellId: { not: null } },
    }),
    systemPrisma.subscription.findUnique({
      where: { userId },
      include: { plan: { select: { affiliateWebhookEnabled: true } } },
    }),
    systemPrisma.conversion.count({
      where: { userId, status: "approved" },
    }),
  ]);

  const approved = Number(attrRow[0]?.total ?? 0);
  const unattr = Number(attrRow[0]?.unattr ?? 0);
  const attributed = Math.max(0, approved - unattr);
  const attribution_rate = approved > 0 ? Math.round((attributed / approved) * 1000) / 10 : null;

  const webhookOk = planAllowsAffiliateWebhook(sub?.plan);
  const googleOk = pipelineUser ? isGoogleAdsMetricsReadyForUser(pipelineUser) : false;
  const costOk = Boolean(costSyncRow?.syncedAt);
  const last_cost_sync_at = costSyncRow?.syncedAt?.toISOString() ?? null;

  const checks: AccountHealthCheck[] = [
    {
      id: "presell_published",
      ok: pubPresell > 0,
      title: "Presell publicada",
      detail:
        pubPresell > 0
          ? `${pubPresell} página(s) publicada(s)`
          : "Publique uma presell com espelho da oferta antes de anunciar.",
      href: "/presells/nova",
    },
    {
      id: "campaign_linked",
      ok: campaignTracked > 0,
      title: "Campanha com link rastreado",
      detail:
        campaignTracked > 0
          ? `${campaignTracked} campanha(s) activa(s) com presell`
          : "Crie uma campanha e copie o URL do anúncio (UTMs + macros).",
      href: "/campanhas",
    },
    {
      id: "postback_plan",
      ok: webhookOk,
      title: "Postback no plano",
      detail: webhookOk
        ? "O plano permite webhooks de afiliado"
        : "O plano actual não inclui postback — actualize o plano ou contacte suporte.",
      href: "/planos",
    },
    {
      id: "postback_configured",
      ok: anySale > 0 || webhookOk,
      title: "Vendas da rede",
      detail:
        anySale > 0
          ? "Já há vendas aprovadas via postback"
          : "Configure o URL de postback em Integrações → Vendas da rede e faça uma venda de teste.",
      href: "/integracoes/postback",
    },
    {
      id: "google_ads",
      ok: googleOk,
      title: "Google Ads (custo do período)",
      detail: googleOk
        ? "OAuth + customer ID prontos para ROAS"
        : "Ligue o Google Ads em Integrações → Google Ads (1 clique).",
      href: "/integracoes/google-ads",
    },
    {
      id: "cost_sync",
      ok: costOk,
      title: "Sync de custos",
      detail: costOk
        ? `Último sync ${last_cost_sync_at ? new Date(last_cost_sync_at).toLocaleString("pt-PT") : ""}`
        : "Ainda sem custo diário — ligue Google Ads ou use «Sync custos» no Automizer.",
      href: "/integracoes/automizer",
    },
    {
      id: "attribution",
      ok: approved === 0 || (attribution_rate != null && attribution_rate >= 80),
      title: "Atribuição de vendas",
      detail:
        approved === 0
          ? "Sem vendas no período — normal em arranque"
          : `${attributed}/${approved} atribuídas (${attribution_rate ?? 0}%) · ${unattr} órfã(s)`,
      href: "/resultados/conversoes",
    },
    {
      id: "macros",
      ok: macroClicksInPeriod === 0,
      title: "Macros ValueTrack",
      detail:
        macroClicksInPeriod === 0
          ? "Sem {keyword}/{adgroupid} literais no período"
          : `${macroClicksInPeriod} clique(s) com macros não substituídas (testes manuais?)`,
      href: "/tracking/url-builder",
    },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const score = Math.round((okCount / checks.length) * 100);

  return {
    score,
    checks,
    attribution: {
      approved_sales: approved,
      attributed_sales: attributed,
      unattributed_sales: unattr,
      attribution_rate,
    },
    last_cost_sync_at,
    timezone: "UTC",
  };
}

/** KPIs leves para comparação com período anterior. */
export async function loadPeriodSnapshot(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<{ clicks: number; conversions: number; revenue: number }> {
  const { userId, rangeStart, rangeEnd } = args;
  const [clickRow, convRow] = await Promise.all([
    systemPrisma.$queryRaw<Array<{ ct: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS ct
      FROM tracking_events
      WHERE user_id = ${userId}
        AND created_at >= ${rangeStart}
        AND created_at <= ${rangeEnd}
        AND event_type::text = 'click'
        AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
        AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
    `),
    systemPrisma.$queryRaw<Array<{ ct: bigint; rev: unknown }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS ct, COALESCE(SUM(amount), 0) AS rev
      FROM conversions
      WHERE user_id = ${userId}
        AND status = 'approved'
        AND created_at >= ${rangeStart}
        AND created_at <= ${rangeEnd}
    `),
  ]);
  return {
    clicks: Number(clickRow[0]?.ct ?? 0),
    conversions: Number(convRow[0]?.ct ?? 0),
    revenue: Math.round(Number(convRow[0]?.rev ?? 0) * 100) / 100,
  };
}
