import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { isGoogleAdsMetricsReadyForUser } from "../modules/googleAds/googleAds.service";
import { planAllowsAffiliateWebhook } from "./planAffiliateWebhook";
import { summarizeUserDomainGoLive } from "./customDomainGoLiveSummary";

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

  const [attrRow, costSyncRow, pubPresell, campaignTracked, sub, anySale, postbackHits, domainGoLive] =
    await Promise.all([
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
    systemPrisma.postbackLog.count({ where: { userId } }).catch(() => 0),
    summarizeUserDomainGoLive(userId).catch(() => ({
      verified_hosting: 0,
      https_ready_hosting: 0,
      ssl_provisioning: 0,
      misconfigured: 0,
      ad_ready_hosting: 0,
    })),
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
          : "Crie uma campanha e copie o endereço do anúncio.",
      href: "/campanhas",
    },
    {
      id: "postback_plan",
      ok: webhookOk,
      title: "Aviso de vendas no plano",
      detail: webhookOk
        ? "O plano permite receber vendas da rede"
        : "O plano actual não recebe vendas da rede. Actualize o plano ou contacte o suporte.",
      href: "/planos",
    },
    {
      id: "postback_configured",
      ok: anySale > 0 || postbackHits > 0,
      title: "Vendas da rede",
      detail:
        anySale > 0
          ? "Já há vendas aprovadas da rede"
          : postbackHits > 0
            ? "Postback recebido — confirme macros (MaxWeb SUBID2 / Digistore sid1) e uma venda de teste."
            : "Configure o aviso de vendas em Integrações → Vendas da rede e faça uma venda de teste.",
      href: "/integracoes/postback",
    },
    {
      id: "google_ads",
      ok: googleOk,
      title: "Google Ads (custo do período)",
      detail: googleOk
        ? "Conta Google ligada. O retorno só aparece se o Google deixar ler o custo."
        : "Ligue o Google Ads em Integrações → Google Ads.",
      href: "/integracoes/google-ads",
    },
    {
      id: "cost_sync",
      ok: costOk,
      title: "Custos do período",
      detail: costOk
        ? `Última actualização ${last_cost_sync_at ? new Date(last_cost_sync_at).toLocaleString("pt-PT") : ""}`
        : "Ainda sem custo do período. Ligue o Google Ads ou actualize os custos.",
      href: "/integracoes/automizer",
    },
    {
      id: "attribution",
      ok: approved === 0 || (attribution_rate != null && attribution_rate >= 80),
      title: "Vendas ligadas ao clique",
      detail:
        approved === 0
          ? "Sem vendas no período."
          : `${attributed} de ${approved} vendas estão ligadas a um clique (${attribution_rate ?? 0}%). ${unattr} sem clique.`,
      href: "/resultados/conversoes",
    },
    {
      id: "macros",
      ok: macroClicksInPeriod === 0,
      title: "Link do anúncio",
      detail:
        macroClicksInPeriod === 0
          ? "Os links do período trazem a palavra-chave e o anúncio."
          : `${macroClicksInPeriod} clique(s) chegaram com o link por preencher. Confirme o endereço do anúncio.`,
      href: "/tracking/url-builder",
    },
    {
      id: "domain_https",
      ok:
        domainGoLive.verified_hosting === 0 ||
        domainGoLive.ad_ready_hosting > 0,
      title: "Domínio pronto para anúncios (HTTPS)",
      detail:
        domainGoLive.verified_hosting === 0
          ? "A usar o domínio da app — OK para testes. Para Final URL própria, verifique o domínio e aguarde HTTPS pronto."
          : domainGoLive.ad_ready_hosting > 0
            ? `${domainGoLive.ad_ready_hosting} domínio(s) hosting pronto(s) para Final URL.`
            : domainGoLive.misconfigured > 0
              ? "DNS mal configurado na Vercel — corrija o CNAME/A em Configurações → Domínios."
              : domainGoLive.ssl_provisioning > 0
                ? "DNS verificado, mas o SSL ainda está a provisionar — não use esse hostname em anúncios até «HTTPS pronto»."
                : "Domínio verificado sem HTTPS pronto. Abra Configurações → Domínios.",
      href: "/configuracoes",
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
