/**
 * Estúdio pós-publicação Google Search: detalhe local + fila de pedidos (modo Copilot / Autopilot).
 */
import type { PaidAdsChangeRequestType, Prisma } from "@prisma/client";
import { z } from "zod";

import { workspaceAllowsApplyBeforeRemote } from "./apply-workspace-guard";
import { applyChangeRequestRemote } from "./change-request-apply";
import * as mappers from "./api-mappers";
import {
  mergeGoogleBiddingConfigPreservingExtras,
  storedGoogleBiddingFromPlanInput,
} from "./google-campaign-bidding";
import { prisma } from "./paidPrisma";

const matchEnum = z.enum(["exact", "phrase", "broad"]);
const googleBiddingStudioEnum = z.enum([
  "manual_cpc",
  "maximize_clicks",
  "maximize_conversions",
  "target_cpa",
  "target_roas",
]);

export const googleStudioActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause_campaign") }),
  z.object({ action: z.literal("resume_campaign") }),
  z.object({ action: z.literal("pause_ad_group"), ad_group_id: z.string().uuid() }),
  z.object({ action: z.literal("resume_ad_group"), ad_group_id: z.string().uuid() }),
  z.object({ action: z.literal("pause_keyword"), keyword_id: z.string().uuid() }),
  z.object({ action: z.literal("resume_keyword"), keyword_id: z.string().uuid() }),
  z.object({ action: z.literal("pause_rsa"), rsa_id: z.string().uuid() }),
  z.object({ action: z.literal("resume_rsa"), rsa_id: z.string().uuid() }),
  z.object({
    action: z.literal("add_keywords"),
    ad_group_id: z.string().uuid(),
    keywords: z
      .array(
        z.object({
          text: z.string().min(1).max(80),
          match_type: matchEnum,
        }),
      )
      .min(1),
  }),
  z.object({ action: z.literal("remove_keyword"), keyword_id: z.string().uuid() }),
  z.object({
    action: z.literal("update_budget_usd"),
    daily_budget_usd: z.number().positive(),
  }),
  z.object({
    action: z.literal("update_rsa"),
    rsa_id: z.string().uuid(),
    headlines: z.array(z.string()).min(3).max(15),
    descriptions: z.array(z.string()).min(2).max(4),
    final_urls: z.array(z.string().url()).max(3).optional(),
    /** Caminhos de visualização (até 15 caracteres cada). Omitido = não alterar. "" = limpar localmente e na próxima mutação onde aplicável. */
    path1: z.string().max(15).optional(),
    path2: z.string().max(15).optional(),
  }),
  z.object({
    action: z.literal("update_ad_group_cpc_usd"),
    ad_group_id: z.string().uuid(),
    max_cpc_usd: z.number().positive(),
  }),
  z.object({
    action: z.literal("update_campaign_bidding"),
    google_bidding_strategy: googleBiddingStudioEnum,
    google_target_cpa_usd: z.number().positive().max(10000).nullable().optional(),
    google_target_roas: z.number().positive().max(100).nullable().optional(),
    google_max_cpc_usd: z.number().positive().max(1000).nullable().optional(),
  }),
]);

export const googleCampaignDraftPatchSchema = z
  .object({
  name: z.string().min(1).max(200).optional(),
  objective_summary: z.string().max(4000).nullable().optional(),
  daily_budget_micros: z.union([z.number().int().min(100_000).max(100_000_000_000), z.null()]).optional(),
  ad_groups: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(180).optional(),
        keywords: z
          .array(
            z.object({
              text: z.string().min(1).max(80),
              match_type: matchEnum,
            }),
          )
          .optional(),
        rsa: z
          .object({
            id: z.string().uuid(),
            headlines: z.array(z.string().max(120)).min(3).max(15),
            descriptions: z.array(z.string().max(300)).min(2).max(4),
            final_urls: z.array(z.string().url()).max(3).optional(),
            path1: z.union([z.string().max(15), z.literal("")]).nullable().optional(),
            path2: z.union([z.string().max(15), z.literal("")]).nullable().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
    google_bidding_strategy: googleBiddingStudioEnum.optional(),
    google_target_cpa_usd: z.number().positive().max(10000).nullable().optional(),
    google_target_roas: z.number().positive().max(100).nullable().optional(),
    google_max_cpc_usd: z.number().positive().max(1000).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.google_bidding_strategy === "target_cpa") {
      const v = val.google_target_cpa_usd;
      if (v == null || !Number.isFinite(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPA alvo (USD) obrigatório para «Maximizar conversões com CPA alvo».",
          path: ["google_target_cpa_usd"],
        });
      }
    }
    if (val.google_bidding_strategy === "target_roas") {
      const v = val.google_target_roas;
      if (v == null || !Number.isFinite(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ROAS alvo obrigatório para esta estratégia.",
          path: ["google_target_roas"],
        });
      }
    }
  });

function strArr(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x).trim()).filter(Boolean);
}

/** Árvore de campanha Google (local); `published` quando há `external_campaign_id`. */
export async function getGoogleCampaignStudioDetail(projectId: string, campaignId: string) {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    include: {
      adGroups: {
        orderBy: { createdAt: "asc" },
        include: {
          keywords: { orderBy: { createdAt: "asc" } },
          adsRsa: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!camp) return null;

  return {
    campaign: mappers.mapPaidCampaign(camp),
    published: Boolean(camp.externalCampaignId),
    ad_groups: camp.adGroups.map((ag) => ({
      id: ag.id,
      name: ag.name,
      status: ag.status,
      external_ad_group_id: ag.externalAdGroupId,
      cpc_bid_micros: ag.cpcBidMicros != null ? Number(ag.cpcBidMicros) : null,
      keywords: ag.keywords.map((k) => ({
        id: k.id,
        text: k.text,
        match_type: k.matchType,
        status: k.status,
        external_criterion_id: k.externalCriterionId,
      })),
      rsa: ag.adsRsa.map((rsa) => ({
        id: rsa.id,
        headlines: strArr(rsa.headlines),
        descriptions: strArr(rsa.descriptions),
        final_urls: strArr(rsa.finalUrls),
        path1: rsa.displayPath1 ?? null,
        path2: rsa.displayPath2 ?? null,
        status: rsa.status,
        external_ad_id: rsa.externalAdId,
      })),
    })),
  };
}

async function submitGoogleStudioChangeRequest(args: {
  projectId: string;
  campaignId: string;
  type: PaidAdsChangeRequestType;
  payload: Record<string, unknown>;
  requestedById: string;
}): Promise<{ id: string; status: string; error?: string }> {
  const project = await prisma.paidAdsProject.findFirst({
    where: { id: args.projectId },
    select: { userId: true, paidMode: true },
  });
  if (!project) {
    return { id: "", status: "error", error: "Projeto não encontrado." };
  }

  const payload = { ...args.payload, campaign_id: args.campaignId };

  const row = await prisma.paidAdsChangeRequest.create({
    data: {
      userId: project.userId,
      projectId: args.projectId,
      type: args.type,
      payload,
      status: "pending",
      requestedById: args.requestedById,
    },
  });

  if (project.paidMode === "autopilot") {
    const now = new Date();
    const pre = await workspaceAllowsApplyBeforeRemote(args.projectId, args.type, payload);
    if (!pre.ok) {
      await prisma.paidAdsChangeRequest.update({
        where: { id: row.id },
        data: {
          status: "failed",
          errorMessage: pre.message,
          reviewedAt: now,
          reviewedById: args.requestedById,
        },
      });
      return { id: row.id, status: "failed", error: pre.message };
    }
    const out = await applyChangeRequestRemote(args.projectId, args.type, payload);
    if (!out.ok) {
      await prisma.paidAdsChangeRequest.update({
        where: { id: row.id },
        data: {
          status: "failed",
          errorMessage: out.error,
          reviewedAt: now,
          reviewedById: args.requestedById,
        },
      });
      return { id: row.id, status: "failed", error: out.error };
    }
    await prisma.paidAdsChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "applied",
        reviewedAt: now,
        reviewedById: args.requestedById,
        appliedAt: now,
        errorMessage: null,
      },
    });
    return { id: row.id, status: "applied" };
  }

  return { id: row.id, status: "pending" };
}

export async function executeGoogleStudioAction(
  projectId: string,
  campaignId: string,
  body: unknown,
  requestedById: string,
): Promise<
  | { ok: true; change_request: { id: string; status: string } }
  | { ok: false; error: string; change_request_id?: string }
> {
  const parsed = googleStudioActionSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Pedido inválido." };
  }

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    include: { adGroups: { include: { keywords: true, adsRsa: true } } },
  });
  if (!camp) {
    return { ok: false, error: "Campanha não encontrada." };
  }
  if (camp.status === "archived") {
    return { ok: false, error: "Campanha arquivada." };
  }
  if (!camp.externalCampaignId) {
    return {
      ok: false,
      error: "Publique a campanha na Google antes de alterações ao vivo, ou use o editor de rascunho.",
    };
  }

  const cLive = camp;
  const agSet = new Set(cLive.adGroups.map((g) => g.id));

  function findRsa(rsaId: string) {
    for (const g of cLive.adGroups) {
      const r = g.adsRsa.find((x) => x.id === rsaId);
      if (r) return { ag: g, rsa: r };
    }
    return null;
  }

  function findKw(keywordId: string) {
    for (const g of cLive.adGroups) {
      const k = g.keywords.find((x) => x.id === keywordId);
      if (k) return { ag: g, kw: k };
    }
    return null;
  }

  const a = parsed.data;

  const submit = async (type: PaidAdsChangeRequestType, payload: Record<string, unknown>) => {
    const r = await submitGoogleStudioChangeRequest({
      projectId,
      campaignId,
      type,
      payload,
      requestedById,
    });
    if (r.error) {
      return { ok: false as const, error: r.error, change_request_id: r.id };
    }
    return { ok: true as const, change_request: { id: r.id, status: r.status } };
  };

  switch (a.action) {
    case "pause_campaign":
      return submit("pause_entity", { entity: "campaign", id: campaignId });
    case "resume_campaign":
      return submit("resume_entity", { entity: "campaign", id: campaignId });
    case "pause_ad_group": {
      if (!agSet.has(a.ad_group_id)) return { ok: false, error: "Ad group inválido." };
      return submit("pause_entity", { entity: "ad_group", id: a.ad_group_id });
    }
    case "resume_ad_group": {
      if (!agSet.has(a.ad_group_id)) return { ok: false, error: "Ad group inválido." };
      return submit("resume_entity", { entity: "ad_group", id: a.ad_group_id });
    }
    case "pause_keyword": {
      if (!findKw(a.keyword_id)) return { ok: false, error: "Palavra-chave inválida." };
      return submit("pause_entity", { entity: "keyword", id: a.keyword_id });
    }
    case "resume_keyword": {
      if (!findKw(a.keyword_id)) return { ok: false, error: "Palavra-chave inválida." };
      return submit("resume_entity", { entity: "keyword", id: a.keyword_id });
    }
    case "pause_rsa": {
      if (!findRsa(a.rsa_id)) return { ok: false, error: "Anúncio inválido." };
      return submit("pause_entity", { entity: "rsa", id: a.rsa_id });
    }
    case "resume_rsa": {
      if (!findRsa(a.rsa_id)) return { ok: false, error: "Anúncio inválido." };
      return submit("resume_entity", { entity: "rsa", id: a.rsa_id });
    }
    case "add_keywords": {
      if (!agSet.has(a.ad_group_id)) return { ok: false, error: "Ad group inválido." };
      return submit("add_keywords", {
        ad_group_id: a.ad_group_id,
        keywords: a.keywords.map((k) => ({
          text: k.text.slice(0, 80),
          match_type: k.match_type,
        })),
      });
    }
    case "remove_keyword": {
      if (!findKw(a.keyword_id)) return { ok: false, error: "Palavra-chave inválida." };
      return submit("remove_keyword", { keyword_id: a.keyword_id });
    }
    case "update_budget_usd": {
      const daily_budget_micros = Math.round(a.daily_budget_usd * 1_000_000);
      return submit("update_budget", { campaign_id: campaignId, daily_budget_micros });
    }
    case "update_rsa": {
      const hit = findRsa(a.rsa_id);
      if (!hit) return { ok: false, error: "Anúncio inválido." };
      return submit("update_rsa_copy", {
        paid_ads_rsa_id: a.rsa_id,
        headlines: a.headlines,
        descriptions: a.descriptions,
        ...(a.final_urls?.length ? { final_urls: a.final_urls } : {}),
        ...(a.path1 !== undefined ? { path1: a.path1 } : {}),
        ...(a.path2 !== undefined ? { path2: a.path2 } : {}),
      });
    }
    case "update_ad_group_cpc_usd": {
      if (!agSet.has(a.ad_group_id)) return { ok: false, error: "Ad group inválido." };
      const cpc_bid_micros = Math.round(a.max_cpc_usd * 1_000_000);
      return submit("update_ad_group_cpc", { ad_group_id: a.ad_group_id, cpc_bid_micros });
    }
    case "update_campaign_bidding": {
      if (a.google_bidding_strategy === "target_cpa") {
        const v = a.google_target_cpa_usd;
        if (v == null || !Number.isFinite(v)) {
          return { ok: false, error: "Indique o CPA alvo (USD) para esta estratégia." };
        }
      }
      if (a.google_bidding_strategy === "target_roas") {
        const v = a.google_target_roas;
        if (v == null || !Number.isFinite(v)) {
          return { ok: false, error: "Indique o ROAS alvo para esta estratégia." };
        }
      }
      return submit("update_campaign_bidding", {
        google_bidding_strategy: a.google_bidding_strategy,
        google_target_cpa_usd: a.google_target_cpa_usd ?? null,
        google_target_roas: a.google_target_roas ?? null,
        google_max_cpc_usd: a.google_max_cpc_usd ?? null,
      });
    }
    default:
      return { ok: false, error: "Acção não suportada." };
  }
}

export async function patchGoogleCampaignDraft(
  projectId: string,
  campaignId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = googleCampaignDraftPatchSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    include: {
      adGroups: {
        include: { keywords: true, adsRsa: true },
      },
    },
  });
  if (!camp) {
    return { ok: false, error: "Campanha não encontrada." };
  }
  if (camp.status === "archived") {
    return { ok: false, error: "Campanha arquivada." };
  }
  if (camp.externalCampaignId) {
    return {
      ok: false,
      error: "Campanha já publicada na Google: use o estúdio (fila de alterações) em vez do editor de rascunho.",
    };
  }

  const d = parsed.data;
  const agIds = new Set(camp.adGroups.map((g) => g.id));

  try {
    await prisma.$transaction(async (tx) => {
      if (d.name != null || d.objective_summary !== undefined || d.daily_budget_micros !== undefined) {
        await tx.paidAdsCampaign.update({
          where: { id: camp.id },
          data: {
            ...(d.name != null ? { name: d.name } : {}),
            ...(d.objective_summary !== undefined ? { objectiveSummary: d.objective_summary } : {}),
            ...(d.daily_budget_micros !== undefined
              ? { dailyBudgetMicros: d.daily_budget_micros != null ? BigInt(d.daily_budget_micros) : null }
              : {}),
          },
        });
      }
      if (d.google_bidding_strategy != null) {
        const stored = storedGoogleBiddingFromPlanInput({
          strategy: d.google_bidding_strategy,
          google_target_cpa_usd: d.google_target_cpa_usd,
          google_target_roas: d.google_target_roas,
          google_max_cpc_usd: d.google_max_cpc_usd,
        });
        const merged = mergeGoogleBiddingConfigPreservingExtras(camp.biddingConfig, stored);
        await tx.paidAdsCampaign.update({
          where: { id: camp.id },
          data: { biddingConfig: merged as Prisma.InputJsonValue },
        });
      }
      if (d.ad_groups) {
        for (const agPatch of d.ad_groups) {
          if (!agIds.has(agPatch.id)) {
            throw new Error("Grupo de anúncios não pertence a esta campanha.");
          }
          if (agPatch.name != null) {
            await tx.paidAdsAdGroup.update({ where: { id: agPatch.id }, data: { name: agPatch.name } });
          }
          if (agPatch.keywords) {
            await tx.paidAdsKeyword.deleteMany({ where: { adGroupId: agPatch.id } });
            for (const k of agPatch.keywords) {
              await tx.paidAdsKeyword.create({
                data: {
                  adGroupId: agPatch.id,
                  text: k.text.slice(0, 80),
                  matchType: k.match_type,
                  status: "draft",
                },
              });
            }
          }
          if (agPatch.rsa) {
            const agRow = camp.adGroups.find((g) => g.id === agPatch.id);
            const rsaOk = agRow?.adsRsa.some((r) => r.id === agPatch.rsa!.id);
            if (!rsaOk) {
              throw new Error("RSA não pertence ao grupo.");
            }
            await tx.paidAdsRsa.update({
              where: { id: agPatch.rsa.id },
              data: {
                headlines: agPatch.rsa.headlines,
                descriptions: agPatch.rsa.descriptions,
                ...(agPatch.rsa.final_urls?.length ? { finalUrls: agPatch.rsa.final_urls } : {}),
                ...(agPatch.rsa.path1 !== undefined
                  ? {
                      displayPath1:
                        agPatch.rsa.path1 == null || agPatch.rsa.path1.trim() === ""
                          ? null
                          : agPatch.rsa.path1.trim().slice(0, 15),
                    }
                  : {}),
                ...(agPatch.rsa.path2 !== undefined
                  ? {
                      displayPath2:
                        agPatch.rsa.path2 == null || agPatch.rsa.path2.trim() === ""
                          ? null
                          : agPatch.rsa.path2.trim().slice(0, 15),
                    }
                  : {}),
              },
            });
          }
        }
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao gravar rascunho." };
  }

  return { ok: true };
}
