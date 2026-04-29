import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { adCopyLocaleHintFromGeoIso2 } from "./ad-copy-locale";
import { publishTikTokCreateCampaignFromLocal } from "./tiktok-ads.publish";
import { prisma } from "./paidPrisma";
import { canWriteProject } from "./permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails-eval";

const objectiveEnum = z.enum([
  "traffic",
  "reach",
  "video_views",
  "leads",
  "conversions",
  "app_installs",
]);

/** Valores aceites pela API TikTok v1.3 (campaign → objective_type). */
export function mapTiktokObjectiveType(o: z.infer<typeof objectiveEnum>): string {
  const m: Record<z.infer<typeof objectiveEnum>, string> = {
    traffic: "TRAFFIC",
    reach: "RF_REACH",
    video_views: "VIDEO_VIEWS",
    leads: "LEAD_GENERATION",
    conversions: "CONVERSIONS",
    app_installs: "APP_INSTALL",
  };
  return m[o];
}

export const tiktokCampaignPlanInputSchema = z.object({
  landingUrl: z.string().url().max(500),
  offer: z.string().min(3).max(500),
  audienceNotes: z.string().min(3).max(800),
  objective: objectiveEnum,
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.array(z.string().min(2).max(8)).min(1).max(20),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
  complianceAcknowledged: z.boolean(),
  videoAssetPath: z.string().max(500).nullable().optional(),
});

export type TiktokCampaignPlanInput = z.infer<typeof tiktokCampaignPlanInputSchema>;

interface TiktokPlan {
  campaign: { name: string; summary: string };
  hooks: { texts: string[]; tone: string };
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

const SYSTEM_PROMPT = `You are a senior TikTok Ads media buyer. Output JSON only (no markdown).
Schema:
{
  "campaign": { "name": string (max 120 chars), "summary": string (max 400) },
  "hooks": { "texts": string[] (3 short hook lines, each max 80 chars, vertical video / sound-on mindset), "tone": string }
}
TikTok is video-first. Hooks should feel native (authentic, not corporate spam).
Write hook texts in the language/locale specified in the user prompt (geo-based); native slang ok when appropriate for the audience.`;

type ProviderResult = { plan: TiktokPlan; tokensIn: number; tokensOut: number; model: string };

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
    plan: JSON.parse(json.choices[0]?.message?.content ?? "{}") as TiktokPlan,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
    model: `openai/${model}`,
  };
}

function deterministicFallback(data: TiktokCampaignPlanInput): TiktokPlan {
  const offerShort = data.offer.split(/\s+/).slice(0, 5).join(" ");
  const label: Record<z.infer<typeof objectiveEnum>, string> = {
    traffic: "Tráfego",
    reach: "Alcance",
    video_views: "Visualizações de vídeo",
    leads: "Leads",
    conversions: "Conversões",
    app_installs: "Instalações de app",
  };
  const locale = adCopyLocaleHintFromGeoIso2(data.geoTargets);
  let hooks: { texts: string[]; tone: string };
  if (locale === "Portuguese") {
    hooks = {
      tone: "directo, mobile-first, estilo UGC em PT",
      texts: [
        `Porquê ${offerShort.slice(0, 40)}? Ganha atenção no feed.`,
        "Sem enrolação: experimenta hoje — oferta clara e prova social.",
        "Landing rápida e segura: menos fricção, mais conversão.",
      ],
    };
  } else if (locale === "Spanish") {
    hooks = {
      tone: "directo, vertical, estilo creador ES",
      texts: [
        `¿Por ${offerShort.slice(0, 40)}? Resultados en el feed.`,
        "Sin rodeos: prueba hoy con oferta clara.",
        "Página rápida y segura: menos fricción.",
      ],
    };
  } else {
    hooks = {
      tone: "direct, mobile-first, UGC-style",
      texts: [
        `Why ${offerShort.slice(0, 40)}? Win attention in-feed.`,
        "No fluff — try today with a clear offer and proof.",
        "Fast landing, trusted destination.",
      ],
    };
  }
  return {
    campaign: {
      name: `${offerShort} — TikTok ${label[data.objective]}`.slice(0, 120),
      summary: `${label[data.objective]} em ${data.geoTargets.join(", ")}. URL: ${data.landingUrl}. ${data.audienceNotes.slice(0, 200)}`,
    },
    hooks,
  };
}

export type TiktokCampaignPlanResult =
  | { ok: true; campaignId: string; model: string; autoApplied: boolean; reasons: GuardrailViolation[] }
  | { ok: false; error: string };

export async function runTiktokCampaignPlan(
  projectId: string,
  data: TiktokCampaignPlanInput,
  actor: { userId: string; tenantUserId: string },
): Promise<TiktokCampaignPlanResult> {
  const strict = process.env.PAID_TIKTOK_STRICT_OBJECTIVES === "1" || process.env.PAID_TIKTOK_STRICT_OBJECTIVES === "true";
  if (strict && (data.objective === "conversions" || data.objective === "leads")) {
    return {
      ok: false,
      error:
        "Modo estrito: objetivos Conversões/Leads exigem pixel ou formulário configurados no TikTok Ads. Desactive PAID_TIKTOK_STRICT_OBJECTIVES ou configure a conta, depois tente de novo.",
    };
  }
  if (data.ageMax < data.ageMin) {
    return { ok: false, error: "Idade máxima deve ser >= idade mínima." };
  }
  if (!data.complianceAcknowledged) {
    return {
      ok: false,
      error: "Confirme a declaração de conformidade com as políticas do TikTok Ads antes de continuar.",
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
  const objectiveType = mapTiktokObjectiveType(data.objective);

  const aiRun = await prisma.paidAdsAiRun.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      feature: "campaign_plan",
      model: "pending",
      promptVersion: "tiktok_v1",
      inputSummary: `TikTok · ${data.objective} · ${data.landingUrl}`,
      status: "pending",
      createdById: actor.userId,
    },
    select: { id: true },
  });

  const localeHint = adCopyLocaleHintFromGeoIso2(data.geoTargets);
  const userPrompt = `Landing: ${data.landingUrl}
Offer: ${data.offer}
Audience: ${data.audienceNotes}
TikTok objective (mapped to API as ${objectiveType}): ${data.objective}
Daily budget USD: ${data.dailyBudgetUsd}
Geo (ISO2): ${data.geoTargets.join(", ")}
Hook / copy locale (write hooks in this language): ${localeHint}
Age: ${data.ageMin}-${data.ageMax}
Has uploaded video file path: ${data.videoAssetPath ?? "(none — ad creative on TikTok still needs video in Ads Manager for full ad)"}`;

  let plan: TiktokPlan;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = "fallback/deterministic";
  try {
    if (process.env.OPENAI_API_KEY) {
      const result = await callOpenAi(userPrompt);
      plan = result.plan;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      model = result.model;
    } else {
      plan = deterministicFallback(data);
    }
  } catch (e) {
    console.error("TikTok AI provider failed, using fallback:", e);
    plan = deterministicFallback(data);
  }

  const dailyBudgetMicros = BigInt(Math.round(data.dailyBudgetUsd * 1_000_000));

  const campaign = await prisma.paidAdsCampaign.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      platform: "tiktok_ads",
      name: (plan.campaign?.name ?? `TikTok — ${data.offer}`).slice(0, 500),
      status: "draft",
      objectiveSummary: (plan.campaign?.summary ?? data.audienceNotes).slice(0, 2000),
      dailyBudgetMicros,
      geoTargets: data.geoTargets,
      languageTargets: [],
    },
    select: { id: true },
  });

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
    platform: "tiktok_ads" as const,
    campaign_id: campaign.id,
    objective_type: objectiveType,
    plan,
    daily_budget_micros: Number(dailyBudgetMicros),
    geo_targets: data.geoTargets,
    age_min: data.ageMin,
    age_max: data.ageMax,
    landing_url: data.landingUrl,
    mode: project.paidMode,
    auto_applied: false,
    video_asset_path: data.videoAssetPath ?? null,
    compliance_acknowledged: data.complianceAcknowledged,
    compliance_acknowledged_by: actor.userId,
    compliance_acknowledged_at: new Date().toISOString(),
    compliance_notice:
      "O anunciante é responsável pelo cumprimento das políticas de conteúdo e anúncios do TikTok. Criar anúncios de vídeo completos no feed pode exigir passos adicionais no TikTok Ads Manager.",
    reasons,
  };

  if (shouldTryAutoApply) {
    const pub = await publishTikTokCreateCampaignFromLocal(
      project.id,
      campaign.id,
      crPayload as unknown as Record<string, unknown>,
    );
    if (pub.ok) {
      didAutoApply = true;
      await prisma.paidAdsChangeRequest.create({
        data: {
          userId: ownerUserId,
          projectId: project.id,
          type: "tiktok_create_campaign",
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
          type: "tiktok_create_campaign",
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
        type: "tiktok_create_campaign",
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
      outputSummary: `TikTok · ${objectiveType} · ${
        didAutoApply
          ? "campanha e ad group na API"
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
