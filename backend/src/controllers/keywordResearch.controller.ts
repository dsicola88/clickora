import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import {
  KEYWORD_LANGUAGES,
  KEYWORD_MARKETS,
  mapKeywordResearch,
  marketName,
} from "../lib/keywordGenerator";
import { generateResearchPackage, notesForBundle } from "../lib/ads/adBundleLlm";
import { CampaignPageUnavailableError, loadCampaignPageHtml } from "../lib/ads/campaignBrief";
import { resolveCampaignProductName } from "../lib/ads/productPageIdentity";
import { validateBundle, validationSummary } from "../lib/ads/adValidate";
import type { AdBundle } from "../lib/ads/adBundle";
import { Prisma } from "@prisma/client";
import { keywordResearchByIdWhere, keywordResearchListWhere } from "../lib/keywordResearchScope";

const HISTORY_LIMIT = 50;

function present(row: {
  id: string;
  product: string;
  language: string;
  market: string;
  marketName: string;
  productUrl: string | null;
  urlTitle: string | null;
  keywords: unknown;
  createdAt: Date;
  updatedAt?: Date;
  affiliatePlatform?: string | null;
  funnel?: string | null;
  finalUrl?: string | null;
  bundle?: unknown;
  platform?: string | null;
  objective?: string | null;
  source?: string | null;
}) {
  const mapped = mapKeywordResearch(row);
  const bundle = row.bundle && typeof row.bundle === "object" ? (row.bundle as AdBundle) : null;
  const notes = "";
  const issues = bundle ? validateBundle(bundle, notes) : [];
  return {
    ...mapped,
    platform: row.platform ?? bundle?.platform ?? null,
    objective: row.objective ?? bundle?.objective ?? null,
    source: row.source ?? bundle?.source ?? null,
    bundle,
    validation: bundle ? issues : [],
    validation_summary: bundle ? validationSummary(issues) : null,
  };
}

export const keywordResearchController = {
  options(_req: Request, res: Response) {
    res.json({
      languages: KEYWORD_LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
      markets: KEYWORD_MARKETS.map((m) => ({ code: m.code, name: m.name })),
    });
  },

  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const baseSelect = {
      id: true,
      product: true,
      language: true,
      market: true,
      marketName: true,
      funnel: true,
      createdAt: true,
    } as const;
    let rows: Array<{
      id: string;
      product: string;
      language: string;
      market: string;
      marketName: string;
      funnel: string | null;
      createdAt: Date;
      updatedAt?: Date;
    }>;
    try {
      rows = await prisma.keywordResearch.findMany({
        where: keywordResearchListWhere(userId),
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: HISTORY_LIMIT,
        select: { ...baseSelect, updatedAt: true },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022")) throw e;
      rows = await prisma.keywordResearch.findMany({
        where: keywordResearchListWhere(userId),
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: baseSelect,
      });
    }
    res.json(
      rows.map((r) => ({
        id: r.id,
        product: r.product,
        language: r.language,
        language_label: KEYWORD_LANGUAGES.find((l) => l.code === r.language)?.label ?? r.language,
        market: r.market,
        market_name: r.marketName,
        funnel: r.funnel,
        created_at: r.createdAt.toISOString(),
        updated_at: (r.updatedAt ?? r.createdAt).toISOString(),
      })),
    );
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta." });
    const row = await prisma.keywordResearch.findFirst({ where: keywordResearchByIdWhere(userId, id) });
    if (!row) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const body = present(row);
    if (body.bundle) {
      const stored = row.bundle as { notes?: string };
      const issues = validateBundle(body.bundle, typeof stored.notes === "string" ? stored.notes : "");
      body.validation = issues;
      body.validation_summary = validationSummary(issues);
    }
    res.json(body);
  },

  async previewPage(req: Request, res: Response) {
    const parsed = z
      .object({
        product: z.string().trim().min(1).max(200),
        product_url: z.string().trim().url().max(2000),
        language: z.enum(["en", "pt", "es", "fr", "de", "it"]).default("en"),
        page_text: z.string().trim().min(40).max(8000).optional(),
        product_name_source: z.enum(["form", "page", "auto"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const brief = parsed.data;
    try {
      const { html, pageStatus } = await loadCampaignPageHtml({
        product_url: brief.product_url,
        language: brief.language,
        page_text: brief.page_text,
      });
      const identity = resolveCampaignProductName({
        userProduct: brief.product,
        html,
        productNameSource: brief.product_name_source ?? "auto",
      });
      return res.json({
        page_status: pageStatus,
        page_title: identity.pageTitle,
        page_h1: identity.pageH1,
        suggested_product_name: identity.suggestedFromPage,
        effective_product_name: identity.effectiveProduct,
        aligned: identity.aligned,
        alignment_score: identity.alignmentScore,
        product_name_source: identity.source,
      });
    } catch (e) {
      if (e instanceof CampaignPageUnavailableError) {
        return res.status(422).json({ error: e.message, code: e.code });
      }
      return res.status(502).json({ error: "Não foi possível ler a página do produto." });
    }
  },

  async generate(req: Request, res: Response) {
    const userId = billingUserId(req);
    try {
      const { input, keywords, bundle, urlTitle } = await generateResearchPackage(req.body);
      const notes = notesForBundle(input);
      const stored = { ...bundle, notes };
      const analysis = (bundle as AdBundle & { analysis?: { affiliatePlatform?: string; funnel?: string } }).analysis;
      const row = await prisma.keywordResearch.create({
        data: {
          userId,
          product: input.product,
          language: input.language,
          market: input.market,
          marketName: marketName(input.market),
          productUrl: input.product_url ?? null,
          urlTitle,
          keywords: keywords as unknown as Prisma.InputJsonValue,
          bundle: stored as unknown as Prisma.InputJsonValue,
          platform: input.platform,
          objective: input.objective,
          source: bundle.source,
          affiliatePlatform: analysis?.affiliatePlatform ?? null,
          funnel: input.funnel ?? analysis?.funnel ?? null,
          finalUrl: input.final_url ?? null,
        },
      });
      const body = present(row);
      body.validation = validateBundle(bundle, notes);
      body.validation_summary = validationSummary(body.validation);
      res.status(201).json(body);
    } catch (e) {
      const details = e && typeof e === "object" && "details" in e ? (e as { details?: unknown }).details : undefined;
      if (details) return res.status(400).json({ error: "Dados inválidos", details });
      const msg = e instanceof Error ? e.message : "Não foi possível gerar as palavras-chave.";
      if (e instanceof CampaignPageUnavailableError) {
        return res.status(422).json({ error: e.message, code: e.code });
      }
      if (/suficientes/i.test(msg)) {
        return res.status(422).json({ error: msg, code: "NO_RESULTS" });
      }
      return res.status(502).json({
        error: "Não foi possível gerar as palavras-chave.",
        code: "GENERATE_FAILED",
      });
    }
  },

  async update(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta." });
    const existing = await prisma.keywordResearch.findFirst({ where: keywordResearchByIdWhere(userId, id) });
    if (!existing) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const bundle = req.body?.bundle;
    const keywords = req.body?.keywords;
    if (!bundle || typeof bundle !== "object" || !Array.isArray(keywords)) {
      return res.status(400).json({ error: "Pacote inválido." });
    }
    const notes = typeof (existing.bundle as { notes?: string } | null)?.notes === "string"
      ? (existing.bundle as { notes: string }).notes
      : "";
    const finalUrlRaw = req.body?.final_url;
    const patch: Prisma.KeywordResearchUpdateManyMutationInput = {
      keywords: keywords as Prisma.InputJsonValue,
      bundle: { ...(bundle as object), notes } as Prisma.InputJsonValue,
    };
    if (typeof finalUrlRaw === "string") {
      patch.finalUrl = finalUrlRaw.trim() || null;
    }
    const updated = await prisma.keywordResearch.updateMany({
      where: { id },
      data: patch,
    });
    if (updated.count !== 1) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const row = await prisma.keywordResearch.findFirst({ where: keywordResearchByIdWhere(userId, id) });
    if (!row) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const body = present(row);
    body.validation = validateBundle(bundle as AdBundle, notes);
    body.validation_summary = validationSummary(body.validation);
    res.json(body);
  },

  async remove(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta." });
    const deleted = await prisma.keywordResearch.deleteMany({ where: keywordResearchByIdWhere(userId, id) });
    if (deleted.count === 0) return res.status(404).json({ error: "Pesquisa não encontrada." });
    res.status(204).send();
  },

  async removeAll(req: Request, res: Response) {
    const userId = billingUserId(req);
    await prisma.keywordResearch.deleteMany({ where: keywordResearchListWhere(userId) });
    res.status(204).send();
  },
};
