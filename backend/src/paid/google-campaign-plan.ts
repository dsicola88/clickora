import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { normalizeGoogleGeoTargetsOrThrow } from "./geo-google";
import { storedGoogleBiddingFromPlanInput } from "./google-campaign-bidding";
import { publishGoogleSearchCampaignFromLocal } from "./google-ads.publish";
import { normalizeGoogleLanguageTargetsOrThrow } from "./language-google";
import { prisma } from "./paidPrisma";
import { canWriteProject } from "./permissions";
import { evaluateGuardrails, type GuardrailLimits, type GuardrailViolation } from "./guardrails-eval";
import { finalizeGoogleCampaignAssetExtensions } from "./google-campaign-asset-extensions";
import {
  buildDeterministicGoogleCampaignPlan,
  fetchOpenAiGoogleCampaignPlan,
  sanitizeAiPlanCopy,
  type GoogleCampaignAiPlan,
} from "./google-campaign-ai-shared";

const googleManualKeywordSchema = z.object({
  text: z.string().trim().min(1).max(80),
  match_type: z.enum(["exact", "phrase", "broad"]),
});

const googleManualRsaSchema = z.object({
  headlines: z.array(z.string()).min(3).max(15),
  descriptions: z.array(z.string()).min(2).max(4),
});

const googleManualAdGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  keywords: z.array(googleManualKeywordSchema).min(1).max(50),
  rsa: googleManualRsaSchema,
});

const googleManualSearchPlanSchema = z.object({
  campaign: z.object({
    name: z.string().trim().min(1).max(250),
    objective_summary: z.string().trim().min(1).max(500),
  }),
  ad_groups: z.array(googleManualAdGroupSchema).min(1).max(5),
});

export type GoogleManualSearchPlan = z.infer<typeof googleManualSearchPlanSchema>;

const googleBiddingStrategyEnum = z.enum([
  "manual_cpc",
  "maximize_clicks",
  "maximize_conversions",
  "target_cpa",
  "target_roas",
]);

/**
 * Sinais reais opcionais sobre o produto. **Nunca** inventados — quando ausentes,
 * o copy gerado simplesmente omite a referência. Os limites de comprimento são
 * compatíveis com o uso em headlines (≤30) e descrições (≤90) do Google Ads.
 */
const productSignalsSchema = z
  .object({
    price: z.string().trim().max(20).optional(),
    price_full: z.string().trim().max(20).optional(),
    discount: z.string().trim().max(28).optional(),
    guarantee: z.string().trim().max(40).optional(),
    shipping: z.string().trim().max(28).optional(),
    bundles: z.array(z.string().trim().max(30)).max(6).optional(),
    bonuses: z.string().trim().max(28).optional(),
    certifications: z.string().trim().max(40).optional(),
    attributes: z.array(z.string().trim().max(30)).max(8).optional(),
  })
  .partial();

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
    /** Lance máximo CPC em USD quando estratégia = `manual_cpc`. Reflecte a equação do UI
     *  «CPC = orçamento ÷ cliques alvo». Aplicado como `cpcBidMicros` no AdGroup ao publicar. */
    google_max_cpc_usd: z.number().positive().max(1000).nullable().optional(),
    /** Override opcional do optimizer para esta campanha (null omitido = herdar projecto). */
    optimizer_pause_spend_usd: z.number().positive().max(1_000_000).nullable().optional(),
    optimizer_pause_min_clicks: z.number().int().min(0).max(500).nullable().optional(),
    /** Sinais reais do produto. Quando preenchidos, o copy menciona-os literalmente. */
    product_signals: productSignalsSchema.optional(),
    campaign_seed_keyword: z.string().trim().min(2).max(80).optional(),
    /** Pesquisa: assistente IA vs plano com a mesma estrutura de entidades Search do Google Ads (manual). */
    google_search_plan_mode: z.enum(["assistant", "manual"]).optional().default("assistant"),
    google_manual_search_plan: googleManualSearchPlanSchema.optional(),
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
    if (val.google_search_plan_mode === "manual" && !val.google_manual_search_plan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Com modo «manual», envie google_manual_search_plan (campanha, grupos, keywords e RSA).',
        path: ["google_manual_search_plan"],
      });
    }
    if (val.google_search_plan_mode === "assistant" && val.google_manual_search_plan != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Remova google_manual_search_plan quando usar o assistente IA.",
        path: ["google_manual_search_plan"],
      });
    }
  });

export type GoogleCampaignPlanInput = z.infer<typeof googleCampaignPlanInputSchema>;

/** Alias compatível com o JSON da IA — fonte única em `google-campaign-ai-shared`. */
type AiPlan = GoogleCampaignAiPlan;

function mergeCampaignSeedKeyword(plan: AiPlan, seedRaw: string | undefined, blocked: Set<string>): AiPlan {
  const seed = seedRaw?.trim().toLowerCase();
  if (!seed || blocked.has(seed)) return plan;
  const groups = [...(plan.ad_groups ?? [])];
  if (!groups.length) return plan;
  const ag0 = { ...groups[0] };
  const existing = new Set(
    (ag0.keywords ?? []).map((k) => `${k.text.toLowerCase()}\t${k.match_type}`),
  );
  const inject: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }> = [
    { text: seed, match_type: "exact" },
    { text: seed, match_type: "phrase" },
  ];
  const toAdd = inject.filter(
    (k) => !blocked.has(k.text.toLowerCase()) && !existing.has(`${k.text.toLowerCase()}\t${k.match_type}`),
  );
  ag0.keywords = [...toAdd, ...(ag0.keywords ?? [])].slice(0, 50);
  groups[0] = ag0;
  return { ...plan, ad_groups: groups };
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

  const biddingStoredBase = storedGoogleBiddingFromPlanInput({
    strategy: data.google_bidding_strategy,
    google_target_cpa_usd: data.google_target_cpa_usd ?? null,
    google_target_roas: data.google_target_roas ?? null,
    google_max_cpc_usd: data.google_max_cpc_usd ?? null,
  });

  const isManualPlan = data.google_search_plan_mode === "manual";

  const aiRun = await prisma.paidAdsAiRun.create({
    data: {
      userId: ownerUserId,
      projectId: project.id,
      feature: "campaign_plan",
      model: "pending",
      promptVersion: isManualPlan ? "google_manual_search_v1" : "google_v1",
      inputSummary: isManualPlan
        ? `manual Search · ${data.google_manual_search_plan!.campaign.name} · ${data.landingUrl}`
        : `${data.objective} · ${data.landingUrl}`,
      status: "pending",
      createdById: actor.userId,
    },
    select: { id: true },
  });

  let plan: AiPlan;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = "fallback/deterministic";

  if (isManualPlan) {
    plan = data.google_manual_search_plan as AiPlan;
    model = "manual/editor";
  } else {
    try {
      const bidHint =
        data.google_bidding_strategy === "target_cpa" && data.google_target_cpa_usd != null
          ? `Google bidding — chosen strategy: target CPA at $${data.google_target_cpa_usd} USD (stored for publish).`
          : data.google_bidding_strategy === "target_roas" && data.google_target_roas != null
            ? `Google bidding — chosen strategy: target ROAS ${data.google_target_roas} (stored for publish).`
            : data.google_bidding_strategy === "manual_cpc" && data.google_max_cpc_usd != null
              ? `Google bidding — chosen strategy: manual CPC capped at $${data.google_max_cpc_usd} USD per click (stored for publish).`
              : `Google bidding — chosen strategy: ${data.google_bidding_strategy} (stored for publish; Google sets actual CPC per auction).`;
      const primaryLang = languageTargetsNorm[0] ?? "en";
      const ps = data.product_signals;
      const productSignalsLines = (() => {
        if (!ps) return "";
        const lines: string[] = [];
        if (ps.price) lines.push(`- price: "${ps.price}"`);
        if (ps.price_full) lines.push(`- price_full: "${ps.price_full}"`);
        if (ps.discount) lines.push(`- discount: "${ps.discount}"`);
        if (ps.guarantee) lines.push(`- guarantee: "${ps.guarantee}"`);
        if (ps.shipping) lines.push(`- shipping: "${ps.shipping}"`);
        if (ps.bundles?.length) lines.push(`- bundles: ${ps.bundles.map((b) => `"${b}"`).join(", ")}`);
        if (ps.bonuses) lines.push(`- bonuses: "${ps.bonuses}"`);
        if (ps.certifications) lines.push(`- certifications: "${ps.certifications}"`);
        if (ps.attributes?.length) lines.push(`- attributes: ${ps.attributes.map((a) => `"${a}"`).join(", ")}`);
        if (!lines.length) return "";
        return `\nProduct signals (TRUE facts about this offer — use VERBATIM where they fit; do NOT invent any other promo claim):\n${lines.join("\n")}`;
      })();

      const seedLine =
        data.campaign_seed_keyword?.trim() &&
        !blocked.has(data.campaign_seed_keyword.trim().toLowerCase())
          ? `\nPrimary keyword (user-chosen Search theme — centre keywords and RSA on this intent; include exact+phrase+broad variants across ad groups): ${data.campaign_seed_keyword.trim()}`
          : "";

      const userPrompt = `Landing URL: ${data.landingUrl}
Offer: ${data.offer}
Objective (INTERNAL briefing — do NOT copy verbatim into ad copy, do NOT use as a headline/description): ${data.objective}
Daily budget: $${data.dailyBudgetUsd}
Geo (countries): ${geoTargetsNorm.join(", ")}
Advertising languages (ISO codes; FIRST is primary): ${languageTargetsNorm.join(", ")}
PRIMARY language for ALL RSA headlines and descriptions: ${primaryLang} — write every headline and every description in ${primaryLang} only, no mixing with other languages.
${bidHint}${seedLine}
RSA reminders: 12 headlines ≤30 chars each (vary the angle: CTA, benefit, proof, urgency, branded — never repeat the same stem), 4 descriptions ≤90 chars each (full persuasive sentences derived from the Offer, Landing and Product signals — never echoing the Objective).${productSignalsLines}
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
          geoTargets: geoTargetsNorm,
          languageTargets: languageTargetsNorm,
          productSignals: data.product_signals,
          campaignSeedKeyword: data.campaign_seed_keyword,
        });
      }
    } catch (e) {
      console.error("Google AI call failed, using deterministic fallback:", e);
      plan = buildDeterministicGoogleCampaignPlan({
        landingUrl: data.landingUrl,
        offer: data.offer,
        objective: data.objective,
        geoTargets: geoTargetsNorm,
        languageTargets: languageTargetsNorm,
        productSignals: data.product_signals,
        campaignSeedKeyword: data.campaign_seed_keyword,
      });
    }

    plan = mergeCampaignSeedKeyword(plan, data.campaign_seed_keyword, blocked);
  }

  /** Limpa prefixos internos ("Goal:", "Objetivo:"…) e descrições que ecoem o objective; garante mínimos publicáveis. */
  plan = sanitizeAiPlanCopy(plan, {
    landingUrl: data.landingUrl,
    offer: data.offer,
    objective: data.objective,
    geoTargets: geoTargetsNorm,
    languageTargets: languageTargetsNorm,
    productSignals: data.product_signals,
  });

  plan.ad_groups = (plan.ad_groups ?? []).map((ag) => ({
    ...ag,
    keywords: (ag.keywords ?? []).filter((k) => !blocked.has(k.text.toLowerCase())),
  }));

  const groupWithoutKeywords = plan.ad_groups.find((ag) => (ag.keywords ?? []).length === 0);
  if (groupWithoutKeywords) {
    await prisma.paidAdsAiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "error",
        model,
        tokensIn,
        tokensOut,
        outputSummary:
          'Sem palavras-chave válidas num grupo — verifique termos bloqueados nos guardrails ou preencha outras keywords.',
      },
    });
    return {
      ok: false,
      error:
        `O grupo «${groupWithoutKeywords.name}» ficou sem palavras-chave (provavelmente bloqueadas pelo projecto). Ajuste o texto ou os guardrails.`,
    };
  }
  const google_asset_extensions = finalizeGoogleCampaignAssetExtensions(plan.extensions, {
    landingUrl: data.landingUrl,
    offer: data.offer,
    primaryLanguageIso: languageTargetsNorm[0] ?? "en",
  });
  const biddingStored = {
    ...biddingStoredBase,
    google_asset_extensions,
  };

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
