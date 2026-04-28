import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { publishGoogleSearchCampaignFromLocal } from "./google-ads.publish";
import { prisma } from "./paidPrisma";
import { canWriteProject } from "./permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails-eval";

export const googleCampaignPlanInputSchema = z.object({
  landingUrl: z.string().url().max(500),
  offer: z.string().min(3).max(500),
  objective: z.string().min(3).max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.array(z.string().min(2).max(8)).min(1).max(20),
  languageTargets: z.array(z.string().min(2).max(8)).min(1).max(10),
});

export type GoogleCampaignPlanInput = z.infer<typeof googleCampaignPlanInputSchema>;

interface AiPlan {
  campaign: { name: string; objective_summary: string };
  ad_groups: Array<{
    name: string;
    keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
    rsa: { headlines: string[]; descriptions: string[] };
  }>;
}

const SYSTEM_PROMPT = `You are an expert Google Ads Search strategist. Generate a COMPACT, high-quality campaign plan as JSON only.

Rules:
- Return JSON ONLY, matching the schema exactly. No prose, no markdown.
- 2-3 ad groups, each tightly themed.
- 5-10 keywords per ad group across exact/phrase/broad mix.
- 8-12 RSA headlines (max 30 chars each), 3-4 descriptions (max 90 chars each).
- Keywords must be commercial-intent, not brand-only.
- Never include the user's blocked keywords.

Schema:
{
  "campaign": { "name": string, "objective_summary": string },
  "ad_groups": [
    {
      "name": string,
      "keywords": [{ "text": string, "match_type": "exact" | "phrase" | "broad" }],
      "rsa": { "headlines": string[], "descriptions": string[] }
    }
  ]
}`;

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

async function callOpenAiForGooglePlan(userPrompt: string): Promise<{
  plan: AiPlan;
  tokensIn: number;
  tokensOut: number;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const plan = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as AiPlan;
  return {
    plan,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
    model: `openai/${model}`,
  };
}

function deterministicFallback(input: GoogleCampaignPlanInput): AiPlan {
  const slug = input.offer.split(/\s+/).slice(0, 3).join(" ");
  return {
    campaign: {
      name: `${slug} — Search`,
      objective_summary: `${input.objective} for ${input.landingUrl} across ${input.geoTargets.join(", ")}`,
    },
    ad_groups: [
      {
        name: "Core intent",
        keywords: [
          { text: slug.toLowerCase(), match_type: "exact" as const },
          { text: `buy ${slug}`.toLowerCase(), match_type: "phrase" as const },
          { text: `best ${slug}`.toLowerCase(), match_type: "phrase" as const },
          { text: `${slug} pricing`.toLowerCase(), match_type: "phrase" as const },
          { text: `${slug} review`.toLowerCase(), match_type: "broad" as const },
        ],
        rsa: {
          headlines: [
            slug.slice(0, 30),
            `Try ${slug}`.slice(0, 30),
            "Built for teams",
            "Free trial",
            "Get started today",
            "Trusted by pros",
            "No credit card",
            "See it in action",
          ],
          descriptions: [
            `${input.offer}`.slice(0, 90),
            "Set up in minutes. Cancel anytime.".slice(0, 90),
            "Built-in safety controls and approvals.".slice(0, 90),
          ],
        },
      },
    ],
  };
}

export type GoogleCampaignPlanResult =
  | { ok: true; campaignId: string; model: string; autoApplied: boolean; reasons: GuardrailViolation[] }
  | { ok: false; error: string };

export async function runGoogleCampaignPlan(
  projectId: string,
  data: GoogleCampaignPlanInput,
  actor: { userId: string; tenantUserId: string },
): Promise<GoogleCampaignPlanResult> {
  if (!(await canWriteProject(projectId, actor.userId, actor.tenantUserId))) {
    return { ok: false, error: "Projeto não encontrado ou sem acesso." };
  }

  const project = await prisma.paidAdsProject.findFirst({
    where: { id: projectId, userId: actor.tenantUserId },
    select: { id: true, userId: true, paidMode: true },
  });
  if (!project) {
    return { ok: false, error: "Projeto não encontrado ou sem acesso." };
  }

  const ownerUserId = project.userId;

  const grRow = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
  const gr = grRow ? toGuardrailLimits(grRow) : null;
  const blocked = new Set((gr?.blocked_keywords ?? []).map((s) => s.toLowerCase()));

  const aiRun = await prisma.paidAdsAiRun.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      feature: "campaign_plan",
      model: "pending",
      promptVersion: "google_v1",
      inputSummary: `${data.objective} · ${data.landingUrl}`,
      status: "pending",
      createdById: actor.userId,
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
Objective: ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo: ${data.geoTargets.join(", ")}
Languages: ${data.languageTargets.join(", ")}
Blocked keywords (must NOT appear): ${[...blocked].join(", ") || "(none)"}`;
    if (process.env.OPENAI_API_KEY) {
      const out = await callOpenAiForGooglePlan(userPrompt);
      plan = out.plan;
      tokensIn = out.tokensIn;
      tokensOut = out.tokensOut;
      model = out.model;
    } else {
      plan = deterministicFallback(data);
    }
  } catch (e) {
    console.error("Google AI call failed, using deterministic fallback:", e);
    plan = deterministicFallback(data);
  }

  plan.ad_groups = (plan.ad_groups ?? []).map((ag) => ({
    ...ag,
    keywords: (ag.keywords ?? []).filter((k) => !blocked.has(k.text.toLowerCase())),
  }));

  const dailyBudgetMicros = Math.round(data.dailyBudgetUsd * 1_000_000);
  const dailyBudgetMicrosBig = BigInt(dailyBudgetMicros);

  const campaign = await prisma.paidAdsCampaign.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      platform: "google_ads",
      name: plan.campaign?.name ?? "Campanha gerada por IA",
      status: "draft",
      objectiveSummary: plan.campaign?.objective_summary ?? data.objective,
      dailyBudgetMicros: dailyBudgetMicrosBig,
      geoTargets: data.geoTargets,
      languageTargets: data.languageTargets,
    },
    select: { id: true },
  });

  for (const ag of plan.ad_groups ?? []) {
    const agRow = await prisma.paidAdsAdGroup.create({
      data: {
        campaignId: campaign.id,
        name: ag.name,
        status: "draft",
      },
      select: { id: true },
    });

    if (ag.keywords?.length) {
      await prisma.paidAdsKeyword.createMany({
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

  const allKeywordTexts = (plan.ad_groups ?? []).flatMap((ag) => (ag.keywords ?? []).map((k) => k.text));
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
        mode: project.paidMode,
        auto_applied: true,
        exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
        reasons,
      };
      await prisma.paidAdsChangeRequest.create({
        data: {
          userId: ownerUserId,
          projectId: project.id,
          type: "create_campaign",
          status: "applied",
          requestedById: actor.userId,
          reviewedById: actor.userId,
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
        mode: project.paidMode,
        auto_applied: false,
        publish_error: pub.error,
        exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
        reasons,
      };
      await prisma.paidAdsChangeRequest.create({
        data: {
          userId: ownerUserId,
          projectId: project.id,
          type: "create_campaign",
          status: "failed",
          requestedById: actor.userId,
          errorMessage: pub.error,
          payload: crPayload as unknown as Prisma.InputJsonValue,
        },
      });
      await prisma.paidAdsCampaign.update({
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
      mode: project.paidMode,
      auto_applied: false,
      exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
      reasons,
    };
    await prisma.paidAdsChangeRequest.create({
      data: {
        userId: ownerUserId,
        projectId: project.id,
        type: "create_campaign",
        status: "pending",
        requestedById: actor.userId,
        payload: crPayload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.paidAdsAiRun.update({
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

  return { ok: true, campaignId: campaign.id, model, autoApplied: didAutoApply, reasons };
}
