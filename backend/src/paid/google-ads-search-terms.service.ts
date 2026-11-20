/**
 * Termos de pesquisa (search_term_view) + adicionar como negativa de campanha.
 * Fluxo afiliado: ver desperdício → negar aqui, sem abrir ads.google.com.
 */
import type { PaidAdsMatchType } from "@prisma/client";
import { runGoogleAdsSearch } from "./google-ads.api";
import {
  resolveGoogleAdsAccess,
  resolveGoogleAdsDateRange,
  deriveMetricRates,
} from "./google-ads-connection";
import { normalizeGoogleCriterionId } from "./google-ads-ids";
import { parseGoogleAdsMetrics } from "./google-ads-metric-fields";
import { prisma } from "./paidPrisma";

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
      adGroups: { select: { negativeKeywords: { select: { text: true } } } },
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
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
  if (s.error) {
    return {
      ok: false as const,
      error: s.error.message ?? "Falha ao ler termos de pesquisa na Google Ads API.",
      code: "gaql_error",
    };
  }

  const existingNeg = collectNegativeKeywordTexts({
    campaignNegatives: camp.campaignNegativeKeywords,
    adGroupNegatives: camp.adGroups.flatMap((ag) => ag.negativeKeywords),
  });

  const terms = (Array.isArray(s.results) ? s.results : []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const st = (row.searchTermView ?? row.search_term_view ?? {}) as {
      searchTerm?: string;
      status?: string;
    };
    const text = String(st.searchTerm ?? "").trim();
    const metrics = deriveMetricRates(parseGoogleAdsMetrics(row));
    return {
      search_term: text,
      status: st.status ?? null,
      metrics,
      already_negative: existingNeg.has(text.toLowerCase()),
      waste_candidate: isSearchTermWasteCandidate(metrics.cost_micros, metrics.conversions),
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

/** Candidato a desperdício: gasto ≥ $5 e < 0.5 conversões no período. */
export function isSearchTermWasteCandidate(costMicros: number, conversions: number): boolean {
  return costMicros >= 5_000_000 && conversions < 0.5;
}

/** Textos de negativas (campanha + grupos) para marcar `already_negative`. */
export function collectNegativeKeywordTexts(input: {
  campaignNegatives: Array<{ text: string }>;
  adGroupNegatives?: Array<{ text: string }>;
}): Set<string> {
  const out = new Set<string>();
  for (const n of input.campaignNegatives) {
    const t = n.text.trim().toLowerCase();
    if (t) out.add(t);
  }
  for (const n of input.adGroupNegatives ?? []) {
    const t = n.text.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}

/**
 * Termos de pesquisa nas campanhas Google publicadas do projecto (uma GAQL).
 * Opcional: `campaign_id` local — filtra na query (não só no browser).
 */
export async function fetchGoogleAdsProjectSearchTerms(
  projectId: string,
  preset: string,
  customFrom?: string,
  customTo?: string,
  opts?: { waste_only?: boolean; limit?: number; campaign_id?: string },
) {
  const range = resolveGoogleAdsDateRange(preset, customFrom, customTo);
  if ("error" in range) return { ok: false as const, error: range.error, code: "invalid_range" };

  const filterLocalId = opts?.campaign_id?.trim() || null;

  const camps = await prisma.paidAdsCampaign.findMany({
    where: {
      projectId,
      platform: "google_ads",
      status: { not: "archived" },
      externalCampaignId: { not: null },
      ...(filterLocalId ? { id: filterLocalId } : {}),
    },
    select: {
      id: true,
      name: true,
      externalCampaignId: true,
      status: true,
      campaignNegativeKeywords: { select: { text: true, matchType: true } },
      adGroups: { select: { negativeKeywords: { select: { text: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: filterLocalId ? 1 : 80,
  });

  /** Lista para o select do hub — sempre todas as publicadas do projecto. */
  const allPublished = filterLocalId
    ? await prisma.paidAdsCampaign.findMany({
        where: {
          projectId,
          platform: "google_ads",
          status: { not: "archived" },
          externalCampaignId: { not: null },
        },
        select: { id: true, name: true, externalCampaignId: true },
        orderBy: { name: "asc" },
        take: 80,
      })
    : camps.map((c) => ({
        id: c.id,
        name: c.name,
        externalCampaignId: c.externalCampaignId,
      }));

  const campaignOptions = allPublished
    .map((c) => {
      const ext = (c.externalCampaignId ?? "").replace(/\D/g, "");
      if (!ext) return null;
      return { id: c.id, name: c.name, external_campaign_id: ext };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (filterLocalId && camps.length === 0) {
    return { ok: false as const, error: "Campanha não encontrada neste projecto.", code: "not_found" };
  }

  if (camps.length === 0) {
    return {
      ok: true as const,
      connected: false,
      connection_error: null as string | null,
      range,
      filter_campaign_id: null as string | null,
      campaigns: [] as Array<{ id: string; name: string; external_campaign_id: string }>,
      terms: [] as Array<{
        campaign_id: string;
        campaign_name: string;
        external_campaign_id: string;
        search_term: string;
        status: string | null;
        metrics: ReturnType<typeof deriveMetricRates>;
        already_negative: boolean;
        waste_candidate: boolean;
      }>,
      totals: { rows: 0, waste: 0, campaigns_with_terms: 0, published_campaigns: 0 },
      source: "local_only" as const,
      note: "Ainda não há campanhas Google no ar neste projecto. Publique ou importe uma campanha de pesquisa primeiro.",
    };
  }

  const byExt = new Map<
    string,
    {
      id: string;
      name: string;
      externalCampaignId: string;
      negatives: Set<string>;
    }
  >();
  for (const c of camps) {
    const ext = (c.externalCampaignId ?? "").replace(/\D/g, "");
    if (!ext) continue;
    byExt.set(ext, {
      id: c.id,
      name: c.name,
      externalCampaignId: ext,
      negatives: collectNegativeKeywordTexts({
        campaignNegatives: c.campaignNegativeKeywords,
        adGroupNegatives: c.adGroups.flatMap((ag) => ag.negativeKeywords),
      }),
    });
  }

  if (filterLocalId && byExt.size === 0) {
    return {
      ok: false as const,
      error: "Campanha ainda sem ID Google — publique ou importe primeiro.",
      code: "not_published",
    };
  }

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) {
    return {
      ok: false as const,
      error: ctx.error,
      code: ctx.code,
    };
  }

  const limit = Math.min(Math.max(opts?.limit ?? 400, 50), 500);
  const scopedExtIds = [...byExt.keys()];
  const IN_CHUNK = 25;
  const rawRows: Record<string, unknown>[] = [];
  let gaqlError: string | null = null;
  for (let i = 0; i < scopedExtIds.length; i += IN_CHUNK) {
    const chunk = scopedExtIds.slice(i, i + IN_CHUNK);
    const campaignClause =
      chunk.length === 1 ? `campaign.id = ${chunk[0]}` : `campaign.id IN (${chunk.join(",")})`;
    const q = `
      SELECT
        campaign.id,
        campaign.name,
        search_term_view.search_term,
        search_term_view.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM search_term_view
      WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
        AND ${campaignClause}
      ORDER BY metrics.cost_micros DESC
      LIMIT ${limit}
    `;
    const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
    if (s.error) {
      gaqlError = s.error.message ?? "Falha ao ler termos de pesquisa na Google Ads API.";
      break;
    }
    for (const raw of Array.isArray(s.results) ? s.results : []) {
      rawRows.push(raw as Record<string, unknown>);
    }
  }
  if (gaqlError && rawRows.length === 0) {
    return {
      ok: false as const,
      error: gaqlError,
      code: "gaql_error",
    };
  }

  const campaignsTouched = new Set<string>();
  let terms = rawRows
    .map((row) => {
      const camp = (row.campaign ?? {}) as { id?: string; name?: string };
      const st = (row.searchTermView ?? row.search_term_view ?? {}) as {
        searchTerm?: string;
        status?: string;
      };
      const extId = String(camp.id ?? "").replace(/\D/g, "");
      const local = byExt.get(extId);
      if (!local) return null;
      const text = String(st.searchTerm ?? "").trim();
      if (!text) return null;
      const metrics = deriveMetricRates(parseGoogleAdsMetrics(row));
      campaignsTouched.add(local.id);
      return {
        campaign_id: local.id,
        campaign_name: local.name || String(camp.name ?? ""),
        external_campaign_id: extId,
        search_term: text,
        status: st.status ?? null,
        metrics,
        already_negative: local.negatives.has(text.toLowerCase()),
        waste_candidate: isSearchTermWasteCandidate(metrics.cost_micros, metrics.conversions),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null)
    .sort((a, b) => b.metrics.cost_micros - a.metrics.cost_micros)
    .slice(0, limit);

  if (opts?.waste_only) {
    terms = terms.filter((t) => t.waste_candidate && !t.already_negative);
  }

  const wasteCount = terms.filter((t) => t.waste_candidate && !t.already_negative).length;

  return {
    ok: true as const,
    connected: true,
    connection_error: null as string | null,
    range,
    filter_campaign_id: filterLocalId,
    campaigns: campaignOptions,
    terms,
    totals: {
      rows: terms.length,
      waste: wasteCount,
      campaigns_with_terms: campaignsTouched.size,
      published_campaigns: campaignOptions.length,
    },
    source: "google_ads_api" as const,
    note: null as string | null,
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
  let gaqlRan = false;
  let metricsError: string | null = null;

  if (ctx.ok) {
    const criterionIds: string[] = [];
    for (const c of local) {
      for (const ag of c.adGroups) {
        for (const kw of ag.keywords) {
          const id = normalizeGoogleCriterionId(kw.externalCriterionId);
          if (id) criterionIds.push(id);
        }
      }
    }
    const unique = [...new Set(criterionIds)];
    if (unique.length > 0) {
      // Limitar IN clause
      const chunk = unique.slice(0, 200);
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
      const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
      if (s.error) {
        /** Não esconder a lista local — toast GAQL completo partia a UX. */
        metricsError =
          "Métricas Google indisponíveis (IDs de keyword inválidos ou rede). A lista local mantém-se; re-sincronize a campanha se faltar dados.";
      } else {
        gaqlRan = true;
        for (const raw of Array.isArray(s.results) ? s.results : []) {
          const row = raw as Record<string, unknown>;
          const crit = (row.adGroupCriterion ?? row.ad_group_criterion ?? {}) as {
            criterionId?: string;
          };
          const id = normalizeGoogleCriterionId(crit.criterionId);
          if (!id) continue;
          const cur = deriveMetricRates(parseGoogleAdsMetrics(row));
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
  }

  const keywords = local.flatMap((c) =>
    c.adGroups.flatMap((ag) =>
      ag.keywords.map((kw) => {
        const ext = normalizeGoogleCriterionId(kw.externalCriterionId);
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
          metrics: ext && gaqlRan ? byCriterion.get(ext) ?? null : null,
        };
      }),
    ),
  );

  return {
    ok: true as const,
    connected: ctx.ok,
    connection_error: ctx.ok ? metricsError : ctx.error,
    range,
    keywords,
    /** Só «google_ads_api» depois de GAQL real — lista local sem critério ≠ inventário Google. */
    source: gaqlRan ? ("google_ads_api" as const) : ("local_only" as const),
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
    include: {
      campaignNegativeKeywords: true,
      adGroups: { select: { negativeKeywords: { select: { text: true } } } },
    },
  });
  if (!camp) return { ok: false, error: "Campanha não encontrada." };
  if (!camp.externalCampaignId) return { ok: false, error: "Campanha não publicada na Google." };

  const alreadyBlocked = collectNegativeKeywordTexts({
    campaignNegatives: camp.campaignNegativeKeywords,
    adGroupNegatives: camp.adGroups.flatMap((ag) => ag.negativeKeywords),
  });

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
    if (merged.has(key) || alreadyBlocked.has(key)) continue;
    merged.set(key, { text, match_type: t.match_type ?? "phrase" });
    added += 1;
  }
  return { ok: true, added, keywords: [...merged.values()] };
}
