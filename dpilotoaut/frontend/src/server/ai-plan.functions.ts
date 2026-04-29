import { createServerFn } from "@tanstack/react-start";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  buildDeterministicGoogleCampaignPlan,
  fetchOpenAiGoogleCampaignPlan,
  type GoogleCampaignAiPlan,
} from "@clickora/paid/google-campaign-ai-shared";
import { finalizeGoogleCampaignAssetExtensions } from "@clickora/paid/google-campaign-asset-extensions";
import { storedGoogleBiddingFromPlanInput } from "@clickora/paid/google-campaign-bidding";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { publishGoogleSearchCampaignFromLocal } from "@backend/google-ads.publish";
import { canWriteProject } from "@backend/permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  landingUrl: z.string().url().max(500),
  offer: z.string().min(3).max(500),
  objective: z.string().min(3).max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.array(z.string().min(2).max(8)).min(1).max(20),
  languageTargets: z.array(z.string().min(2).max(8)).min(1).max(10),
});

type AiPlan = GoogleCampaignAiPlan;

function toGuardrailLimits(g: {
  maxDailyBudgetMicros: bigint;
  maxMonthlySpendMicros: bigint;
  maxCpcMicros: bigint | null;
  allowedCountries: string[];
  blockedKeywords: string[];
  requireApprovalAboveMicros: bigint | null;
}): GuardrailLimits {
  return {
    max_daily_budget_micros: Number(g.maxDailyBudgetMicros),
    max_monthly_spend_micros: Number(g.maxMonthlySpendMicros),
    max_cpc_micros: g.maxCpcMicros != null ? Number(g.maxCpcMicros) : null,
    allowed_countries: g.allowedCountries,
    blocked_keywords: g.blockedKeywords,
    require_approval_above_micros:
      g.requireApprovalAboveMicros != null ? Number(g.requireApprovalAboveMicros) : null,
  };
}

export const generateCampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    if (!(await canWriteProject(data.projectId, userId))) {
      return { ok: false as const, error: "Projeto não encontrado ou sem acesso." };
    }

    const project = await prisma.project.findFirst({
      where: { id: data.projectId },
      select: { id: true, organizationId: true, paidMode: true },
    });
    if (!project) {
      return { ok: false as const, error: "Projeto não encontrado ou sem acesso." };
    }

    const grRow = await prisma.paidGuardrails.findUnique({
      where: { projectId: data.projectId },
    });
    const gr = grRow ? toGuardrailLimits(grRow) : null;
    const blocked = new Set((gr?.blocked_keywords ?? []).map((s) => s.toLowerCase()));

    const aiRun = await prisma.aiRun.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        feature: "campaign_plan",
        model: "pending",
        promptVersion: "google_v1",
        inputSummary: `${data.objective} · ${data.landingUrl}`,
        status: "pending",
        createdById: userId,
      },
      select: { id: true },
    });

    let plan: AiPlan;
    let tokensIn = 0;
    let tokensOut = 0;
    let model = "fallback/deterministic";
    try {
      const userPrompt = `Landing URL: ${data.landingUrl}
Offer: ${data.offer}
Objective (business outcome): ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo (countries): ${data.geoTargets.join(", ")}
Advertising languages for RSA ad copy (ISO codes; PRIMARY first — write all RSA strings in these languages): ${data.languageTargets.join(", ")}
RSA headline reminder: ≤30 characters each, 12 headlines, benefit-led and aligned with the offer; descriptions ≤90 characters, 4 lines.
Also include JSON key "extensions" with sitelinks (https URLs, preferably same hostname as Landing URL), short callouts, one structured snippet (English header Brands|Services|Types|Models|Destinations — required by Google Ads API).
Blocked keywords (must NOT appear): ${[...blocked].join(", ") || "(none)"}`;
      if (process.env.OPENAI_API_KEY) {
        const out = await fetchOpenAiGoogleCampaignPlan(userPrompt);
        plan = out.plan;
        tokensIn = out.tokensIn;
        tokensOut = out.tokensOut;
        model = out.model;
      } else {
        plan = buildDeterministicGoogleCampaignPlan({
          landingUrl: data.landingUrl,
          offer: data.offer,
          objective: data.objective,
          geoTargets: data.geoTargets,
          languageTargets: data.languageTargets,
        });
      }
    } catch (e) {
      console.error("Google AI call failed, using deterministic fallback:", e);
      plan = buildDeterministicGoogleCampaignPlan({
        landingUrl: data.landingUrl,
        offer: data.offer,
        objective: data.objective,
        geoTargets: data.geoTargets,
        languageTargets: data.languageTargets,
      });
    }

    plan.ad_groups = (plan.ad_groups ?? []).map((ag) => ({
      ...ag,
      keywords: (ag.keywords ?? []).filter((k) => !blocked.has(k.text.toLowerCase())),
    }));

    const google_asset_extensions = finalizeGoogleCampaignAssetExtensions(plan.extensions, {
      landingUrl: data.landingUrl,
      offer: data.offer,
      primaryLanguageIso: data.languageTargets[0] ?? "en",
    });
    const biddingStored = {
      ...storedGoogleBiddingFromPlanInput({
        strategy: "maximize_conversions",
        google_target_cpa_usd: null,
        google_target_roas: null,
      }),
      google_asset_extensions,
    };

    const dailyBudgetMicros = Math.round(data.dailyBudgetUsd * 1_000_000);
    const dailyBudgetMicrosBig = BigInt(dailyBudgetMicros);

    const campaign = await prisma.paidCampaign.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        platform: "google_ads",
        name: plan.campaign?.name ?? "Campanha gerada por IA",
        status: "draft",
        objectiveSummary: plan.campaign?.objective_summary ?? data.objective,
        dailyBudgetMicros: dailyBudgetMicrosBig,
        geoTargets: data.geoTargets,
        languageTargets: data.languageTargets,
        biddingConfig: biddingStored as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    for (const ag of plan.ad_groups ?? []) {
      const agRow = await prisma.paidAdGroup.create({
        data: {
          campaignId: campaign.id,
          name: ag.name,
          status: "draft",
        },
        select: { id: true },
      });

      if (ag.keywords?.length) {
        await prisma.paidKeyword.createMany({
          data: ag.keywords.slice(0, 50).map((k) => ({
            adGroupId: agRow.id,
            text: k.text.slice(0, 80),
            matchType: k.match_type,
            status: "draft" as const,
          })),
        });
      }
      if (ag.rsa) {
        await prisma.paidAdsRsa.create({
          data: {
            adGroupId: agRow.id,
            headlines: ag.rsa.headlines.slice(0, 15).map((h) => h.slice(0, 30)),
            descriptions: ag.rsa.descriptions.slice(0, 4).map((d) => d.slice(0, 90)),
            finalUrls: [data.landingUrl],
            status: "draft",
          },
        });
      }
    }

    const allKeywordTexts = (plan.ad_groups ?? []).flatMap((ag) =>
      (ag.keywords ?? []).map((k) => k.text),
    );
    const evalResult = evaluateGuardrails(
      {
        dailyBudgetMicros,
        geoTargets: data.geoTargets,
        keywordTexts: allKeywordTexts,
      },
      gr,
    );

    const isAutopilot = project.paidMode === "autopilot";
    const shouldTryAutoApply = isAutopilot && evalResult.passed;
    const reasons: GuardrailViolation[] = evalResult.violations;

    const now = new Date();
    let didAutoApply = false;
    if (shouldTryAutoApply) {
      const pub = await publishGoogleSearchCampaignFromLocal(project.id, campaign.id);
      if (pub.ok) {
        didAutoApply = true;
        const crPayload = {
          campaign_id: campaign.id,
          plan,
          daily_budget_micros: dailyBudgetMicros,
          geo_targets: data.geoTargets,
          language_targets: data.languageTargets,
          landing_url: data.landingUrl,
          bidding_config: biddingStored,
          mode: project.paidMode,
          auto_applied: true,
          exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
          reasons,
        };
        await prisma.paidChangeRequest.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.id,
            type: "create_campaign",
            status: "applied",
            requestedById: userId,
            reviewedById: userId,
            reviewedAt: now,
            appliedAt: now,
            errorMessage: null,
            payload: crPayload as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        const crPayload = {
          campaign_id: campaign.id,
          plan,
          daily_budget_micros: dailyBudgetMicros,
          geo_targets: data.geoTargets,
          language_targets: data.languageTargets,
          landing_url: data.landingUrl,
          bidding_config: biddingStored,
          mode: project.paidMode,
          auto_applied: false,
          publish_error: pub.error,
          exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
          reasons,
        };
        await prisma.paidChangeRequest.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.id,
            type: "create_campaign",
            status: "failed",
            requestedById: userId,
            errorMessage: pub.error,
            payload: crPayload as unknown as Prisma.InputJsonValue,
          },
        });
        await prisma.paidCampaign.update({
          where: { id: campaign.id },
          data: { status: "error" },
        });
      }
    } else {
      const crPayload = {
        campaign_id: campaign.id,
        plan,
        daily_budget_micros: dailyBudgetMicros,
        geo_targets: data.geoTargets,
        language_targets: data.languageTargets,
        landing_url: data.landingUrl,
        bidding_config: biddingStored,
        mode: project.paidMode,
        auto_applied: false,
        exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
        reasons,
      };
      await prisma.paidChangeRequest.create({
        data: {
          organizationId: project.organizationId,
          projectId: project.id,
          type: "create_campaign",
          status: "pending",
          requestedById: userId,
          payload: crPayload as unknown as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.aiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "success",
        model,
        tokensIn,
        tokensOut,
        outputSummary: `${plan.ad_groups?.length ?? 0} grupos, ${
          plan.ad_groups?.reduce((n, a) => n + (a.keywords?.length ?? 0), 0) ?? 0
        } palavras-chave · ${
          didAutoApply
            ? "publicado no Google"
            : shouldTryAutoApply
              ? "autopilot: falha na publicação — ver aprovações"
              : "aguardando aprovação"
        }`,
      },
    });

    return {
      ok: true as const,
      campaignId: campaign.id,
      autoApplied: didAutoApply,
      reasons,
    };
  });
