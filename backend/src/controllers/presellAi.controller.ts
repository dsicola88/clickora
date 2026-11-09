import { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { billingUserId, actorUserId } from "../lib/requestContext";
import { denyIfCannotWritePresells } from "./workspace.controller";
import { assertPresellAiQuotaAvailable } from "../lib/presellAiQuota";
import { assertCanCreatePresellPages } from "../lib/presellPageLimits";
import {
  generatePresellReviewCopy,
  generateTriplePackCopy,
  mapDisapprovalToHints,
  buildDeterministicReviewCopy,
  sanitizeOfferFacts,
  type TriplePackCopy,
} from "../lib/presellReviewCopy";
import { appendWorkspaceAuditLog } from "../lib/workspaceAudit";
import { extractPresellSignals } from "../compliance/extractPresellSignals";

function slugifyPack(base: string, suffix: string): string {
  const root = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${root || "presell"}-${suffix}-${Date.now().toString(36).slice(-4)}`;
}

function applyCopyToContent(
  content: Record<string, unknown>,
  copy: {
    subtitle: string;
    salesText: string;
    article?: {
      kicker: string;
      headline: string;
      intro: string;
      pillarsTitle: string;
      pillars: Array<{ title: string; body: string }>;
      productNote: string;
      ctaLabel: string;
    };
  },
  options: { isolateVariant?: boolean } = {},
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...content,
    sales_text: copy.salesText,
    salesText: copy.salesText,
    subtitle: copy.subtitle,
  };
  if (copy.article) {
    next.articleKicker = copy.article.kicker;
    next.articleHeadline = copy.article.headline;
    next.articleIntro = copy.article.intro;
    next.articlePillarsTitle = copy.article.pillarsTitle;
    next.articlePillars = copy.article.pillars;
    next.articleProductNote = copy.article.productNote;
    next.ctaText = copy.article.ctaLabel;
    next.cta_text = copy.article.ctaLabel;
    next.article = copy.article;
  }
  if (options.isolateVariant) {
    // Variantes do pacote: texto distinto — sem espelho/pageDocument partilhado da base
    // (senão landing/review/advertorial ficam iguais no /l/ e na SPA).
    delete next.importMirrorSrcDoc;
    delete next.import_mirror_src_doc;
    delete next.pageDocument;
    delete next.page_document;
    delete next.workingDocument;
    delete next.publishedDocument;
  }
  return next;
}

const generateSchema = z.object({
  /** Se true, substitui sales_text mesmo quando já há texto longo. */
  force: z.boolean().optional().default(false),
  /** Só devolver preview sem gravar. */
  preview: z.boolean().optional().default(false),
  /** Forçar fallback sem gastar quota LLM. */
  deterministic_only: z.boolean().optional().default(false),
  angle: z.enum(["landing", "review", "advertorial"]).optional().default("review"),
});

const packSchema = z.object({
  /** Criar páginas irmãs + rotador 33/33/34. */
  create_rotator: z.boolean().optional().default(true),
  /** Usar só texto determinístico (não gasta quota LLM). */
  deterministic_only: z.boolean().optional().default(false),
});

const disapprovalSchema = z.object({
  text: z.string().min(8).max(8000),
});

function asContent(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as object) } : {};
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export const presellAiController = {
  async getQuota(req: Request, res: Response) {
    const userId = billingUserId(req);
    const { resolvePresellAiQuota } = await import("../lib/presellAiQuota");
    const quota = await resolvePresellAiQuota(userId);
    res.json({
      plan_type: quota.planType,
      limit: quota.limit,
      used: quota.used,
      remaining: quota.remaining,
      privileged: quota.privileged,
      month: quota.monthKey,
      openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
  },

  async generateReviewCopy(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = generateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({ where: { id: req.params.id, userId } });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const content = asContent(page.content);
    const settings = asContent(page.settings);
    const signals = extractPresellSignals({
      title: page.title,
      type: page.type,
      language: page.language || "en",
      category: page.category,
      content,
      settings,
      videoUrl: page.videoUrl,
    });

    const existingSales =
      typeof content.sales_text === "string"
        ? content.sales_text
        : typeof content.salesText === "string"
          ? content.salesText
          : "";
    if (!parsed.data.force && wordCount(existingSales) >= 150) {
      return res.status(409).json({
        error:
          "A página já tem texto longo. Envie force=true para regenerar, ou edite o texto manualmente.",
        code: "CONTENT_EXISTS",
        word_count: wordCount(existingSales),
      });
    }

    let usedLlm = false;
    const offerFacts =
      sanitizeOfferFacts(signals.salesText) || sanitizeOfferFacts(signals.subtitle) || "";

    const generationNiche =
      content.generationNiche === "white" || content.generation_niche === "white" ? "white" : "black";

    let copy = buildDeterministicReviewCopy({
      productName: signals.productName || page.title,
      language: page.language || "en",
      offerFacts,
      sourceUrl: signals.sourceUrl,
      priceMention: signals.priceMention,
      angle: parsed.data.angle,
      generationNiche,
    });

    if (!parsed.data.deterministic_only) {
      const gate = await assertPresellAiQuotaAvailable(userId);
      if (!gate.ok) return res.status(gate.status).json(gate.body);

      copy = await generatePresellReviewCopy({
        productName: signals.productName || page.title,
        language: page.language || "en",
        offerFacts,
        sourceUrl: signals.sourceUrl,
        priceMention: signals.priceMention,
        angle: parsed.data.angle,
        generationNiche,
      });
      usedLlm = copy.source === "llm";
    }

    if (parsed.data.preview) {
      const { resolvePresellAiQuota } = await import("../lib/presellAiQuota");
      const quota = await resolvePresellAiQuota(userId);
      return res.json({
        preview: true,
        applied: false,
        copy: {
          title: copy.title,
          subtitle: copy.subtitle,
          sales_text: copy.salesText,
          source: copy.source,
          model: copy.model,
          article: copy.article,
        },
        quota: {
          plan_type: quota.planType,
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          month: quota.monthKey,
        },
        llm_error: copy.error,
      });
    }

    // Conta crédito só quando aplica (não em preview).
    if (usedLlm) {
      const gate = await assertPresellAiQuotaAvailable(userId);
      if (!gate.ok) return res.status(gate.status).json(gate.body);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { workspaceId: true },
      });
      if (user?.workspaceId) {
        await appendWorkspaceAuditLog({
          workspaceId: user.workspaceId,
          actorUserId: actorUserId(req) || userId,
          action: "presell_ai_review_copy",
          resourceType: "presell",
          resourceId: page.id,
          metadata: {
            model: copy.model,
            tokens_in: copy.tokensIn,
            tokens_out: copy.tokensOut,
            month: gate.quota.monthKey,
          },
        });
      }
    }

    const nextContent = applyCopyToContent(content, copy);
    // Não sobrescreve título da página automaticamente (pode partir URLs/anúncios).
    if (!String(content.product_name || content.productName || "").trim()) {
      nextContent.product_name = signals.productName || page.title;
    }

    // systemPrisma: tenant client wraps update where em AND+userId e parte WhereUniqueInput.
    // Ownership já validada pelo findFirst acima.
    const updated = await systemPrisma.presellPage.update({
      where: { id: page.id },
      data: {
        content: nextContent as Prisma.InputJsonValue,
        complianceGate: "unchecked",
        contentFingerprint: null,
      },
    });

    const { resolvePresellAiQuota } = await import("../lib/presellAiQuota");
    const quota = await resolvePresellAiQuota(userId);

    res.json({
      preview: false,
      applied: true,
      page_id: updated.id,
      copy: {
        title: copy.title,
        subtitle: copy.subtitle,
        sales_text: copy.salesText,
        source: copy.source,
        model: copy.model,
        article: copy.article,
      },
      quota: {
        plan_type: quota.planType,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        month: quota.monthKey,
      },
      llm_error: copy.error,
      note:
        "Texto editorial gravado (gate unchecked). Reaudite antes de publicar. Aprovação Google não é garantida.",
    });
  },

  async analyzeDisapproval(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = disapprovalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Cole o texto da reprovação (mín. 8 caracteres)." });
    }
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, title: true },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const hints = mapDisapprovalToHints(parsed.data.text);
    res.json({
      page_id: page.id,
      hints,
      disclaimer:
        "Plano orientativo interno. A aprovação final depende do Google/Microsoft — não é garantia antibloqueio.",
    });
  },

  /**
   * Pacote de 3 variantes (landing/tsl + review + advertorial) a partir de uma presell base.
   * Conta **1** geração na quota mensal se usar LLM.
   * Com `create_rotator=true` e base publicada, as irmãs nascem publicadas (o FE monta o rotador 33/33/34).
   */
  async spawnVariantPack(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = packSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const base = await prisma.presellPage.findFirst({ where: { id: req.params.id, userId } });
    if (!base) return res.status(404).json({ error: "Página não encontrada" });

    // Pack cria até 2 irmãs (os ângulos ≠ tipo da base); a base só é actualizada.
    const siblingCreates = (["tsl", "review", "advertorial"] as const).filter((t) => t !== base.type).length;
    const pageLimit = await assertCanCreatePresellPages(userId, siblingCreates);
    if (!pageLimit.ok) {
      return res.status(pageLimit.status).json(pageLimit.body);
    }

    const content = asContent(base.content);
    const settings = asContent(base.settings);
    const signals = extractPresellSignals({
      title: base.title,
      type: base.type,
      language: base.language || "en",
      category: base.category,
      content,
      settings,
      videoUrl: base.videoUrl,
    });

    const packFacts =
      sanitizeOfferFacts(signals.salesText) || sanitizeOfferFacts(signals.subtitle) || "";
    const generationNiche =
      content.generationNiche === "white" || content.generation_niche === "white" ? "white" : "black";
    const packInput = {
      productName: signals.productName || base.title,
      language: base.language || "en",
      offerFacts: packFacts,
      sourceUrl: signals.sourceUrl,
      priceMention: signals.priceMention,
      generationNiche: generationNiche as "black" | "white",
    };

    let pack: TriplePackCopy = {
      landing: buildDeterministicReviewCopy({ ...packInput, angle: "landing" }),
      review: buildDeterministicReviewCopy({ ...packInput, angle: "review" }),
      advertorial: buildDeterministicReviewCopy({ ...packInput, angle: "advertorial" }),
      source: "deterministic",
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      error: null,
    };

    const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
    const wantDeterministic = parsed.data.deterministic_only || !openaiConfigured;
    if (!wantDeterministic) {
      const gate = await assertPresellAiQuotaAvailable(userId);
      if (!gate.ok) {
        // Alinhado com o wizard: sem quota → texto editorial seguro (não 429).
        pack = {
          ...pack,
          error: typeof gate.body === "object" && gate.body && "error" in gate.body
            ? String((gate.body as { error?: string }).error || "quota")
            : "quota",
        };
      } else {
        pack = await generateTriplePackCopy(packInput);
        if (pack.source === "llm") {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { workspaceId: true },
          });
          if (user?.workspaceId) {
            await appendWorkspaceAuditLog({
              workspaceId: user.workspaceId,
              actorUserId: actorUserId(req) || userId,
              action: "presell_ai_review_copy",
              resourceType: "presell_pack",
              resourceId: base.id,
              metadata: {
                model: pack.model,
                tokens_in: pack.tokensIn,
                tokens_out: pack.tokensOut,
                kind: "triple_pack",
                month: gate.quota.monthKey,
              },
            });
          }
        }
      }
    }

    const tracking = (base.tracking && typeof base.tracking === "object"
      ? base.tracking
      : {}) as Record<string, unknown>;

    const publishSiblings =
      parsed.data.create_rotator && base.status === "published";

    const ensureSibling = async (type: "tsl" | "review" | "advertorial", copy: typeof pack.landing) => {
      // Sempre isolar: cada ângulo com texto próprio (sem espelho/pageDocument da base).
      const isolated = applyCopyToContent(content, copy, { isolateVariant: true });
      if (base.type === type) {
        const updated = await systemPrisma.presellPage.update({
          where: { id: base.id },
          data: {
            content: isolated as Prisma.InputJsonValue,
            complianceGate: "unchecked",
            contentFingerprint: null,
          },
        });
        return updated;
      }
      const created = await prisma.presellPage.create({
        data: {
          userId,
          title: `${base.title} (${type === "tsl" ? "landing" : type})`.slice(0, 180),
          slug: slugifyPack(base.slug || base.title, type),
          type,
          language: base.language,
          category: base.category,
          status: publishSiblings ? "published" : "draft",
          videoUrl: base.videoUrl,
          content: isolated as Prisma.InputJsonValue,
          settings: settings as Prisma.InputJsonValue,
          tracking: tracking as Prisma.InputJsonValue,
          customDomainId: base.customDomainId,
          complianceGate: "unchecked",
        },
      });
      return created;
    };

    const pageLanding = await ensureSibling("tsl", pack.landing);
    const pageReview = await ensureSibling("review", pack.review);
    const pageAdvertorial = await ensureSibling("advertorial", pack.advertorial);

    const { resolvePresellAiQuota } = await import("../lib/presellAiQuota");
    const quota = await resolvePresellAiQuota(userId);

    res.json({
      source: pack.source,
      model: pack.model,
      llm_error: pack.error,
      create_rotator_hint: parsed.data.create_rotator,
      pages: {
        landing: { id: pageLanding.id, type: pageLanding.type, slug: pageLanding.slug, status: pageLanding.status },
        review: { id: pageReview.id, type: pageReview.type, slug: pageReview.slug, status: pageReview.status },
        advertorial: {
          id: pageAdvertorial.id,
          type: pageAdvertorial.type,
          slug: pageAdvertorial.slug,
          status: pageAdvertorial.status,
        },
      },
      quota: {
        plan_type: quota.planType,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        month: quota.monthKey,
      },
      note: publishSiblings
        ? "3 variantes publicadas com texto distinto. O wizard/painel pode montar o rotador 33/33/34. Aprovação Ads não é garantida."
        : "3 variantes em rascunho com texto distinto. Publique cada uma e monte o rotador 33/33/34 no painel Rotadores. Aprovação Ads não é garantida.",
    });
  },
};
