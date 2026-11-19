/**
 * Importa / sincroniza estrutura Search da conta Google → paid_ads_*.
 * Permite gerir na Dclickora campanhas criadas fora da app.
 */
import type { PaidAdsCampaignStatus, PaidAdsEntityStatus, PaidAdsMatchType, Prisma } from "@prisma/client";
import { runGoogleAdsSearch } from "./google-ads.api";
import { parseGoogleBudgetShareFromRow } from "./google-ads-budget";
import { resolveGoogleAdsAccess } from "./google-ads-connection";
import { isoFromGoogleGeoCriterionId } from "./geo-google";
import { isoFromGoogleLanguageConstantId } from "./language-google";
import { prisma } from "./paidPrisma";

function numId(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function mapCampaignStatus(s: string | undefined): PaidAdsCampaignStatus {
  const u = (s ?? "").toUpperCase();
  if (u === "ENABLED") return "live";
  if (u === "PAUSED" || u === "SUSPENDED") return "paused";
  if (u === "REMOVED") return "archived";
  /** Desconhecido ≠ ENABLED — não inventar «activa». */
  return "paused";
}

function mapEntityStatus(s: string | undefined): PaidAdsEntityStatus {
  const u = (s ?? "").toUpperCase();
  if (u === "ENABLED") return "live";
  if (u === "PAUSED") return "paused";
  if (u === "REMOVED") return "archived";
  return "paused";
}

function mapMatchType(s: string | undefined): PaidAdsMatchType {
  const u = (s ?? "").toUpperCase();
  if (u === "EXACT") return "exact";
  if (u === "BROAD") return "broad";
  return "phrase";
}

function asJson(v: unknown): Prisma.InputJsonValue {
  return (v ?? []) as Prisma.InputJsonValue;
}

export type RemoteGoogleCampaignSummary = {
  external_campaign_id: string;
  name: string;
  status: string;
  channel_type: string;
  daily_budget_micros: number | null;
  budget_shared: boolean;
  budget_reference_count: number;
  budget_editable: boolean;
  already_imported: boolean;
  local_campaign_id: string | null;
};

/** Lista campanhas SEARCH da conta (exclui REMOVED). */
export async function listRemoteGoogleSearchCampaigns(projectId: string) {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const local = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads", externalCampaignId: { not: null } },
    select: { id: true, externalCampaignId: true },
  });
  const byExt = new Map(
    local
      .map((c) => [c.externalCampaignId!.replace(/\D/g, ""), c.id] as const)
      .filter(([id]) => Boolean(id)),
  );

  /** Query mínima primeiro — campos de orçamento partilhado falham em algumas contas. */
  const qMinimal = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    LIMIT 200
  `;
  let s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, qMinimal, ctx.loginCustomerId);
  if (s.error) {
    return {
      ok: false as const,
      error:
        s.error.message ??
        `Falha ao listar campanhas remotas (conta ${ctx.customerId}). Confirme o customer ID em Integrações.`,
      code: "gaql_error",
    };
  }

  const qBudget = `
    SELECT
      campaign.id,
      campaign_budget.amount_micros,
      campaign_budget.explicitly_shared,
      campaign_budget.reference_count
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    LIMIT 200
  `;
  const budgetS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, qBudget, ctx.loginCustomerId);
  const budgetById = new Map<
    string,
    { amount_micros: number | null; explicitly_shared: boolean; reference_count: number; budget_editable: boolean }
  >();
  if (!budgetS.error) {
    for (const raw of Array.isArray(budgetS.results) ? budgetS.results : []) {
      const row = raw as Record<string, unknown>;
      const camp = (row.campaign ?? {}) as { id?: string };
      const ext = numId(camp.id);
      if (!ext) continue;
      const share = parseGoogleBudgetShareFromRow(row);
      budgetById.set(ext, {
        amount_micros: share.amount_micros,
        explicitly_shared: share.explicitly_shared,
        reference_count: share.reference_count,
        budget_editable: share.budget_editable,
      });
    }
  }

  const campaigns: RemoteGoogleCampaignSummary[] = [];
  for (const raw of Array.isArray(s.results) ? s.results : []) {
    const row = raw as Record<string, unknown>;
    const camp = (row.campaign ?? {}) as {
      id?: string;
      name?: string;
      status?: string;
      advertisingChannelType?: string;
    };
    const ext = numId(camp.id);
    if (!ext) continue;
    /** Listamos todos os tipos — o afiliado vê a conta real; import Search só aplica SEARCH. */
    const channel = String(camp.advertisingChannelType ?? "").toUpperCase() || "UNKNOWN";
    const share = budgetById.get(ext);
    const localId = byExt.get(ext) ?? null;
    campaigns.push({
      external_campaign_id: ext,
      name: String(camp.name ?? `Campaign ${ext}`),
      status: String(camp.status ?? ""),
      channel_type: channel,
      daily_budget_micros: share?.amount_micros ?? null,
      budget_shared: share?.explicitly_shared ?? false,
      budget_reference_count: share?.reference_count ?? 1,
      /** Só editável quando a Google devolveu metadados de orçamento. */
      budget_editable: share ? share.budget_editable : false,
      already_imported: Boolean(localId),
      local_campaign_id: localId,
    });
  }

  campaigns.sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: true as const,
    customer_id: ctx.customerId,
    account_name: ctx.accountName,
    campaigns,
    totals: {
      remote: campaigns.length,
      imported: campaigns.filter((c) => c.already_imported).length,
      new: campaigns.filter((c) => !c.already_imported).length,
    },
  };
}

type ImportCounts = {
  ad_groups: number;
  keywords: number;
  ads: number;
  campaign_negatives: number;
  ad_group_negatives: number;
};

async function pullStructureIntoLocalCampaign(
  projectId: string,
  ownerUserId: string,
  externalCampaignId: string,
  opts: { localCampaignId?: string; refreshExisting?: boolean },
): Promise<
  | { ok: true; campaign_id: string; created: boolean; counts: ImportCounts; name: string; status: string }
  | { ok: false; error: string }
> {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ext = externalCampaignId.replace(/\D/g, "");
  if (!ext) return { ok: false, error: "ID de campanha Google inválido." };

  const campQ = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${ext}
    LIMIT 1
  `;
  const campS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, campQ, ctx.loginCustomerId);
  if (campS.error) return { ok: false, error: campS.error.message ?? "Falha ao ler campanha." };
  const campRow = (campS.results?.[0] ?? null) as Record<string, unknown> | null;
  if (!campRow) return { ok: false, error: "Campanha não encontrada na conta Google." };
  const camp = (campRow.campaign ?? {}) as {
    name?: string;
    status?: string;
    advertisingChannelType?: string;
  };
  if (String(camp.advertisingChannelType ?? "").toUpperCase() !== "SEARCH") {
    return { ok: false, error: "Só é suportado importar campanhas Search neste momento." };
  }
  const budget = (campRow.campaignBudget ?? campRow.campaign_budget ?? {}) as { amountMicros?: string | number };
  const dailyBudgetMicros = budget.amountMicros != null ? BigInt(Math.round(Number(budget.amountMicros))) : null;
  const status = mapCampaignStatus(camp.status);
  const name = String(camp.name ?? `Search ${ext}`).slice(0, 250);

  let localId = opts.localCampaignId;
  let created = false;

  if (!localId) {
    const existing = await prisma.paidAdsCampaign.findFirst({
      where: { projectId, platform: "google_ads", externalCampaignId: ext },
      select: { id: true },
    });
    localId = existing?.id;
  }

  if (localId) {
    await prisma.paidAdsCampaign.update({
      where: { id: localId },
      data: {
        name,
        status,
        dailyBudgetMicros,
        externalCampaignId: ext,
      },
    });
    if (opts.refreshExisting) {
      // Reconstruir estrutura: limpar filhos e reimportar
      await prisma.paidAdsAdGroup.deleteMany({ where: { campaignId: localId } });
      await prisma.paidAdsCampaignNegativeKeyword.deleteMany({ where: { campaignId: localId } });
    }
  } else {
    const row = await prisma.paidAdsCampaign.create({
      data: {
        userId: ownerUserId,
        projectId,
        platform: "google_ads",
        name,
        status,
        dailyBudgetMicros,
        externalCampaignId: ext,
        geoTargets: [],
        languageTargets: [],
        biddingConfig: { imported_from_google: true },
        optimizerFlags: {},
        objectiveSummary: "Importada da conta Google Ads",
      },
    });
    localId = row.id;
    created = true;
  }

  const counts: ImportCounts = {
    ad_groups: 0,
    keywords: 0,
    ads: 0,
    campaign_negatives: 0,
    ad_group_negatives: 0,
  };

  // Ad groups
  const agQ = `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.cpc_bid_micros
    FROM ad_group
    WHERE campaign.id = ${ext}
      AND ad_group.status != 'REMOVED'
    LIMIT 100
  `;
  const agS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, agQ, ctx.loginCustomerId);
  if (agS.error) return { ok: false, error: agS.error.message ?? "Falha ao ler grupos." };

  const adGroupLocalByExt = new Map<string, string>();

  for (const raw of Array.isArray(agS.results) ? agS.results : []) {
    const row = raw as Record<string, unknown>;
    const ag = (row.adGroup ?? row.ad_group ?? {}) as {
      id?: string;
      name?: string;
      status?: string;
      cpcBidMicros?: string | number;
    };
    const agExt = numId(ag.id);
    if (!agExt) continue;

    let localAgId: string | undefined;
    if (!opts.refreshExisting && !created) {
      const existingAg = await prisma.paidAdsAdGroup.findFirst({
        where: { campaignId: localId, externalAdGroupId: agExt },
        select: { id: true },
      });
      if (existingAg) {
        await prisma.paidAdsAdGroup.update({
          where: { id: existingAg.id },
          data: {
            name: String(ag.name ?? "Ad group").slice(0, 255),
            status: mapEntityStatus(ag.status),
            cpcBidMicros: ag.cpcBidMicros != null ? BigInt(Math.round(Number(ag.cpcBidMicros))) : null,
          },
        });
        localAgId = existingAg.id;
      }
    }
    if (!localAgId) {
      const nag = await prisma.paidAdsAdGroup.create({
        data: {
          campaignId: localId,
          name: String(ag.name ?? "Ad group").slice(0, 255),
          status: mapEntityStatus(ag.status),
          externalAdGroupId: agExt,
          cpcBidMicros: ag.cpcBidMicros != null ? BigInt(Math.round(Number(ag.cpcBidMicros))) : null,
        },
      });
      localAgId = nag.id;
      counts.ad_groups += 1;
    }
    adGroupLocalByExt.set(agExt, localAgId);
  }

  // Keywords (positivas)
  const kwQ = `
    SELECT
      ad_group.id,
      ad_group_criterion.criterion_id,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type
    FROM keyword_view
    WHERE campaign.id = ${ext}
      AND ad_group_criterion.status != 'REMOVED'
      AND ad_group_criterion.negative = FALSE
    LIMIT 2000
  `;
  const kwS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, kwQ, ctx.loginCustomerId);
  if (kwS.error) return { ok: false, error: kwS.error.message ?? "Falha ao ler keywords." };

  const kwCreates: Array<{
    adGroupId: string;
    text: string;
    matchType: PaidAdsMatchType;
    status: PaidAdsEntityStatus;
    externalCriterionId: string;
  }> = [];
  for (const raw of Array.isArray(kwS.results) ? kwS.results : []) {
    const row = raw as Record<string, unknown>;
    const ag = (row.adGroup ?? row.ad_group ?? {}) as { id?: string };
    const crit = (row.adGroupCriterion ?? row.ad_group_criterion ?? {}) as {
      criterionId?: string;
      status?: string;
      keyword?: { text?: string; matchType?: string };
    };
    const agExt = numId(ag.id);
    const localAg = adGroupLocalByExt.get(agExt);
    if (!localAg) continue;
    const critId = numId(crit.criterionId);
    const text = String(crit.keyword?.text ?? "").trim().slice(0, 80);
    if (!text || !critId) continue;
    kwCreates.push({
      adGroupId: localAg,
      text,
      matchType: mapMatchType(crit.keyword?.matchType),
      status: mapEntityStatus(crit.status),
      externalCriterionId: critId,
    });
  }
  if (created || opts.refreshExisting) {
    if (kwCreates.length > 0) {
      await prisma.paidAdsKeyword.createMany({ data: kwCreates });
      counts.keywords += kwCreates.length;
    }
  } else {
    for (const kw of kwCreates) {
      const existingKw = await prisma.paidAdsKeyword.findFirst({
        where: { adGroupId: kw.adGroupId, externalCriterionId: kw.externalCriterionId },
        select: { id: true },
      });
      if (existingKw) {
        await prisma.paidAdsKeyword.update({
          where: { id: existingKw.id },
          data: { text: kw.text, matchType: kw.matchType, status: kw.status },
        });
      } else {
        await prisma.paidAdsKeyword.create({ data: kw });
        counts.keywords += 1;
      }
    }
  }

  // RSA ads + policy
  const adQ = `
    SELECT
      ad_group.id,
      ad_group_ad.ad.id,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2,
      ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.id = ${ext}
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
    LIMIT 500
  `;
  const adS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, adQ, ctx.loginCustomerId);
  if (adS.error) return { ok: false, error: adS.error.message ?? "Falha ao ler anúncios." };

  for (const raw of Array.isArray(adS.results) ? adS.results : []) {
    const row = raw as Record<string, unknown>;
    const ag = (row.adGroup ?? row.ad_group ?? {}) as { id?: string };
    const aga = (row.adGroupAd ?? row.ad_group_ad ?? {}) as {
      status?: string;
      policySummary?: { approvalStatus?: string };
      ad?: {
        id?: string;
        finalUrls?: string[];
        responsiveSearchAd?: {
          headlines?: Array<{ text?: string }>;
          descriptions?: Array<{ text?: string }>;
          path1?: string;
          path2?: string;
        };
      };
    };
    const agExt = numId(ag.id);
    const localAg = adGroupLocalByExt.get(agExt);
    if (!localAg) continue;
    const adId = numId(aga.ad?.id);
    if (!adId) continue;
    const rsa = aga.ad?.responsiveSearchAd;
    const headlines = (rsa?.headlines ?? []).map((h) => String(h.text ?? "").trim()).filter(Boolean).slice(0, 15);
    const descriptions = (rsa?.descriptions ?? []).map((d) => String(d.text ?? "").trim()).filter(Boolean).slice(0, 4);
    const finalUrls = (aga.ad?.finalUrls ?? []).map((u) => String(u).trim()).filter(Boolean);
    const approval = aga.policySummary?.approvalStatus;

    const existingAd = await prisma.paidAdsRsa.findFirst({
      where: { adGroupId: localAg, externalAdId: adId },
      select: { id: true },
    });
    const data = {
      headlines: asJson(headlines),
      descriptions: asJson(descriptions),
      finalUrls: asJson(finalUrls),
      displayPath1: rsa?.path1?.slice(0, 15) ?? null,
      displayPath2: rsa?.path2?.slice(0, 15) ?? null,
      status: mapEntityStatus(aga.status),
      // Guarda approval no JSON de headlines? Melhor: biddingConfig não. Usar optimizerFlags no campaign? 
      // Guardamos approval num campo virtual via descriptions metadata — na verdade schema não tem.
      // Mantemos status local; approval devolve-se via endpoint de policy separado.
    };
    void approval; // usado no endpoint de policy overlay
    if (existingAd) {
      await prisma.paidAdsRsa.update({ where: { id: existingAd.id }, data });
    } else {
      await prisma.paidAdsRsa.create({
        data: {
          adGroupId: localAg,
          ...data,
          externalAdId: adId,
        },
      });
      counts.ads += 1;
    }
  }

  // Campaign negatives
  const negQ = `
    SELECT
      campaign_criterion.criterion_id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type
    FROM campaign_criterion
    WHERE campaign.id = ${ext}
      AND campaign_criterion.negative = TRUE
      AND campaign_criterion.type = 'KEYWORD'
      AND campaign_criterion.status != 'REMOVED'
    LIMIT 1000
  `;
  const negS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, negQ, ctx.loginCustomerId);
  if (!negS.error) {
    for (const raw of Array.isArray(negS.results) ? negS.results : []) {
      const row = raw as Record<string, unknown>;
      const crit = (row.campaignCriterion ?? row.campaign_criterion ?? {}) as {
        criterionId?: string;
        keyword?: { text?: string; matchType?: string };
      };
      const critId = numId(crit.criterionId);
      const text = String(crit.keyword?.text ?? "").trim().slice(0, 80);
      if (!text || !critId) continue;
      const existing = await prisma.paidAdsCampaignNegativeKeyword.findFirst({
        where: { campaignId: localId, externalCriterionId: critId },
      });
      if (!existing) {
        await prisma.paidAdsCampaignNegativeKeyword.create({
          data: {
            campaignId: localId,
            text,
            matchType: mapMatchType(crit.keyword?.matchType),
            externalCriterionId: critId,
          },
        });
        counts.campaign_negatives += 1;
      }
    }
  }

  // Ad-group negatives (keyword_view com negative = TRUE)
  const agNegQ = `
    SELECT
      ad_group.id,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type
    FROM keyword_view
    WHERE campaign.id = ${ext}
      AND ad_group_criterion.negative = TRUE
      AND ad_group_criterion.status != 'REMOVED'
    LIMIT 2000
  `;
  const agNegS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, agNegQ, ctx.loginCustomerId);
  if (!agNegS.error) {
    for (const raw of Array.isArray(agNegS.results) ? agNegS.results : []) {
      const row = raw as Record<string, unknown>;
      const ag = (row.adGroup ?? row.ad_group ?? {}) as { id?: string };
      const crit = (row.adGroupCriterion ?? row.ad_group_criterion ?? {}) as {
        criterionId?: string;
        keyword?: { text?: string; matchType?: string };
      };
      const localAg = adGroupLocalByExt.get(numId(ag.id));
      if (!localAg) continue;
      const critId = numId(crit.criterionId);
      const text = String(crit.keyword?.text ?? "").trim().slice(0, 80);
      if (!text || !critId) continue;
      const existing = await prisma.paidAdsAdGroupNegativeKeyword.findFirst({
        where: { adGroupId: localAg, externalCriterionId: critId },
      });
      if (!existing) {
        await prisma.paidAdsAdGroupNegativeKeyword.create({
          data: {
            adGroupId: localAg,
            text,
            matchType: mapMatchType(crit.keyword?.matchType),
            externalCriterionId: critId,
          },
        });
        counts.ad_group_negatives += 1;
      }
    }
  }

  /** Países / idiomas reais da campanha na Google — sem inventar defaults. */
  const geoInclude: string[] = [];
  const geoExclude: string[] = [];
  const languages: string[] = [];
  const locQ = `
    SELECT
      campaign_criterion.negative,
      campaign_criterion.location.geo_target_constant,
      campaign_criterion.language.language_constant,
      campaign_criterion.type
    FROM campaign_criterion
    WHERE campaign.id = ${ext}
      AND campaign_criterion.type IN ('LOCATION', 'LANGUAGE')
      AND campaign_criterion.status != 'REMOVED'
    LIMIT 200
  `;
  const locS = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, locQ, ctx.loginCustomerId);
  if (!locS.error) {
    for (const raw of Array.isArray(locS.results) ? locS.results : []) {
      const row = raw as Record<string, unknown>;
      const crit = (row.campaignCriterion ?? row.campaign_criterion ?? {}) as {
        negative?: boolean;
        type?: string;
        location?: { geoTargetConstant?: string; geo_target_constant?: string };
        language?: { languageConstant?: string; language_constant?: string };
      };
      const type = String(crit.type ?? "").toUpperCase();
      const loc = crit.location;
      const lang = crit.language;
      const gtcRaw = loc?.geoTargetConstant ?? loc?.geo_target_constant;
      const langRaw = lang?.languageConstant ?? lang?.language_constant;
      if (type === "LOCATION" || gtcRaw) {
        const id = String(gtcRaw ?? "").split("/").pop() ?? "";
        const iso = isoFromGoogleGeoCriterionId(id);
        if (iso) {
          if (crit.negative) {
            if (!geoExclude.includes(iso)) geoExclude.push(iso);
          } else if (!geoInclude.includes(iso)) {
            geoInclude.push(iso);
          }
        }
      }
      if (type === "LANGUAGE" || langRaw) {
        const id = String(langRaw ?? "").split("/").pop() ?? "";
        const iso = isoFromGoogleLanguageConstantId(id);
        if (iso && !languages.includes(iso)) languages.push(iso);
      }
    }
  }

  const prevCamp = await prisma.paidAdsCampaign.findUnique({
    where: { id: localId },
    select: { biddingConfig: true },
  });
  const prevBc: Record<string, unknown> =
    prevCamp?.biddingConfig &&
    typeof prevCamp.biddingConfig === "object" &&
    !Array.isArray(prevCamp.biddingConfig)
      ? { ...(prevCamp.biddingConfig as Record<string, unknown>) }
      : { imported_from_google: true };
  const prevTargeting =
    prevBc.targeting && typeof prevBc.targeting === "object" && !Array.isArray(prevBc.targeting)
      ? { ...(prevBc.targeting as Record<string, unknown>) }
      : {};
  prevBc.targeting = {
    ...prevTargeting,
    geo_exclude: geoExclude,
  };

  await prisma.paidAdsCampaign.update({
    where: { id: localId },
    data: {
      ...(geoInclude.length ? { geoTargets: geoInclude } : {}),
      ...(languages.length ? { languageTargets: languages } : {}),
      biddingConfig: prevBc as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    campaign_id: localId,
    created,
    counts,
    name,
    status,
  };
}

export async function importGoogleSearchCampaigns(
  projectId: string,
  ownerUserId: string,
  externalIds: string[],
  opts?: { refresh_existing?: boolean },
) {
  const unique = [...new Set(externalIds.map((id) => id.replace(/\D/g, "")).filter(Boolean))];
  if (unique.length === 0) return { ok: false as const, error: "Indique pelo menos um ID de campanha." };
  if (unique.length > 25) return { ok: false as const, error: "Máximo 25 campanhas por pedido." };

  const imported: Array<{
    campaign_id: string;
    external_campaign_id: string;
    created: boolean;
    name: string;
    status: string;
    counts: ImportCounts;
  }> = [];
  const errors: Array<{ external_campaign_id: string; error: string }> = [];

  for (const ext of unique) {
    const existing = await prisma.paidAdsCampaign.findFirst({
      where: { projectId, platform: "google_ads", externalCampaignId: ext },
      select: { id: true },
    });
    const r = await pullStructureIntoLocalCampaign(projectId, ownerUserId, ext, {
      localCampaignId: existing?.id,
      refreshExisting: Boolean(opts?.refresh_existing) && Boolean(existing),
    });
    if (!r.ok) {
      errors.push({ external_campaign_id: ext, error: r.error });
      continue;
    }
    imported.push({
      campaign_id: r.campaign_id,
      external_campaign_id: ext,
      created: r.created,
      name: r.name,
      status: r.status,
      counts: r.counts,
    });
  }

  return {
    ok: true as const,
    imported,
    errors,
  };
}

/** Policy / approval RSA para uma campanha local já com external IDs. */
export async function fetchGoogleRsaPolicyStatus(projectId: string, localCampaignId: string) {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: localCampaignId, projectId, platform: "google_ads" },
    select: { externalCampaignId: true, name: true },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false as const, error: "Campanha sem ID Google.", code: "not_published" };
  }
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const ext = camp.externalCampaignId.replace(/\D/g, "");
  const q = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.review_status,
      ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE campaign.id = ${ext}
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status != 'REMOVED'
    LIMIT 200
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
  if (s.error) {
    return { ok: false as const, error: s.error.message ?? "Falha ao ler política dos anúncios.", code: "gaql_error" };
  }

  const ads = (Array.isArray(s.results) ? s.results : []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const aga = (row.adGroupAd ?? row.ad_group_ad ?? {}) as {
      status?: string;
      policySummary?: {
        approvalStatus?: string;
        reviewStatus?: string;
        policyTopicEntries?: Array<{ topic?: string; type?: string }>;
      };
      ad?: { id?: string };
    };
    const topics = (aga.policySummary?.policyTopicEntries ?? [])
      .map((t) => String(t.topic ?? t.type ?? "").trim())
      .filter(Boolean);
    return {
      external_ad_id: numId(aga.ad?.id),
      status: aga.status ?? null,
      approval_status: aga.policySummary?.approvalStatus ?? null,
      review_status: aga.policySummary?.reviewStatus ?? null,
      policy_topics: topics,
      disapproved: String(aga.policySummary?.approvalStatus ?? "").toUpperCase() === "DISAPPROVED",
    };
  });

  return {
    ok: true as const,
    campaign_id: localCampaignId,
    campaign_name: camp.name,
    ads,
    disapproved_count: ads.filter((a) => a.disapproved).length,
  };
}

/**
 * Política RSA em todas as Search publicadas do projecto (uma GAQL).
 * Só leitura — não altera anúncios nem a Final URL.
 */
export async function fetchGoogleRsaPolicyProjectAudit(projectId: string) {
  const camps = await prisma.paidAdsCampaign.findMany({
    where: {
      projectId,
      platform: "google_ads",
      status: { not: "archived" },
      externalCampaignId: { not: null },
    },
    select: { id: true, name: true, externalCampaignId: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const byExt = new Map(
    camps
      .map((c) => {
        const ext = (c.externalCampaignId ?? "").replace(/\D/g, "");
        return ext ? ([ext, c] as const) : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
  );

  if (byExt.size === 0) {
    return {
      ok: true as const,
      connected: false,
      campaigns: [] as Array<{
        campaign_id: string;
        campaign_name: string;
        local_status: string;
        external_campaign_id: string;
        ads_checked: number;
        disapproved_count: number;
        limited_count: number;
        topics: string[];
        severity: "ok" | "warn" | "critical";
      }>,
      totals: { campaigns: 0, disapproved_ads: 0, limited_ads: 0, critical_campaigns: 0 },
      source: "local_only" as const,
      note: "Nenhuma campanha Google publicada. Publique ou importe Search para auditar RSA.",
    };
  }

  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { ok: false as const, error: ctx.error, code: ctx.code };

  const ids = [...byExt.keys()];
  const q = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group_ad.ad.id,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.review_status,
      ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE campaign.id IN (${ids.join(",")})
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status != 'REMOVED'
    LIMIT 500
  `;
  const s = await runGoogleAdsSearch(ctx.access, ctx.customerId, ctx.dev, q, ctx.loginCustomerId);
  if (s.error) {
    return {
      ok: false as const,
      error: s.error.message ?? "Falha ao ler política RSA na Google Ads API.",
      code: "gaql_error",
    };
  }

  type Acc = {
    campaign_id: string;
    campaign_name: string;
    local_status: string;
    external_campaign_id: string;
    ads_checked: number;
    disapproved_count: number;
    limited_count: number;
    topics: Set<string>;
  };
  const acc = new Map<string, Acc>();

  for (const raw of Array.isArray(s.results) ? s.results : []) {
    const row = raw as Record<string, unknown>;
    const camp = (row.campaign ?? {}) as { id?: string; name?: string };
    const ext = numId(camp.id);
    const local = byExt.get(ext);
    if (!local) continue;
    const aga = (row.adGroupAd ?? row.ad_group_ad ?? {}) as {
      status?: string;
      policySummary?: {
        approvalStatus?: string;
        reviewStatus?: string;
        policyTopicEntries?: Array<{ topic?: string; type?: string }>;
      };
    };
    const approval = String(aga.policySummary?.approvalStatus ?? "").toUpperCase();
    const cur =
      acc.get(local.id) ??
      ({
        campaign_id: local.id,
        campaign_name: local.name || String(camp.name ?? ""),
        local_status: local.status,
        external_campaign_id: ext,
        ads_checked: 0,
        disapproved_count: 0,
        limited_count: 0,
        topics: new Set<string>(),
      } satisfies Acc);
    cur.ads_checked += 1;
    if (approval === "DISAPPROVED") cur.disapproved_count += 1;
    if (approval === "APPROVED_LIMITED") cur.limited_count += 1;
    for (const t of aga.policySummary?.policyTopicEntries ?? []) {
      const label = String(t.topic ?? t.type ?? "").trim();
      if (label) cur.topics.add(label);
    }
    acc.set(local.id, cur);
  }

  // Campanhas publicadas sem RSA na resposta → aviso
  for (const [ext, local] of byExt) {
    if (acc.has(local.id)) continue;
    acc.set(local.id, {
      campaign_id: local.id,
      campaign_name: local.name,
      local_status: local.status,
      external_campaign_id: ext,
      ads_checked: 0,
      disapproved_count: 0,
      limited_count: 0,
      topics: new Set(),
    });
  }

  const campaigns = [...acc.values()]
    .map((c) => {
      const severity: "ok" | "warn" | "critical" =
        c.disapproved_count > 0 ? "critical" : c.limited_count > 0 || c.ads_checked === 0 ? "warn" : "ok";
      return {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        local_status: c.local_status,
        external_campaign_id: c.external_campaign_id,
        ads_checked: c.ads_checked,
        disapproved_count: c.disapproved_count,
        limited_count: c.limited_count,
        topics: [...c.topics].slice(0, 8),
        severity,
      };
    })
    .sort(
      (a, b) =>
        b.disapproved_count - a.disapproved_count ||
        b.limited_count - a.limited_count ||
        a.campaign_name.localeCompare(b.campaign_name),
    );

  return {
    ok: true as const,
    connected: true,
    campaigns,
    totals: {
      campaigns: campaigns.length,
      disapproved_ads: campaigns.reduce((s, c) => s + c.disapproved_count, 0),
      limited_ads: campaigns.reduce((s, c) => s + c.limited_count, 0),
      critical_campaigns: campaigns.filter((c) => c.severity === "critical").length,
    },
    source: "google_ads_api" as const,
    note: null as string | null,
  };
}
