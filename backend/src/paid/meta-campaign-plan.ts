import type { PaidAdsMetaCta, Prisma } from "@prisma/client";
import { z } from "zod";

import { adCopyLocaleHintFromGeoIso2 } from "./ad-copy-locale";
import { publishMetaCreateCampaignFromLocal } from "./meta-ads.publish";
import { prisma } from "./paidPrisma";
import { canWriteProject } from "./permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails-eval";

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

export const metaCampaignPlanInputSchema = z.object({
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

export type MetaCampaignPlanInput = z.infer<typeof metaCampaignPlanInputSchema>;

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
- 1 ad set with clear targeting aligned to objective (maps to Meta OUTCOME_* campaign objectives).
- Exactly 3 creative variants, each unique angle.
- primary_text <= 125 chars. headline <= 40 chars. description <= 30 chars.
- Compliance footer awareness: never claim guaranteed results, never use prohibited Meta categories language.
- cta MUST be one of: learn_more, shop_now, sign_up, contact_us, book_now, download, get_quote, subscribe.
- Ad copy language: write primary_text, headline, and description in the locale indicated in the user prompt (geo-based). Native phrasing; avoid awkward machine translation.

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

function deterministicFallback(data: MetaCampaignPlanInput): MetaPlan {
  const offerShort = data.offer.split(/\s+/).slice(0, 4).join(" ");
  const objectiveLabel: Record<z.infer<typeof objectiveEnum>, string> = {
    traffic: "Tráfego para o site",
    leads: "Geração de leads",
    purchases: "Conversões / vendas",
    awareness: "Reconhecimento de marca",
    engagement: "Engajamento",
    app_promotion: "Promoção de app",
  };
  const locale = adCopyLocaleHintFromGeoIso2(data.geoTargets);

  type Cr = {
    primary_text: string;
    headline: string;
    description: string;
    cta: z.infer<typeof ctaEnum>;
  };

  let creatives: Cr[];

  if (locale === "Portuguese") {
    creatives = [
      {
        primary_text: `${data.offer}`.slice(0, 125),
        headline: offerShort.slice(0, 40),
        description: "Saiba mais hoje".slice(0, 30),
        cta: "learn_more",
      },
      {
        primary_text: `Descubra ${offerShort}. Oferta clara, página rápida.`.slice(0, 125),
        headline: `Conheça ${offerShort}`.slice(0, 40),
        description: "Comece agora".slice(0, 30),
        cta: data.objective === "purchases" ? "shop_now" : "sign_up",
      },
      {
        primary_text:
          `Pronto para ${data.objective === "leads" ? "falar connosco" : "experimentar"}? ${offerShort}.`.slice(0, 125),
        headline: "Fale connosco".slice(0, 40),
        description: "Resposta rápida".slice(0, 30),
        cta: data.objective === "leads" ? "contact_us" : "learn_more",
      },
    ];
  } else if (locale === "Spanish") {
    creatives = [
      {
        primary_text: `${data.offer}`.slice(0, 125),
        headline: offerShort.slice(0, 40),
        description: "Más información".slice(0, 30),
        cta: "learn_more",
      },
      {
        primary_text: `Descubre ${offerShort}. Oferta clara.`.slice(0, 125),
        headline: `Prueba ${offerShort}`.slice(0, 40),
        description: "Empieza ya".slice(0, 30),
        cta: data.objective === "purchases" ? "shop_now" : "sign_up",
      },
      {
        primary_text: `¿Listo para ${data.objective === "leads" ? "hablar" : "probar"}?`.slice(0, 125),
        headline: "Te ayudamos".slice(0, 40),
        description: "Respuesta rápida".slice(0, 30),
        cta: data.objective === "leads" ? "contact_us" : "learn_more",
      },
    ];
  } else {
    creatives = [
      {
        primary_text: `${data.offer}`.slice(0, 125),
        headline: offerShort.slice(0, 40),
        description: "Learn more today".slice(0, 30),
        cta: "learn_more",
      },
      {
        primary_text: `Discover ${offerShort}. Simple setup.`.slice(0, 125),
        headline: `Try ${offerShort}`.slice(0, 40),
        description: "Get started".slice(0, 30),
        cta: data.objective === "purchases" ? "shop_now" : "sign_up",
      },
      {
        primary_text:
          `Ready to ${data.objective === "leads" ? "talk" : "try"}? ${offerShort}.`.slice(0, 125),
        headline: "We're here to help".slice(0, 40),
        description: "Quick reply".slice(0, 30),
        cta: data.objective === "leads" ? "contact_us" : "learn_more",
      },
    ];
  }

  return {
    campaign: {
      name: `${offerShort} — Meta ${data.objective}`,
      objective_summary: `${objectiveLabel[data.objective]} para ${data.landingUrl} em ${data.geoTargets.join(", ")}`,
    },
    adset: {
      name: "Conjunto principal",
      optimization_goal:
        data.objective === "leads"
          ? "LEAD_GENERATION"
          : data.objective === "purchases"
            ? "OFFSITE_CONVERSIONS"
            : "LINK_CLICKS",
      targeting: {
        geo: data.geoTargets,
        age_min: data.ageMin,
        age_max: data.ageMax,
        gender: "all",
        interests_notes: data.audienceNotes.slice(0, 300),
      },
    },
    creatives,
  };
}

const CTA_SET = new Set<string>([
  "learn_more",
  "shop_now",
  "sign_up",
  "contact_us",
  "book_now",
  "download",
  "get_quote",
  "subscribe",
]);

function parseCta(v: string): PaidAdsMetaCta {
  return (CTA_SET.has(v) ? v : "learn_more") as PaidAdsMetaCta;
}

export type MetaCampaignPlanResult =
  | { ok: true; campaignId: string; model: string; autoApplied: boolean; reasons: GuardrailViolation[] }
  | { ok: false; error: string };

export async function runMetaCampaignPlan(
  projectId: string,
  data: MetaCampaignPlanInput,
  actor: { userId: string; tenantUserId: string },
): Promise<MetaCampaignPlanResult> {
  const strict =
    process.env.PAID_META_STRICT_CONVERSIONS === "1" || process.env.PAID_META_STRICT_CONVERSIONS === "true";
  if (strict && (data.objective === "purchases" || data.objective === "leads")) {
    return {
      ok: false,
      error:
        "Modo estrito: objetivos conversões e leads exigem pixel (e/ou eventos) configurados no Meta Ads. Configure a conta, ou desative PAID_META_STRICT_CONVERSIONS no servidor para gerar o plano em rascunho e validar a seguir no Ads Manager.",
    };
  }
  if (data.ageMax < data.ageMin) {
    return { ok: false, error: "Idade máxima deve ser >= idade mínima." };
  }
  if (!data.complianceAcknowledged) {
    return {
      ok: false,
      error:
        "Você precisa confirmar a declaração de conformidade com as políticas do Meta antes de gerar o plano.",
    };
  }
  const sensitive = (data.specialAdCategories ?? []).filter((c) => c !== "none");
  if (sensitive.length > 0 && data.ageMin < 18) {
    return {
      ok: false,
      error: "Categorias especiais de anúncios exigem idade mínima de 18 anos. Ajuste a faixa etária.",
    };
  }

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

  const aiRun = await prisma.paidAdsAiRun.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      feature: "campaign_plan",
      model: "pending",
      promptVersion: "meta_v1",
      inputSummary: `Meta · ${data.objective} · ${data.landingUrl}`,
      status: "pending",
      createdById: actor.userId,
    },
    select: { id: true },
  });

  const localeHint = adCopyLocaleHintFromGeoIso2(data.geoTargets);
  const userPrompt = `Landing URL: ${data.landingUrl}
Offer: ${data.offer}
Audience notes: ${data.audienceNotes}
Objective (product mapping — aligns with Meta OUTCOME_*): ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo: ${data.geoTargets.join(", ")}
Ad copy locale (write creatives in this language): ${localeHint}
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

  const campaign = await prisma.paidAdsCampaign.create({
    data: {
      userId: ownerUserId,
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

  const adset = await prisma.paidAdsMetaAdset.create({
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
    const rawCta = typeof c.cta === "string" ? c.cta : "learn_more";
    const cta = parseCta(rawCta);
    const cr = await prisma.paidAdsMetaCreative.create({
      data: {
        adsetId: adset.id,
        primaryText: (c.primary_text ?? "").slice(0, 125),
        headline: (c.headline ?? "").slice(0, 40),
        description: (c.description ?? "").slice(0, 30) || " ",
        cta,
        destinationUrl: data.landingUrl,
        placements: data.placements,
        imageAssetRef: data.assetPath ?? null,
        status: "draft",
      },
      select: { id: true },
    });
    await prisma.paidAdsMetaAd.create({
      data: {
        adsetId: adset.id,
        creativeId: cr.id,
        name: (c.headline ?? "Anúncio").slice(0, 40),
        status: "draft",
      },
    });
  }

  const grRow = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
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
    compliance_acknowledged_by: actor.userId,
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
      await prisma.paidAdsChangeRequest.create({
        data: {
          userId: ownerUserId,
          projectId: project.id,
          type: "meta_create_campaign",
          status: "applied",
          requestedById: actor.userId,
          reviewedById: actor.userId,
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
      await prisma.paidAdsChangeRequest.create({
        data: {
          userId: ownerUserId,
          projectId: project.id,
          type: "meta_create_campaign",
          status: "failed",
          requestedById: actor.userId,
          errorMessage: pub.error,
          payload: {
            ...crPayload,
            auto_applied: false,
            publish_error: pub.error,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { status: "error" },
      });
    }
  } else {
    await prisma.paidAdsChangeRequest.create({
      data: {
        userId: ownerUserId,
        projectId: project.id,
        type: "meta_create_campaign",
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
    ok: true,
    campaignId: campaign.id,
    model,
    autoApplied: didAutoApply,
    reasons,
  };
}
