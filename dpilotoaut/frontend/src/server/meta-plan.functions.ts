import { createServerFn } from "@tanstack/react-start";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { publishMetaCreateCampaignFromLocal } from "@backend/meta-ads.publish";
import { canWriteProject } from "@backend/permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails";

const placementEnum = z.enum([
  "facebook_feed",
  "instagram_feed",
  "instagram_stories",
  "instagram_reels",
  "facebook_reels",
  "audience_network",
  "messenger",
]);

const objectiveEnum = z.enum([
  "traffic",
  "leads",
  "purchases",
  "awareness",
  "engagement",
  "app_promotion",
]);

const ctaEnum = z.enum([
  "learn_more",
  "shop_now",
  "sign_up",
  "contact_us",
  "book_now",
  "download",
  "get_quote",
  "subscribe",
]);

const specialCategoryEnum = z.enum([
  "none",
  "credit",
  "employment",
  "housing",
  "issues_elections_politics",
  "online_gambling_and_gaming",
]);

const inputSchema = z.object({
  projectId: z.string().uuid(),
  landingUrl: z.string().url().max(500),
  offer: z.string().min(3).max(500),
  audienceNotes: z.string().min(3).max(800),
  objective: objectiveEnum,
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.array(z.string().min(2).max(8)).min(1).max(20),
  placements: z.array(placementEnum).min(1).max(7),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
  specialAdCategories: z.array(specialCategoryEnum).max(6).default([]),
  complianceAcknowledged: z.boolean(),
  assetPath: z.string().max(300).nullable().optional(),
});

interface MetaPlan {
  campaign: { name: string; objective_summary: string };
  adset: {
    name: string;
    optimization_goal: string;
    targeting: {
      geo: string[];
      age_min: number;
      age_max: number;
      gender: "all" | "male" | "female";
      interests_notes: string;
    };
  };
  creatives: Array<{
    primary_text: string;
    headline: string;
    description: string;
    cta: z.infer<typeof ctaEnum>;
  }>;
}

const SYSTEM_PROMPT = `You are a senior Meta Ads (Facebook + Instagram) media buyer. Generate a COMPACT campaign plan as JSON only.

Rules:
- Return JSON ONLY matching the schema. No prose, no markdown.
- 1 ad set with clear targeting.
- Exactly 3 creative variants, each unique angle.
- primary_text <= 125 chars. headline <= 40 chars. description <= 30 chars.
- Compliance footer awareness: never claim guaranteed results, never use prohibited Meta categories language.
- cta MUST be one of: learn_more, shop_now, sign_up, contact_us, book_now, download, get_quote, subscribe.

Schema:
{
  "campaign": { "name": string, "objective_summary": string },
  "adset": {
    "name": string,
    "optimization_goal": string,
    "targeting": { "geo": string[], "age_min": number, "age_max": number, "gender": "all"|"male"|"female", "interests_notes": string }
  },
  "creatives": [{ "primary_text": string, "headline": string, "description": string, "cta": string }]
}`;

type ProviderResult = { plan: MetaPlan; tokensIn: number; tokensOut: number; model: string };

async function callOpenAi(userPrompt: string): Promise<ProviderResult> {
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
  return {
    plan: JSON.parse(json.choices[0]?.message?.content ?? "{}") as MetaPlan,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
    model: `openai/${model}`,
  };
}

async function callAnthropic(userPrompt: string): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = "claude-3-5-haiku-20241022";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    content: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const raw = json.content?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\n?|```$/g, "").trim();
  return {
    plan: JSON.parse(cleaned) as MetaPlan,
    tokensIn: json.usage?.input_tokens ?? 0,
    tokensOut: json.usage?.output_tokens ?? 0,
    model: `anthropic/${model}`,
  };
}

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

function deterministicFallback(input: z.infer<typeof inputSchema>): MetaPlan {
  const offerShort = input.offer.split(/\s+/).slice(0, 4).join(" ");
  const objectiveLabel: Record<z.infer<typeof objectiveEnum>, string> = {
    traffic: "Tráfego para o site",
    leads: "Geração de leads",
    purchases: "Conversões / vendas",
    awareness: "Reconhecimento de marca",
    engagement: "Engajamento",
    app_promotion: "Promoção de app",
  };
  return {
    campaign: {
      name: `${offerShort} — Meta ${input.objective}`,
      objective_summary: `${objectiveLabel[input.objective]} para ${input.landingUrl} em ${input.geoTargets.join(", ")}`,
    },
    adset: {
      name: "Conjunto principal",
      optimization_goal:
        input.objective === "leads"
          ? "LEAD_GENERATION"
          : input.objective === "purchases"
            ? "OFFSITE_CONVERSIONS"
            : "LINK_CLICKS",
      targeting: {
        geo: input.geoTargets,
        age_min: input.ageMin,
        age_max: input.ageMax,
        gender: "all",
        interests_notes: input.audienceNotes.slice(0, 300),
      },
    },
    creatives: [
      {
        primary_text: `${input.offer}`.slice(0, 125),
        headline: offerShort.slice(0, 40),
        description: "Saiba mais hoje".slice(0, 30),
        cta: "learn_more",
      },
      {
        primary_text: `Descubra ${offerShort}. Sem complicação.`.slice(0, 125),
        headline: `Conheça ${offerShort}`.slice(0, 40),
        description: "Comece agora".slice(0, 30),
        cta: input.objective === "purchases" ? "shop_now" : "sign_up",
      },
      {
        primary_text:
          `Pronto para ${input.objective === "leads" ? "conversar" : "experimentar"}? ${offerShort}.`.slice(
            0,
            125,
          ),
        headline: "Fale com a gente".slice(0, 40),
        description: "Resposta rápida".slice(0, 30),
        cta: input.objective === "leads" ? "contact_us" : "learn_more",
      },
    ],
  };
}

export const generateMetaCampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    if (data.ageMax < data.ageMin) {
      return { ok: false as const, error: "Idade máxima deve ser >= idade mínima." };
    }
    if (!data.complianceAcknowledged) {
      return {
        ok: false as const,
        error:
          "Você precisa confirmar a declaração de conformidade com as políticas do Meta antes de gerar o plano.",
      };
    }
    const sensitive = (data.specialAdCategories ?? []).filter((c) => c !== "none");
    if (sensitive.length > 0 && data.ageMin < 18) {
      return {
        ok: false as const,
        error:
          "Categorias especiais de anúncios exigem idade mínima de 18 anos. Ajuste a faixa etária.",
      };
    }

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

    const aiRun = await prisma.aiRun.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        feature: "campaign_plan",
        model: "pending",
        promptVersion: "meta_v1",
        inputSummary: `Meta · ${data.objective} · ${data.landingUrl}`,
        status: "pending",
        createdById: userId,
      },
      select: { id: true },
    });

    const userPrompt = `Landing URL: ${data.landingUrl}
Offer: ${data.offer}
Audience notes: ${data.audienceNotes}
Objective: ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo: ${data.geoTargets.join(", ")}
Placements: ${data.placements.join(", ")}
Age range: ${data.ageMin}-${data.ageMax}`;

    let plan: MetaPlan;
    let tokensIn = 0;
    let tokensOut = 0;
    let model = "fallback/deterministic";
    try {
      let result: ProviderResult | null = null;
      if (process.env.OPENAI_API_KEY) {
        result = await callOpenAi(userPrompt);
      } else if (process.env.ANTHROPIC_API_KEY) {
        result = await callAnthropic(userPrompt);
      }
      if (result) {
        plan = result.plan;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = result.model;
      } else {
        plan = deterministicFallback(data);
      }
    } catch (e) {
      console.error("Meta AI provider failed, using fallback:", e);
      plan = deterministicFallback(data);
    }

    const dailyBudgetMicros = BigInt(Math.round(data.dailyBudgetUsd * 1_000_000));
    const dailyBudgetCents = BigInt(Math.round(data.dailyBudgetUsd * 100));

    const campaign = await prisma.paidCampaign.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        platform: "meta_ads",
        name: plan.campaign?.name ?? "Campanha Meta",
        status: "draft",
        objectiveSummary: plan.campaign?.objective_summary ?? data.offer,
        dailyBudgetMicros,
        geoTargets: data.geoTargets,
        languageTargets: [],
      },
      select: { id: true },
    });

    const adset = await prisma.metaAdset.create({
      data: {
        campaignId: campaign.id,
        name: plan.adset?.name ?? "Conjunto principal",
        status: "draft",
        dailyBudgetCents,
        optimizationGoal: plan.adset?.optimization_goal ?? "LINK_CLICKS",
        targeting: (plan.adset?.targeting ?? {
          geo: data.geoTargets,
          age_min: data.ageMin,
          age_max: data.ageMax,
          gender: "all",
          interests_notes: data.audienceNotes,
        }) as object,
      },
      select: { id: true },
    });

    const creatives = (plan.creatives ?? []).slice(0, 5);
    for (const c of creatives) {
      const cta = ctaEnum.safeParse(c.cta).success ? c.cta : "learn_more";
      const cr = await prisma.metaCreative.create({
        data: {
          adsetId: adset.id,
          primaryText: (c.primary_text ?? "").slice(0, 125),
          headline: (c.headline ?? "").slice(0, 40),
          description: (c.description ?? "").slice(0, 30),
          cta,
          destinationUrl: data.landingUrl,
          placements: data.placements,
          imageAssetRef: data.assetPath ?? null,
          status: "draft",
        },
        select: { id: true },
      });
      await prisma.metaAd.create({
        data: {
          adsetId: adset.id,
          creativeId: cr.id,
          name: (c.headline ?? "Anúncio").slice(0, 40),
          status: "draft",
        },
      });
    }

    const grRow = await prisma.paidGuardrails.findUnique({ where: { projectId: data.projectId } });
    const gr = grRow ? toGuardrailLimits(grRow) : null;
    const evalResult = evaluateGuardrails(
      {
        dailyBudgetMicros: Number(dailyBudgetMicros),
        geoTargets: data.geoTargets,
        keywordTexts: [],
      },
      gr,
    );
    const reasons: GuardrailViolation[] = evalResult.violations;
    const isAutopilot = project.paidMode === "autopilot";
    const shouldTryAutoApply = isAutopilot && evalResult.passed;
    const now = new Date();
    let didAutoApply = false;

    const crPayload = {
      platform: "meta_ads" as const,
      campaign_id: campaign.id,
      plan,
      daily_budget_cents: Number(dailyBudgetCents),
      daily_budget_micros: Number(dailyBudgetMicros),
      geo_targets: data.geoTargets,
      placements: data.placements,
      landing_url: data.landingUrl,
      objective: data.objective,
      mode: project.paidMode,
      auto_applied: false,
      exceeds_daily_cap: reasons.some((r) => r.code === "exceeds_daily_cap"),
      special_ad_categories: sensitive,
      compliance_acknowledged_by: userId,
      compliance_acknowledged_at: new Date().toISOString(),
      asset_path: data.assetPath ?? null,
      compliance_notice:
        sensitive.length > 0
          ? `Categorias especiais declaradas: ${sensitive.join(", ")}. Limitações de targeting do Meta serão aplicadas no momento da publicação.`
          : "O anunciante é responsável pelo cumprimento das políticas do Meta (incluindo categorias especiais de anúncios).",
      reasons,
    };

    if (shouldTryAutoApply) {
      const pub = await publishMetaCreateCampaignFromLocal(
        project.id,
        campaign.id,
        crPayload as unknown as Prisma.JsonObject,
      );
      if (pub.ok) {
        didAutoApply = true;
        await prisma.paidChangeRequest.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.id,
            type: "meta_create_campaign",
            status: "applied",
            requestedById: userId,
            reviewedById: userId,
            reviewedAt: now,
            appliedAt: now,
            errorMessage: null,
            payload: {
              ...crPayload,
              auto_applied: true,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.paidChangeRequest.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.id,
            type: "meta_create_campaign",
            status: "failed",
            requestedById: userId,
            errorMessage: pub.error,
            payload: {
              ...crPayload,
              auto_applied: false,
              publish_error: pub.error,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        await prisma.paidCampaign.update({
          where: { id: campaign.id },
          data: { status: "error" },
        });
      }
    } else {
      await prisma.paidChangeRequest.create({
        data: {
          organizationId: project.organizationId,
          projectId: project.id,
          type: "meta_create_campaign",
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
        outputSummary: `Meta · 1 conjunto · ${plan.creatives?.length ?? 0} criativos · ${
          didAutoApply
            ? "publicado no Meta"
            : shouldTryAutoApply
              ? "autopilot: falha na publicação — ver aprovações"
              : "aguardando aprovação"
        }`,
      },
    });

    return {
      ok: true as const,
      campaignId: campaign.id,
      model,
      autoApplied: didAutoApply,
      reasons,
    };
  });
