/**
 * Gera variantes de mensagem/oferta e opcionalmente grava rascunhos Meta/RSA.
 */
import type { PaidAdsPlatform } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  buildDeterministicMessageVariants,
  buildMessageRecUserPrompt,
  MESSAGE_OFFER_RECS_SYSTEM,
  parseLlmMessageVariants,
  type MessageOfferSeed,
  type MessageOfferVariant,
} from "./messageOfferRecs";
import { prisma } from "./paidPrisma";

function jsonStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

async function loadSeeds(args: {
  campaignId: string;
  platform: PaidAdsPlatform;
}): Promise<{ seeds: MessageOfferSeed[]; destinationUrl: string | null }> {
  if (args.platform === "meta_ads") {
    const creatives = await prisma.paidAdsMetaCreative.findMany({
      where: { adset: { campaignId: args.campaignId } },
      orderBy: { createdAt: "asc" },
      select: { headline: true, primaryText: true, destinationUrl: true },
    });
    const seeds: MessageOfferSeed[] = creatives.map((c) => ({
      headline: (c.headline || "").trim(),
      body: (c.primaryText || "").trim(),
      destination_url: c.destinationUrl,
    })).filter((s) => s.headline || s.body);
    const destinationUrl = creatives.find((c) => c.destinationUrl)?.destinationUrl ?? null;
    return { seeds, destinationUrl };
  }

  if (args.platform === "google_ads") {
    const rsas = await prisma.paidAdsRsa.findMany({
      where: { adGroup: { campaignId: args.campaignId } },
      orderBy: { createdAt: "asc" },
      select: { headlines: true, descriptions: true, finalUrls: true },
    });
    const seeds: MessageOfferSeed[] = rsas.map((r) => {
      const hls = jsonStringList(r.headlines);
      const descs = jsonStringList(r.descriptions);
      const urls = jsonStringList(r.finalUrls);
      return {
        headline: hls[0] || "",
        body: descs[0] || hls[1] || "",
        destination_url: urls[0] || "",
      };
    }).filter((s) => s.headline || s.body);
    const destinationUrl =
      seeds.find((s) => s.destination_url)?.destination_url ||
      jsonStringList(rsas[0]?.finalUrls)[0] ||
      null;
    return { seeds, destinationUrl };
  }

  return { seeds: [], destinationUrl: null };
}

async function tryLlmVariants(args: {
  platform: string;
  campaignName: string;
  destinationUrl: string;
  seeds: MessageOfferSeed[];
  rankingNote?: string | null;
}): Promise<{
  variants: MessageOfferVariant[];
  model: string | null;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { variants: [], model: null, error: null, tokensIn: 0, tokensOut: 0 };
  }
  try {
    const model = "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: MESSAGE_OFFER_RECS_SYSTEM },
          { role: "user", content: buildMessageRecUserPrompt(args) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      return {
        variants: [],
        model: null,
        error: `OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`,
        tokensIn: 0,
        tokensOut: 0,
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as unknown;
    return {
      variants: parseLlmMessageVariants(parsed),
      model: `openai/${model}`,
      error: null,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
    };
  } catch (e) {
    return {
      variants: [],
      model: null,
      error: e instanceof Error ? e.message : String(e),
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}

async function persistVariants(args: {
  campaignId: string;
  platform: PaidAdsPlatform;
  destinationUrl: string;
  variants: MessageOfferVariant[];
}): Promise<{ created_ids: string[]; detail: string }> {
  const created_ids: string[] = [];

  if (args.platform === "meta_ads") {
    const adset = await prisma.paidAdsMetaAdset.findFirst({
      where: { campaignId: args.campaignId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!adset) return { created_ids, detail: "Sem ad set Meta para gravar rascunhos." };

    for (const v of args.variants) {
      const cr = await prisma.paidAdsMetaCreative.create({
        data: {
          adsetId: adset.id,
          primaryText: v.body.slice(0, 125),
          headline: v.headline.slice(0, 40),
          description: " ",
          destinationUrl: args.destinationUrl,
          status: "draft",
          placements: [] as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await prisma.paidAdsMetaAd.create({
        data: {
          adsetId: adset.id,
          creativeId: cr.id,
          name: v.headline.slice(0, 40) || "Variante",
          status: "draft",
        },
      });
      created_ids.push(cr.id);
    }
    return {
      created_ids,
      detail: `${created_ids.length} criativo(s) Meta em rascunho (Copilot mensagem).`,
    };
  }

  if (args.platform === "google_ads") {
    const ag = await prisma.paidAdsAdGroup.findFirst({
      where: { campaignId: args.campaignId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!ag) return { created_ids, detail: "Sem ad group Google para gravar RSA." };

    const existing = await prisma.paidAdsRsa.findMany({
      where: { adGroupId: ag.id },
      select: { headlines: true, descriptions: true },
      take: 5,
    });
    const poolHl = existing.flatMap((r) => jsonStringList(r.headlines));
    const poolDesc = existing.flatMap((r) => jsonStringList(r.descriptions));

    for (const v of args.variants) {
      const headlines = [v.headline, v.body.slice(0, 30), ...poolHl]
        .map((h) => h.slice(0, 30))
        .filter(Boolean);
      const uniqHl = [...new Set(headlines)].slice(0, 15);
      // Google RSA exige ≥3 headlines *únicos* — sem material suficiente, não inventar.
      if (uniqHl.length < 3) continue;

      const descriptions = [v.body.slice(0, 90), ...poolDesc]
        .map((d) => d.slice(0, 90))
        .filter(Boolean);
      const uniqDesc = [...new Set(descriptions)].slice(0, 4);
      if (uniqDesc.length < 2) continue;

      const rsa = await prisma.paidAdsRsa.create({
        data: {
          adGroupId: ag.id,
          headlines: uniqHl as Prisma.InputJsonValue,
          descriptions: uniqDesc as Prisma.InputJsonValue,
          finalUrls: [args.destinationUrl] as Prisma.InputJsonValue,
          status: "draft",
        },
        select: { id: true },
      });
      created_ids.push(rsa.id);
    }
    return {
      created_ids,
      detail: `${created_ids.length} RSA Google em rascunho (Copilot mensagem).`,
    };
  }

  return { created_ids, detail: "TikTok: recomendações de texto não gravam anúncio de vídeo neste MVP." };
}

export async function recommendMessageOfferVariants(args: {
  projectId: string;
  campaignId: string;
  persist?: boolean;
  rankingNote?: string | null;
  /** Actor autenticado — auditoria `PaidAdsAiRun` (`rsa_generation`). */
  createdById?: string;
}): Promise<
  | {
      ok: true;
      platform: PaidAdsPlatform;
      variants: MessageOfferVariant[];
      model: string | null;
      llm_error: string | null;
      persisted_ids: string[];
      persist_detail: string | null;
      destination_url: string | null;
      detail: string;
      ai_run_id: string | null;
    }
  | { error: string; status: number }
> {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: args.campaignId, projectId: args.projectId },
    select: { id: true, platform: true, name: true },
  });
  if (!camp) return { error: "Campanha não encontrada.", status: 404 };

  const project = await prisma.paidAdsProject.findFirst({
    where: { id: args.projectId },
    select: { id: true, userId: true },
  });
  if (!project) return { error: "Projecto não encontrado.", status: 404 };

  if (camp.platform === "tiktok_ads") {
    return {
      error:
        "Recomendações de mensagem/oferta para TikTok vídeo ainda não estão neste MVP — use o estúdio TikTok ou a rede.",
      status: 400,
    };
  }

  const { seeds, destinationUrl } = await loadSeeds({
    campaignId: camp.id,
    platform: camp.platform,
  });
  if (seeds.length === 0 || !destinationUrl) {
    return {
      error:
        "Sem copy/URL local para recomendar. Publique ou crie pelo menos um criativo/RSA com destino na campanha.",
      status: 400,
    };
  }

  const aiRun = await prisma.paidAdsAiRun.create({
    data: {
      userId: project.userId,
      projectId: project.id,
      feature: "rsa_generation",
      model: "pending",
      promptVersion: "message_offer_recs_v1",
      inputSummary: `${camp.platform} · ${camp.name} · ${destinationUrl} · ${seeds.length} seed(s)`,
      status: "pending",
      createdById: args.createdById ?? null,
    },
    select: { id: true },
  });

  const llm = await tryLlmVariants({
    platform: camp.platform,
    campaignName: camp.name,
    destinationUrl,
    seeds,
    rankingNote: args.rankingNote,
  });

  let variants = llm.variants;
  let modelUsed = llm.model;
  if (variants.length === 0) {
    variants = buildDeterministicMessageVariants(seeds);
    if (!modelUsed) modelUsed = "fallback/deterministic";
  }
  // Filtrar clones exactos
  variants = variants.filter(
    (v) => !seeds.some((s) => s.headline === v.headline && s.body === v.body),
  );

  if (variants.length === 0) {
    await prisma.paidAdsAiRun.update({
      where: { id: aiRun.id },
      data: {
        status: llm.error ? "error" : "success",
        model: modelUsed ?? "fallback/deterministic",
        tokensIn: llm.tokensIn || null,
        tokensOut: llm.tokensOut || null,
        outputSummary: "0 variantes distintas",
        errorMessage: llm.error?.slice(0, 2000) ?? null,
      },
    });
    return {
      ok: true,
      platform: camp.platform,
      variants: [],
      model: modelUsed,
      llm_error: llm.error,
      persisted_ids: [],
      persist_detail: null,
      destination_url: destinationUrl,
      detail: "Nenhuma variante distinta do copy actual — ajuste o criativo manualmente.",
      ai_run_id: aiRun.id,
    };
  }

  let persisted_ids: string[] = [];
  let persist_detail: string | null = null;
  if (args.persist) {
    const p = await persistVariants({
      campaignId: camp.id,
      platform: camp.platform,
      destinationUrl,
      variants,
    });
    persisted_ids = p.created_ids;
    persist_detail = p.detail;
  }

  const finalModel = modelUsed ?? "fallback/deterministic";
  await prisma.paidAdsAiRun.update({
    where: { id: aiRun.id },
    data: {
      status: "success",
      model: finalModel,
      tokensIn: llm.tokensIn || null,
      tokensOut: llm.tokensOut || null,
      outputSummary: `${variants.length} variante(s) · persist=${persisted_ids.length} · ${camp.platform}`,
      errorMessage: llm.error?.slice(0, 2000) ?? null,
    },
  });

  return {
    ok: true,
    platform: camp.platform,
    variants,
    model: finalModel,
    llm_error: llm.error,
    persisted_ids,
    persist_detail,
    destination_url: destinationUrl,
    detail: persist_detail
      ? persist_detail
      : `${variants.length} sugestão(ões) (${finalModel.startsWith("openai/") ? "LLM" : "determinístico"}). Use persist para gravar rascunhos.`,
    ai_run_id: aiRun.id,
  };
}
