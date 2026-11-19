/**
 * Termos de pesquisa (search_term_view) + adicionar como negativa de campanha.
 * Fluxo afiliado: ver desperdício → negar aqui, sem abrir ads.google.com.
 */
import type { PaidAdsMatchType } from "@prisma/client";
import { runGoogleAdsSearch } from "./google-ads.api";
import {
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  resolveGoogleAdsAccess,
  resolveGoogleAdsDateRange,
  deriveMetricRates,
} from "./google-ads-connection";
import { prisma } from "./paidPrisma";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchGoogleAdsSearchTerms(
  projectId: string,
  localCampaignId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: localCampaignId, projectId, platform: "google_ads" },
    select: {
      id: true,
      name: true,
      externalCampaignId: true,
      campaignNegativeKeywords: { select: { text: true, matchType: true } },
    },
  });
  if (!camp) return { ok: false as const, error: "Campanha não encontrada.", code: "not_found" };
  if (!camp.externalCampaignId) {
    return {
      ok: false as const,
      error: "Campanha ainda sem ID Google — publique primeiro para ver termos de pesquisa.",
      code: "not_published",
    };
  }

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const extId = camp.externalCampaignId.replace(/\D/g, "");
  const q = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM search_term_view
    WHERE campaign.id = ${extId}
      AND segments.date BETWEEN '${range.from}' AND '${range.to}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (s.error) {
    return {
      ok: false as const,
      error: s.error.message ?? "Falha ao ler termos de pesquisa na Google Ads API.",
      code: "gaql_error",
    };
  }

  const existingNeg = new Set(
    camp.campaignNegativeKeywords.map((n) => n.text.trim().toLowerCase()).filter(Boolean),
  );

  const terms = (Array.isArray(s.results) ? s.results : []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const st = (row.searchTermView ?? row.search_term_view ?? {}) as {
      searchTerm?: string;
      status?: string;
    };
    const met = (row.metrics ?? {}) as Record<string, unknown>;
    const text = String(st.searchTerm ?? "").trim();
    const metrics = deriveMetricRates({
      impressions: num(met.impressions),
      clicks: num(met.clicks),
      cost_micros: num(met.cost_micros),
      conversions: num(met.conversions),
      conversions_value: num(met.conversions_value),
    });
    return {
      search_term: text,
      status: st.status ?? null,
      metrics,
      already_negative: existingNeg.has(text.toLowerCase()),
      waste_candidate: metrics.cost_micros >= 5_000_000 && metrics.conversions < 0.5,
    };
  }).filter((t) => t.search_term.length > 0);

  return {
    ok: true as const,
    campaign_id: camp.id,
    campaign_name: camp.name,
    external_campaign_id: extId,
    range,
    terms,
    source: "google_ads_api" as const,
  };
}

export async function fetchGoogleAdsKeywordMetrics(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads", status: { not: "archived" } },
    include: {
      adGroups: { include: { keywords: true } },
    },
  });

  const ctx = await resolveGoogleAdsAccess(projectId);
  const byCriterion = new Map<string, ReturnType<typeof deriveMetricRates>>();

  if (ctx.ok) {
    const criterionIds: string[] = [];
    for (const c of local) {
      for (const ag of c.adGroups) {
        for (const kw of ag.keywords) {
          const id = kw.externalCriterionId?.replace(/\D/g, "");
          if (id) criterionIds.push(id);
        }
      }
    }
    if (criterionIds.length > 0) {
      // Limitar IN clause
      const chunk = criterionIds.slice(0, 200);
      const q = `
        SELECT
          ad_group_criterion.criterion_id,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM keyword_view
        WHERE ad_group_criterion.criterion_id IN (${chunk.join(",")})
          AND segments.date BETWEEN '${range.from}' AND '${range.to}'
      `;
      const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, GOOGLE_ADS_LOGIN_CUSTOMER_ID);
      if (s.error) {
        return { ok: false as const, error: s.error.message ?? "Falha ao ler métricas de keywords.", code: "gaql_error" };
      }
      for (const raw of Array.isArray(s.results) ? s.results : []) {
        const row = raw as Record<string, unknown>;
        const crit = (row.adGroupCriterion ?? row.ad_group_criterion ?? {}) as { criterionId?: string };
        const id = String(crit.criterionId ?? "").replace(/\D/g, "");
        if (!id) continue;
        const met = (row.metrics ?? {}) as Record<string, unknown>;
        const cur = deriveMetricRates({
          impressions: num(met.impressions),
          clicks: num(met.clicks),
          cost_micros: num(met.cost_micros),
          conversions: num(met.conversions),
          conversions_value: num(met.conversions_value),
        });
        const prev = byCriterion.get(id);
        byCriterion.set(
          id,
          prev
            ? deriveMetricRates({
                impressions: prev.impressions + cur.impressions,
                clicks: prev.clicks + cur.clicks,
                cost_micros: prev.cost_micros + cur.cost_micros,
                conversions: prev.conversions + cur.conversions,
                conversions_value: prev.conversions_value + cur.conversions_value,
              })
            : cur,
        );
      }
    }
  }

  const keywords = local.flatMap((c) =>
    c.adGroups.flatMap((ag) =>
      ag.keywords.map((kw) => {
        const ext = kw.externalCriterionId?.replace(/\D/g, "") ?? null;
        return {
          id: kw.id,
          text: kw.text,
          match_type: kw.matchType,
          status: kw.status,
          campaign_id: c.id,
          campaign_name: c.name,
          ad_group_id: ag.id,
          ad_group_name: ag.name,
          external_criterion_id: ext,
          metrics: ext ? byCriterion.get(ext) ?? null : null,
        };
      }),
    ),
  );

  return {
    ok: true as const,
    connected: ctx.ok,
    connection_error: ctx.ok ? null : ctx.error,
    range,
    keywords,
    source: ctx.ok ? ("google_ads_api" as const) : ("local_only" as const),
  };
}

/**
 * Merge seguro: lista actual + novos termos (sem mutar a API).
 * A aplicação passa por `sync_campaign_negative_keywords` (Copilot/Autopilot).
 */
export async function mergeCampaignNegativesWithNewTerms(
  projectId: string,
  campaignId: string,
  terms: Array<{ text: string; match_type?: PaidAdsMatchType }>,
): Promise<
  | {
      ok: true;
      added: number;
      keywords: Array<{ text: string; match_type: PaidAdsMatchType }>;
    }
  | { ok: false; error: string }
> {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    include: { campaignNegativeKeywords: true },
  });
  if (!camp) return { ok: false, error: "Campanha não encontrada." };
  if (!camp.externalCampaignId) return { ok: false, error: "Campanha não publicada na Google." };

  const merged = new Map<string, { text: string; match_type: PaidAdsMatchType }>();
  for (const n of camp.campaignNegativeKeywords) {
    const text = n.text.trim();
    if (!text) continue;
    merged.set(text.toLowerCase(), { text, match_type: n.matchType });
  }
  let added = 0;
  for (const t of terms) {
    const text = String(t.text ?? "").trim().slice(0, 80);
    if (!text) continue;
    const key = text.toLowerCase();
    if (merged.has(key)) continue;
    merged.set(key, { text, match_type: t.match_type ?? "phrase" });
    added += 1;
  }
  return { ok: true, added, keywords: [...merged.values()] };
}
