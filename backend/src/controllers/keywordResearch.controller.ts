import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import {
  KEYWORD_LANGUAGES,
  KEYWORD_MARKETS,
  mapKeywordResearch,
  marketName,
} from "../lib/keywordGenerator";
import { generateResearchPackage, notesForBundle } from "../lib/ads/adBundleLlm";
import { CampaignPageUnavailableError } from "../lib/ads/campaignBrief";
import { validateBundle, validationSummary } from "../lib/ads/adValidate";
import type { AdBundle } from "../lib/ads/adBundle";
import { Prisma } from "@prisma/client";
import { keywordResearchByIdWhere, keywordResearchListWhere } from "../lib/keywordResearchScope";

const HISTORY_LIMIT = 30;

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
    const rows = await prisma.keywordResearch.findMany({
      where: keywordResearchListWhere(userId),
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        product: true,
        language: true,
        market: true,
        marketName: true,
        createdAt: true,
      },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        product: r.product,
        language: r.language,
        language_label: KEYWORD_LANGUAGES.find((l) => l.code === r.language)?.label ?? r.language,
        market: r.market,
        market_name: r.marketName,
        created_at: r.createdAt.toISOString(),
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

  async generate(req: Request, res: Response) {
    const userId = billingUserId(req);
    try {
      const { input, keywords, bundle, urlTitle } = await generateResearchPackage(req.body);
      const notes = notesForBundle(input);
      const stored = { ...bundle, notes };
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
    const updated = await prisma.keywordResearch.updateMany({
      where: { id },
      data: {
        keywords: keywords as Prisma.InputJsonValue,
        bundle: { ...(bundle as object), notes } as Prisma.InputJsonValue,
      },
    });
    if (updated.count !== 1) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const row = await prisma.keywordResearch.findFirst({ where: keywordResearchByIdWhere(userId, id) });
    if (!row) return res.status(404).json({ error: "Pesquisa não encontrada." });
    const body = present(row);
    body.validation = validateBundle(bundle as AdBundle, notes);
    body.validation_summary = validationSummary(body.validation);
    res.json(body);
  },
};
