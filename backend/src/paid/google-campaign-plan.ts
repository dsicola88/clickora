import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { normalizeGoogleGeoTargetsOrThrow } from "./geo-google";
import { storedGoogleBiddingFromPlanInput } from "./google-campaign-bidding";
import { publishGoogleSearchCampaignFromLocal } from "./google-ads.publish";
import { normalizeGoogleLanguageTargetsOrThrow } from "./language-google";
import { prisma } from "./paidPrisma";
import { canWriteProject } from "./permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails-eval";

const googleBiddingStrategyEnum = z.enum([
  "manual_cpc",
  "maximize_clicks",
  "maximize_conversions",
  "target_cpa",
  "target_roas",
]);

export const googleCampaignPlanInputSchema = z
  .object({
    landingUrl: z.string().url().max(500),
    offer: z.string().min(3).max(500),
    objective: z.string().min(3).max(200),
    dailyBudgetUsd: z.number().min(1).max(100000),
    geoTargets: z.array(z.string().min(2).max(8)).min(1).max(20),
    languageTargets: z.array(z.string().min(2).max(8)).min(1).max(10),
    /** Estratégia de licitação ao nível da campanha (Google define CPC efectivo em cada leilão). */
    google_bidding_strategy: googleBiddingStrategyEnum.optional().default("maximize_conversions"),
    google_target_cpa_usd: z.number().positive().max(10000).nullable().optional(),
    google_target_roas: z.number().positive().max(100).nullable().optional(),
    /** Override opcional do optimizer para esta campanha (null omitido = herdar projecto). */
    optimizer_pause_spend_usd: z.number().positive().max(1_000_000).nullable().optional(),
    optimizer_pause_min_clicks: z.number().int().min(0).max(500).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.google_bidding_strategy === "target_cpa") {
      const v = val.google_target_cpa_usd;
      if (v == null || !Number.isFinite(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPA alvo (USD) obrigatório para esta estratégia.",
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
- RSA copy (headlines + descriptions): write EVERY string in the user's advertising languages given in the prompt (ISO codes; primary language first). Use native, idiomatic phrasing — one language per string; do not mix unrelated languages in the same headline/description.

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

function rsaLocalized(primaryLangIso: string, input: GoogleCampaignPlanInput): {
  headlines: string[];
  descriptions: string[];
} {
  const slug = input.offer.split(/\s+/).slice(0, 3).join(" ");
  const base = primaryLangIso.trim().slice(0, 2).toLowerCase();
  const mkHead = (s: string) => s.slice(0, 30);

  if (base === "pt") {
    return {
      headlines: [
        mkHead(slug),
        mkHead("Experimente hoje"),
        mkHead("Feito para equipas"),
        mkHead("Sem cartão obrigatório"),
        mkHead("Comece já"),
        mkHead("Teste gratuito"),
        mkHead("Equipas satisfeitas"),
        mkHead("Veja como funciona"),
      ],
      descriptions: [
        `${input.offer}`.slice(0, 90),
        "Configure em minutos. Cancele quando quiser.".slice(0, 90),
        "Controlo de gastos e orçamento ao nível da conta.".slice(0, 90),
      ],
    };
  }

  if (base === "es") {
    return {
      headlines: [
        mkHead(slug),
        mkHead("Pruébalo hoy"),
        mkHead("Para equipos"),
        mkHead("Sin tarjeta"),
        mkHead("Empieza ya"),
        mkHead("Prueba gratuita"),
        mkHead("Más información"),
      ],
      descriptions: [
        `${input.offer}`.slice(0, 90),
        "Configura en minutos. Cancela cuando quieras.".slice(0, 90),
        "Presupuesto bajo control en cada clic.".slice(0, 90),
      ],
    };
  }

  return {
    headlines: [
      mkHead(slug),
      mkHead(`Try ${slug}`),
      mkHead("Built for teams"),
      mkHead("Free trial"),
      mkHead("Get started today"),
      mkHead("Trusted by pros"),
      mkHead("No credit card"),
      mkHead("See it in action"),
    ],
    descriptions: [
      `${input.offer}`.slice(0, 90),
      "Set up in minutes. Cancel anytime.".slice(0, 90),
      "Budget safeguards at campaign level.".slice(0, 90),
    ],
  };
}

function deterministicFallback(input: GoogleCampaignPlanInput): AiPlan {
  const slug = input.offer.split(/\s+/).slice(0, 3).join(" ");
  const primaryLang = input.languageTargets[0] ?? "en";
  const rsa = rsaLocalized(primaryLang, input);
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
        rsa,
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

  let geoTargetsNorm: string[];
  try {
    geoTargetsNorm = normalizeGoogleGeoTargetsOrThrow(data.geoTargets);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Países inválidos.";
    return { ok: false, error: msg };
  }

  let languageTargetsNorm: string[];
  try {
    languageTargetsNorm = normalizeGoogleLanguageTargetsOrThrow(data.languageTargets);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Idiomas inválidos.";
    return { ok: false, error: msg };
  }

  const biddingStored = storedGoogleBiddingFromPlanInput({
    strategy: data.google_bidding_strategy,
    google_target_cpa_usd: data.google_target_cpa_usd ?? null,
    google_target_roas: data.google_target_roas ?? null,
  });

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
    const bidHint =
      data.google_bidding_strategy === "target_cpa" && data.google_target_cpa_usd != null
        ? `Google bidding — chosen strategy: target CPA at $${data.google_target_cpa_usd} USD (stored for publish).`
        : data.google_bidding_strategy === "target_roas" && data.google_target_roas != null
          ? `Google bidding — chosen strategy: target ROAS ${data.google_target_roas} (stored for publish).`
          : `Google bidding — chosen strategy: ${data.google_bidding_strategy} (stored for publish; Google sets actual CPC per auction).`;
    const userPrompt = `Landing URL: ${data.landingUrl}
Offer: ${data.offer}
Objective (business outcome): ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo (countries): ${geoTargetsNorm.join(", ")}
Advertising languages for RSA ad copy (ISO codes; PRIMARY first — write all RSA strings in these languages): ${languageTargetsNorm.join(", ")}
${bidHint}
Blocked keywords (must NOT appear): ${[...blocked].join(", ") || "(none)"}`;
    if (process.env.OPENAI_API_KEY) {
      const out = await callOpenAiForGooglePlan(userPrompt);
      plan = out.plan;
      tokensIn = out.tokensIn;
      tokensOut = out.tokensOut;
      model = out.model;
    } else {
      plan = deterministicFallback({ ...data, geoTargets: geoTargetsNorm, languageTargets: languageTargetsNorm });
    }
  } catch (e) {
    console.error("Google AI call failed, using deterministic fallback:", e);
    plan = deterministicFallback({ ...data, geoTargets: geoTargetsNorm, languageTargets: languageTargetsNorm });
  }

  plan.ad_groups = (plan.ad_groups ?? []).map((ag) => ({
    ...ag,
    keywords: (ag.keywords ?? []).filter((k) => !blocked.has(k.text.toLowerCase())),
  }));

  const dailyBudgetMicros = Math.round(data.dailyBudgetUsd * 1_000_000);
  const dailyBudgetMicrosBig = BigInt(dailyBudgetMicros);

  const optSpendUsd =
    data.optimizer_pause_spend_usd !== undefined ? data.optimizer_pause_spend_usd : undefined;
  const optMinClicks =
    data.optimizer_pause_min_clicks !== undefined ? data.optimizer_pause_min_clicks : undefined;

  const campaign = await prisma.paidAdsCampaign.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      platform: "google_ads",
      name: plan.campaign?.name ?? "Campanha gerada por IA",
      status: "draft",
      objectiveSummary: plan.campaign?.objective_summary ?? data.objective,
      dailyBudgetMicros: dailyBudgetMicrosBig,
      geoTargets: geoTargetsNorm,
      languageTargets: languageTargetsNorm,
      biddingConfig: biddingStored as unknown as Prisma.InputJsonValue,
      ...(optSpendUsd !== undefined ? { optimizerPauseSpendUsd: optSpendUsd } : {}),
      ...(optMinClicks !== undefined ? { optimizerPauseMinClicks: optMinClicks } : {}),
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
      geoTargets: geoTargetsNorm,
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
        geo_targets: geoTargetsNorm,
        language_targets: languageTargetsNorm,
        landing_url: data.landingUrl,
        bidding_config: biddingStored,
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
        geo_targets: geoTargetsNorm,
        language_targets: languageTargetsNorm,
        landing_url: data.landingUrl,
        bidding_config: biddingStored,
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
      geo_targets: geoTargetsNorm,
      language_targets: languageTargetsNorm,
      landing_url: data.landingUrl,
      bidding_config: biddingStored,
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
