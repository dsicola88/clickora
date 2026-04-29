import { createServerFn } from "@tanstack/react-start";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { publishGoogleSearchCampaignFromLocal } from "@backend/google-ads.publish";
import { buildDeterministicRsa } from "@backend/google-rsa-deterministic";
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
- RSA: Exactly 12 headlines and 4 descriptions per ad group whenever possible (Google RSA limits: each headline MAX 30 characters including spaces/punctuation — count carefully; each description MAX 90 characters). Headlines must be persuasive and SPECIFIC to the Offer and Landing URL (benefits, outcomes, reassurance, urgency only if truthful). Prefer headlines that use almost the full 30-character budget — avoid tepid micro-copy like single words or obvious filler; weave in product-relevant phrases and commercial keywords where natural.
- Descriptions must be full persuasive sentences up to ~90 chars: clear value proposition, proof angle, delivery/trust cues when appropriate; align tightly with Objective and Offer.
- Keywords must be commercial-intent, not brand-only.
- Never include the user's blocked keywords.
- RSA copy: write in the language of the user's offer/locale when clear; otherwise match the primary language in the user prompt. Do NOT use generic SaaS phrases (e.g. "built for teams", "free trial") unless they exactly match the product.
If generation runs without AI (fallback mode), RSA copy is composed deterministically from Offer, Objective, and Landing URL only — your JSON output matches that principle when AI is enabled.

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

function deterministicFallback(input: z.infer<typeof inputSchema>): AiPlan {
  const slug = input.offer.split(/\s+/).slice(0, 3).join(" ");
  const rsa = buildDeterministicRsa(
    {
      landingUrl: input.landingUrl,
      offer: input.offer,
      objective: input.objective,
    },
    input.languageTargets[0] ?? "en",
  );
  return {
    campaign: {
      name: `${slug} — Search`,
      objective_summary: `${input.objective} for ${input.landingUrl} across ${input.geoTargets.join(", ")}`,
    },
    ad_groups: [
      {
        name: "Core intent",
        keywords: [
          { text: slug.toLowerCase(), match_type: "exact" },
          { text: `buy ${slug}`.toLowerCase(), match_type: "phrase" },
          { text: `best ${slug}`.toLowerCase(), match_type: "phrase" },
          { text: `${slug} pricing`.toLowerCase(), match_type: "phrase" },
          { text: `${slug} review`.toLowerCase(), match_type: "broad" },
        ],
        rsa,
      },
    ],
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
        promptVersion: "v1",
        inputSummary: `${data.objective} · ${data.landingUrl}`,
        status: "pending",
        createdById: userId,
      },
      select: { id: true },
    });

    let plan: AiPlan;
    let tokensIn = 0;
    let tokensOut = 0;
    let model = "fallback";
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
      console.error("AI call failed, using deterministic fallback:", e);
      plan = deterministicFallback(data);
    }

    plan.ad_groups = (plan.ad_groups ?? []).map((ag) => ({
      ...ag,
      keywords: (ag.keywords ?? []).filter((k) => !blocked.has(k.text.toLowerCase())),
    }));

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
