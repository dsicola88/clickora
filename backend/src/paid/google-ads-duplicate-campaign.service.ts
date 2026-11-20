/**
 * Duplicação segura de campanha Google Search (estrutura local).
 * Cria novos IDs locais; limpa external_* (sem histórico/métricas).
 * Publicação na Google só via fluxo create_campaign existente (com confirmação).
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./paidPrisma";
import { enqueueCreateCampaignChangeRequest } from "./google-ads-duplicate-publish";

export const duplicateGoogleCampaignBodySchema = z.object({
  name: z.string().trim().min(2).max(250).optional(),
  daily_budget_usd: z.number().positive().max(10_000).optional(),
  /** Se true, enfileira publicação (Copilot: pending; Autopilot: aplica se guardrails ok). */
  publish: z.boolean().optional().default(false),
});

function asJsonValue(v: unknown): Prisma.InputJsonValue {
  if (v == null) return [];
  return v as Prisma.InputJsonValue;
}

export async function duplicateGoogleSearchCampaignLocal(
  projectId: string,
  sourceCampaignId: string,
  actorUserId: string,
  opts: z.infer<typeof duplicateGoogleCampaignBodySchema>,
): Promise<
  | {
      ok: true;
      campaign_id: string;
      name: string;
      status: string;
      published_request_id?: string;
      published_applied?: boolean;
      warnings: string[];
    }
  | { ok: false; error: string }
> {
  const source = await prisma.paidAdsCampaign.findFirst({
    where: { id: sourceCampaignId, projectId, platform: "google_ads" },
    include: {
      adGroups: {
        include: {
          keywords: true,
          adsRsa: true,
          negativeKeywords: true,
        },
      },
      campaignNegativeKeywords: true,
      project: { select: { userId: true, paidMode: true } },
    },
  });
  if (!source) return { ok: false, error: "Campanha origem não encontrada." };
  if (source.status === "archived") {
    return { ok: false, error: "Não é possível duplicar uma campanha arquivada." };
  }

  const warnings: string[] = [];
  if (!source.externalCampaignId) {
    warnings.push("A origem ainda não estava publicada no Google — a cópia é só rascunho local.");
  }
  warnings.push("Histórico, métricas e conversões da campanha original não são copiados.");
  warnings.push("Extensões de recurso já sincronizadas na Google podem precisar de reconfiguração no estúdio.");

  const baseName = (opts.name?.trim() || `${source.name} (cópia)`).slice(0, 250);
  const budgetMicros =
    opts.daily_budget_usd != null
      ? BigInt(Math.round(opts.daily_budget_usd * 1_000_000))
      : source.dailyBudgetMicros;

  const created = await prisma.$transaction(async (tx) => {
    const camp = await tx.paidAdsCampaign.create({
      data: {
        userId: source.project.userId,
        projectId,
        platform: "google_ads",
        name: baseName,
        status: "draft",
        objectiveSummary: source.objectiveSummary,
        dailyBudgetMicros: budgetMicros,
        geoTargets: asJsonValue(source.geoTargets),
        languageTargets: asJsonValue(source.languageTargets),
        biddingConfig: asJsonValue(source.biddingConfig ?? {}),
        optimizerFlags: {},
        externalCampaignId: null,
      },
    });

    for (const nk of source.campaignNegativeKeywords) {
      await tx.paidAdsCampaignNegativeKeyword.create({
        data: {
          campaignId: camp.id,
          text: nk.text,
          matchType: nk.matchType,
          externalCriterionId: null,
        },
      });
    }

    for (const ag of source.adGroups) {
      const nag = await tx.paidAdsAdGroup.create({
        data: {
          campaignId: camp.id,
          name: ag.name,
          status: "draft",
          cpcBidMicros: ag.cpcBidMicros,
          externalAdGroupId: null,
        },
      });
      for (const kw of ag.keywords) {
        await tx.paidAdsKeyword.create({
          data: {
            adGroupId: nag.id,
            text: kw.text,
            matchType: kw.matchType,
            status: "draft",
            externalCriterionId: null,
          },
        });
      }
      for (const ad of ag.adsRsa) {
        await tx.paidAdsRsa.create({
          data: {
            adGroupId: nag.id,
            headlines: asJsonValue(ad.headlines),
            descriptions: asJsonValue(ad.descriptions),
            finalUrls: asJsonValue(ad.finalUrls),
            displayPath1: ad.displayPath1,
            displayPath2: ad.displayPath2,
            status: "draft",
            externalAdId: null,
          },
        });
      }
      for (const nk of ag.negativeKeywords) {
        await tx.paidAdsAdGroupNegativeKeyword.create({
          data: {
            adGroupId: nag.id,
            text: nk.text,
            matchType: nk.matchType,
            externalCriterionId: null,
          },
        });
      }
    }

    return camp;
  });

  let published_request_id: string | undefined;
  let published_applied: boolean | undefined;
  if (opts.publish) {
    const pub = await enqueueCreateCampaignChangeRequest(projectId, created.id, actorUserId);
    if (!pub.ok) {
      warnings.push(`Cópia criada como rascunho, mas publicação não enfileirada: ${pub.error}`);
    } else {
      published_request_id = pub.change_request_id;
      published_applied = pub.applied;
      if (pub.applied) {
        warnings.push("Pedido de publicação aplicado (Autopilot ou fluxo imediato).");
      } else {
        warnings.push("Pedido de publicação em Aprovações (Copilot) — confirme antes de ir para a Google.");
      }
    }
  }

  return {
    ok: true,
    campaign_id: created.id,
    name: created.name,
    status: created.status,
    published_request_id,
    published_applied,
    warnings,
  };
}
