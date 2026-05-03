/**
 * Mutações Google Ads (pós-criação): orçamento, palavras-chave, RSA, pausas.
 * Contrato do payload: ver `change-request-apply.ts`.
 */
import type { PaidAdsEntityStatus as EntityStatus, PaidAdsMatchType as MatchType } from "@prisma/client";

import {
  getAccessFromRefreshToken,
  getGoogleDeveloperToken,
  runGoogleAdsMutate,
  runGoogleAdsSearch,
} from "./google-ads.api";
import { prisma } from "./paidPrisma";

const LOGIN = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") || undefined;

function matchTypeToGoogle(m: MatchType): "EXACT" | "PHRASE" | "BROAD" {
  if (m === "exact") return "EXACT";
  if (m === "phrase") return "PHRASE";
  return "BROAD";
}

function parseJsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Fragmento de caminho de visualização RSA (máx. 15). Vazio → null. */
function normGoogleDisplayPath(seg: string): string | null {
  const t = String(seg ?? "")
    .trim()
    .slice(0, 15)
    .replace(/[\x00-\x1f\x7f]/g, "");
  return t === "" ? null : t;
}

function clipPathCol(v: string | null | undefined): string | undefined {
  return normGoogleDisplayPath(v ?? "") ?? undefined;
}

export type CrResult = { ok: true } | { ok: false; error: string };

async function ctxForProject(
  projectId: string,
): Promise<{ err: string } | { access: string; customerId: string; dev: string }> {
  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { err: "Ligue a conta Google Ads (OAuth) antes de aplicar." };
  }
  const dev = getGoogleDeveloperToken();
  if (!dev) return { err: "GOOGLE_ADS_DEVELOPER_TOKEN em falta." };
  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
  } catch (e) {
    return { err: e instanceof Error ? e.message : "Token Google inválido." };
  }
  return {
    access,
    customerId: conn.googleCustomerId.replace(/\D/g, ""),
    dev,
  };
}

export async function applyGoogleUpdateBudget(
  projectId: string,
  p: { campaign_id: string; daily_budget_micros: number },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "google_ads" },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha sem ID Google; publique a campanha primeiro." };
  }
  const extId = camp.externalCampaignId.replace(/\D/g, "");
  const q = `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${extId}`;
  const s = await runGoogleAdsSearch(access, customerId, dev, q, LOGIN);
  if (s.error) return { ok: false, error: s.error.message ?? "Falha na consulta" };
  const row = s.results?.[0] as { campaign?: { campaignBudget?: string } } | undefined;
  const brn = row?.campaign?.campaignBudget;
  if (!brn) {
    return { ok: false, error: "Orçamento da campanha não encontrado no Google." };
  }
  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "campaignBudgets",
    {
      operations: [
        {
          update: {
            resourceName: brn,
            amountMicros: String(Math.round(p.daily_budget_micros)),
          },
          updateMask: "amountMicros",
        },
      ],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Mutate orçamento" };
  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { dailyBudgetMicros: BigInt(Math.round(p.daily_budget_micros)) },
  });
  return { ok: true };
}

export async function applyGoogleAddKeywords(
  projectId: string,
  p: {
    ad_group_id: string;
    keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
  },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;

  const ag = await prisma.paidAdsAdGroup.findFirst({
    where: { id: p.ad_group_id, campaign: { projectId, platform: "google_ads" } },
    include: { campaign: true },
  });
  if (!ag?.externalAdGroupId) {
    return { ok: false, error: "Ad group sem ID Google; publique a campanha antes." };
  }
  const agRn = `customers/${customerId}/adGroups/${ag.externalAdGroupId}`;

  for (const k of p.keywords) {
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "adGroupCriteria",
      {
        operations: [
          {
            create: {
              adGroup: agRn,
              status: "ENABLED",
              keyword: {
                text: k.text.slice(0, 80),
                matchType: matchTypeToGoogle(k.match_type as MatchType),
              },
            },
          },
        ],
      },
      LOGIN,
    );
    if (m.error) {
      return { ok: false, error: m.error.message ?? "Adicionar palavra-chave" };
    }
    const rn = m.results?.[0]?.resourceName;
    if (rn) {
      const critId = rn.split("~").pop() ?? rn;
      await prisma.paidAdsKeyword.create({
        data: {
          adGroupId: ag.id,
          text: k.text.slice(0, 80),
          matchType: k.match_type as MatchType,
          status: "live" as EntityStatus,
          externalCriterionId: critId,
        },
      });
    }
  }
  return { ok: true };
}

export async function applyGooglePublishRsa(
  projectId: string,
  p: { paid_ads_rsa_id: string },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;

  const rsa = await prisma.paidAdsRsa.findFirst({
    where: { id: p.paid_ads_rsa_id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
    include: { adGroup: { include: { campaign: true } } },
  });
  if (!rsa) return { ok: false, error: "RSA não encontrado." };
  if (rsa.externalAdId) return { ok: true };
  const ag = rsa.adGroup;
  if (!ag.externalAdGroupId) {
    return { ok: false, error: "Ad group sem ID Google; publique a campanha antes." };
  }
  const agRn = `customers/${customerId}/adGroups/${ag.externalAdGroupId}`;
  const headlines = parseJsonStringArray(rsa.headlines) as string[];
  const descriptions = parseJsonStringArray(rsa.descriptions) as string[];
  const finalUrls = parseJsonStringArray(rsa.finalUrls);
  const url = finalUrls[0]?.match(/^https?:\/\//i)
    ? finalUrls[0]
    : `https://${finalUrls[0] ?? "example.com"}`;
  if (headlines.length < 3 || descriptions.length < 2) {
    return { ok: false, error: "RSA: mínimo 3 títulos e 2 descrições." };
  }
  const hParts = headlines.slice(0, 15).map((t) => ({ text: t.slice(0, 30) }));
  const dParts = descriptions.slice(0, 4).map((t) => ({ text: t.slice(0, 90) }));
  const rp1 = clipPathCol(rsa.displayPath1);
  const rp2 = clipPathCol(rsa.displayPath2);
  const responsiveSearchAd: Record<string, unknown> = { headlines: hParts, descriptions: dParts };
  if (rp1) responsiveSearchAd.path1 = rp1;
  if (rp2) responsiveSearchAd.path2 = rp2;

  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "adGroupAds",
    {
      operations: [
        {
          create: {
            adGroup: agRn,
            status: "ENABLED",
            ad: {
              finalUrls: [url],
              responsiveSearchAd,
            },
          },
        },
      ],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Criar anúncio RSA" };
  const rn = m.results?.[0]?.resourceName;
  if (rn) {
    const id = rn.split("/").pop() ?? rn;
    await prisma.paidAdsRsa.update({
      where: { id: rsa.id },
      data: { externalAdId: id, status: "live" as EntityStatus },
    });
  }
  return { ok: true };
}

export async function applyGooglePauseEntity(
  projectId: string,
  p: { entity: "campaign" | "ad_group" | "keyword" | "rsa"; id: string },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;
  const cid = `customers/${customerId}`;

  if (p.entity === "campaign") {
    const camp = await prisma.paidAdsCampaign.findFirst({
      where: { id: p.id, projectId, platform: "google_ads" },
    });
    if (!camp?.externalCampaignId) {
      return { ok: false, error: "Campanha sem ID Google." };
    }
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaigns",
      {
        operations: [
          {
            update: {
              resourceName: `${cid}/campaigns/${camp.externalCampaignId.replace(/\D/g, "")}`,
              status: "PAUSED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Pausar campanha" };
    await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { status: "paused" },
    });
    return { ok: true };
  }
  if (p.entity === "ad_group") {
    const ag = await prisma.paidAdsAdGroup.findFirst({
      where: { id: p.id, campaign: { projectId, platform: "google_ads" } },
    });
    if (!ag?.externalAdGroupId) {
      return { ok: false, error: "Ad group sem ID Google." };
    }
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "adGroups",
      {
        operations: [
          {
            update: {
              resourceName: `${cid}/adGroups/${ag.externalAdGroupId.replace(/\D/g, "")}`,
              status: "PAUSED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Pausar ad group" };
    await prisma.paidAdsAdGroup.update({ where: { id: ag.id }, data: { status: "paused" } });
    return { ok: true };
  }
  if (p.entity === "keyword") {
    const kw = await prisma.paidAdsKeyword.findFirst({
      where: { id: p.id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
      include: { adGroup: true },
    });
    if (!kw?.externalCriterionId || !kw.adGroup.externalAdGroupId) {
      return { ok: false, error: "Palavra-chave sem ID remoto completo." };
    }
    const agId = kw.adGroup.externalAdGroupId.replace(/\D/g, "");
    const crit = kw.externalCriterionId.replace(/\D/g, "");
    const resourceName = `${cid}/adGroupCriteria/${agId}~${crit}`;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "adGroupCriteria",
      {
        operations: [
          {
            update: {
              resourceName,
              status: "PAUSED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Pausar critério" };
    await prisma.paidAdsKeyword.update({ where: { id: kw.id }, data: { status: "paused" } });
    return { ok: true };
  }
  const rsa = await prisma.paidAdsRsa.findFirst({
    where: { id: p.id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
    include: { adGroup: true },
  });
  if (!rsa?.externalAdId || !rsa.adGroup.externalAdGroupId) {
    return { ok: false, error: "Anúncio RSA sem ID Google no ad group publicado." };
  }
  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "adGroupAds",
    {
      operations: [
        {
          update: {
            resourceName: `${cid}/adGroupAds/${rsa.adGroup.externalAdGroupId.replace(/\D/g, "")}~${rsa.externalAdId.replace(/\D/g, "")}`,
            status: "PAUSED",
          },
          updateMask: "status",
        },
      ],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Pausar anúncio" };
  await prisma.paidAdsRsa.update({ where: { id: rsa.id }, data: { status: "paused" } });
  return { ok: true };
}

/** Reverte pausas criadas pela app (ENABLED no Google ↔ status `live` local). Mesmo formato de payload que pause_entity. */
export async function applyGoogleResumeEntity(
  projectId: string,
  p: { entity: "campaign" | "ad_group" | "keyword" | "rsa"; id: string },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;
  const cid = `customers/${customerId}`;

  if (p.entity === "campaign") {
    const camp = await prisma.paidAdsCampaign.findFirst({
      where: { id: p.id, projectId, platform: "google_ads" },
    });
    if (!camp?.externalCampaignId) {
      return { ok: false, error: "Campanha sem ID Google." };
    }
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaigns",
      {
        operations: [
          {
            update: {
              resourceName: `${cid}/campaigns/${camp.externalCampaignId.replace(/\D/g, "")}`,
              status: "ENABLED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Reactivar campanha" };
    await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { status: "live" },
    });
    return { ok: true };
  }
  if (p.entity === "ad_group") {
    const ag = await prisma.paidAdsAdGroup.findFirst({
      where: { id: p.id, campaign: { projectId, platform: "google_ads" } },
    });
    if (!ag?.externalAdGroupId) {
      return { ok: false, error: "Ad group sem ID Google." };
    }
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "adGroups",
      {
        operations: [
          {
            update: {
              resourceName: `${cid}/adGroups/${ag.externalAdGroupId.replace(/\D/g, "")}`,
              status: "ENABLED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Reactivar ad group" };
    await prisma.paidAdsAdGroup.update({ where: { id: ag.id }, data: { status: "live" } });
    return { ok: true };
  }
  if (p.entity === "keyword") {
    const kw = await prisma.paidAdsKeyword.findFirst({
      where: { id: p.id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
      include: { adGroup: true },
    });
    if (!kw?.externalCriterionId || !kw.adGroup.externalAdGroupId) {
      return { ok: false, error: "Palavra-chave sem ID remoto completo." };
    }
    const agId = kw.adGroup.externalAdGroupId.replace(/\D/g, "");
    const crit = kw.externalCriterionId.replace(/\D/g, "");
    const resourceName = `${cid}/adGroupCriteria/${agId}~${crit}`;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "adGroupCriteria",
      {
        operations: [
          {
            update: {
              resourceName,
              status: "ENABLED",
            },
            updateMask: "status",
          },
        ],
      },
      LOGIN,
    );
    if (m.error) return { ok: false, error: m.error.message ?? "Reactivar critério" };
    await prisma.paidAdsKeyword.update({ where: { id: kw.id }, data: { status: "live" } });
    return { ok: true };
  }
  const rsa = await prisma.paidAdsRsa.findFirst({
    where: { id: p.id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
    include: { adGroup: true },
  });
  if (!rsa?.externalAdId || !rsa.adGroup.externalAdGroupId) {
    return { ok: false, error: "Anúncio RSA sem ID Google no ad group publicado." };
  }
  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "adGroupAds",
    {
      operations: [
        {
          update: {
            resourceName: `${cid}/adGroupAds/${rsa.adGroup.externalAdGroupId.replace(/\D/g, "")}~${rsa.externalAdId.replace(/\D/g, "")}`,
            status: "ENABLED",
          },
          updateMask: "status",
        },
      ],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Reactivar anúncio" };
  await prisma.paidAdsRsa.update({ where: { id: rsa.id }, data: { status: "live" } });
  return { ok: true };
}

/** Remove o critério de palavra-chave na Google e apaga a linha local. */
export async function applyGoogleRemoveKeyword(
  projectId: string,
  p: { keyword_id: string },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;
  const cid = `customers/${customerId}`;

  const kw = await prisma.paidAdsKeyword.findFirst({
    where: { id: p.keyword_id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
    include: { adGroup: true },
  });
  if (!kw) return { ok: false, error: "Palavra-chave não encontrada." };
  if (!kw.externalCriterionId || !kw.adGroup.externalAdGroupId) {
    return { ok: false, error: "Palavra-chave não publicada no Google; elimine-a no editor de rascunho." };
  }
  const agId = kw.adGroup.externalAdGroupId.replace(/\D/g, "");
  const crit = kw.externalCriterionId.replace(/\D/g, "");
  const resourceName = `${cid}/adGroupCriteria/${agId}~${crit}`;
  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "adGroupCriteria",
    {
      operations: [{ remove: resourceName }],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Remover palavra-chave" };
  await prisma.paidAdsKeyword.delete({ where: { id: kw.id } });
  return { ok: true };
}

export async function applyGoogleUpdateRsaCopy(
  projectId: string,
  p: {
    paid_ads_rsa_id: string;
    headlines: string[];
    descriptions: string[];
    /** Se presente na API, atualiza primeiro URL no anúncio (recomendável manter igual à landing da campanha). */
    final_urls?: string[];
    /** Caminhos de visualização — omitir chave no payload para preservar o valor na base. */
    path1?: string;
    path2?: string;
  },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;

  const rsa = await prisma.paidAdsRsa.findFirst({
    where: { id: p.paid_ads_rsa_id, adGroup: { campaign: { projectId, platform: "google_ads" } } },
    include: { adGroup: { include: { campaign: true } } },
  });
  if (!rsa) return { ok: false, error: "RSA não encontrado." };

  const headlines = (p.headlines ?? []).map((t) => String(t).trim()).filter(Boolean);
  const descriptions = (p.descriptions ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (headlines.length < 3 || descriptions.length < 2) {
    return { ok: false, error: "RSA: mínimo 3 títulos e 2 descrições." };
  }

  let finalUrls: string[];
  if (p.final_urls && p.final_urls.length > 0) {
    finalUrls = p.final_urls.map((u) => String(u).trim()).filter(Boolean);
  } else {
    finalUrls = parseJsonStringArray(rsa.finalUrls);
  }

  const nextPath1 =
    p.path1 !== undefined ? normGoogleDisplayPath(p.path1) : rsa.displayPath1 ?? null;
  const nextPath2 =
    p.path2 !== undefined ? normGoogleDisplayPath(p.path2) : rsa.displayPath2 ?? null;

  await prisma.paidAdsRsa.update({
    where: { id: rsa.id },
    data: {
      headlines: headlines.slice(0, 15),
      descriptions: descriptions.slice(0, 4),
      ...(finalUrls.length ? { finalUrls } : {}),
      ...(p.path1 !== undefined ? { displayPath1: nextPath1 } : {}),
      ...(p.path2 !== undefined ? { displayPath2: nextPath2 } : {}),
    },
  });

  if (!rsa.externalAdId || !rsa.adGroup.externalAdGroupId) {
    return { ok: true };
  }

  const hParts = headlines.slice(0, 15).map((t) => ({ text: t.slice(0, 30) }));
  const dParts = descriptions.slice(0, 4).map((t) => ({ text: t.slice(0, 90) }));
  const url0 = finalUrls[0]?.match(/^https?:\/\//i) ? finalUrls[0] : `https://${finalUrls[0] ?? "example.com"}`;
  const rp1 = clipPathCol(nextPath1 ?? undefined);
  const rp2 = clipPathCol(nextPath2 ?? undefined);

  const responsiveSearchAd: Record<string, unknown> = {
    headlines: hParts,
    descriptions: dParts,
  };
  if (rp1) responsiveSearchAd.path1 = rp1;
  if (rp2) responsiveSearchAd.path2 = rp2;

  let updateMask =
    "ad.final_urls,ad.responsive_search_ad.headlines,ad.responsive_search_ad.descriptions";
  const maskParts: string[] = [];
  if (rp1) maskParts.push("ad.responsive_search_ad.path1");
  if (rp2) maskParts.push("ad.responsive_search_ad.path2");
  if (maskParts.length) updateMask += `,${maskParts.join(",")}`;

  const updateBody: Record<string, unknown> = {
    operations: [
      {
        update: {
          resourceName: `customers/${customerId}/adGroupAds/${rsa.adGroup.externalAdGroupId.replace(/\D/g, "")}~${rsa.externalAdId.replace(/\D/g, "")}`,
          ad: {
            finalUrls: [url0],
            responsiveSearchAd,
          },
        },
        updateMask,
      },
    ],
  };

  const m = await runGoogleAdsMutate(access, customerId, dev, "adGroupAds", updateBody as { operations: unknown[] }, LOGIN);
  if (m.error) return { ok: false, error: m.error.message ?? "Actualizar anúncio RSA" };
  return { ok: true };
}

export async function applyGoogleUpdateAdGroupCpc(
  projectId: string,
  p: { ad_group_id: string; cpc_bid_micros: number },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev } = c0;
  const cid = `customers/${customerId}`;

  const micros = Math.round(p.cpc_bid_micros);
  if (!Number.isFinite(micros) || micros < 1) {
    return { ok: false, error: "CPC inválido (micros)." };
  }

  const ag = await prisma.paidAdsAdGroup.findFirst({
    where: { id: p.ad_group_id, campaign: { projectId, platform: "google_ads" } },
    include: { campaign: true },
  });
  if (!ag?.externalAdGroupId) {
    return { ok: false, error: "Ad group sem ID Google; publique antes de ajustar CPC." };
  }

  const m = await runGoogleAdsMutate(
    access,
    customerId,
    dev,
    "adGroups",
    {
      operations: [
        {
          update: {
            resourceName: `${cid}/adGroups/${ag.externalAdGroupId.replace(/\D/g, "")}`,
            cpcBidMicros: String(micros),
          },
          updateMask: "cpcBidMicros",
        },
      ],
    },
    LOGIN,
  );
  if (m.error) return { ok: false, error: m.error.message ?? "Actualizar CPC do grupo" };
  await prisma.paidAdsAdGroup.update({
    where: { id: ag.id },
    data: { cpcBidMicros: BigInt(micros) },
  });
  return { ok: true };
}
