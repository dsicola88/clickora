import { Request, Response } from "express";
import type { PresellPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { importPresellFromProductUrl } from "../lib/presellImporter";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum([
    "cookies",
    "fantasma",
    "vsl",
    "tsl",
    "dtc",
    "review",
    "vsl_tsl",
    "sexo",
    "idade",
    "grupo_homem",
    "grupo_mulher",
    "pais",
    "captcha",
    "modelos",
    "desconto",
  ]).optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  content: z.any().optional(),
  /** `""` / `null` do cliente tratados como omitido — evita 400 por string vazia. */
  video_url: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().url().optional(),
  ),
  settings: z.any().optional(),
  tracking: z.any().optional(),
  status: z.enum(["draft", "published", "paused", "archived"]).optional(),
});

const importFromUrlSchema = z.object({
  product_url: z.string().url(),
  language: z.string().optional(),
  affiliate_link: z.string().url().optional(),
});

export const presellController = {
  async getPublicById(req: Request, res: Response) {
    const id = req.params.id;
    /** Rota pública sem JWT / ALS — usar systemPrisma com filtro explícito por id + estado. */
    const page = await systemPrisma.presellPage.findFirst({
      where: { id, status: "published" },
      include: { user: { include: { subscription: true } } },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    return res.json(mapPresell(page));
  },

  async getAll(req: Request, res: Response) {
    /** Sem `content` na lista — JSON gigante por página fazia GET lento e 502 no proxy; detalhe em GET /:id. */
    const pages = await prisma.presellPage.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        category: true,
        language: true,
        status: true,
        clicks: true,
        impressions: true,
        conversions: true,
        videoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(pages.map(mapPresellListRow));
  },

  async getById(req: Request, res: Response) {
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    res.json(mapPresell(page));
  },

  async create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });

    // Check plan limits
    const count = await prisma.presellPage.count({ where: { userId: req.user!.userId } });
    const sub = await prisma.subscription.findUnique({
      where: { userId: req.user!.userId },
      include: { plan: true },
    });

    if (sub?.plan.maxPresellPages && count >= sub.plan.maxPresellPages) {
      return res.status(403).json({ error: `Limite de ${sub.plan.maxPresellPages} páginas atingido. Faça upgrade do seu plano.` });
    }

    let page: PresellPage;
    try {
      page = await prisma.presellPage.create({
        data: {
          userId: req.user!.userId,
          title: parsed.data.title,
          slug: parsed.data.slug,
          type: parsed.data.type || "cookies",
          category: parsed.data.category,
          language: parsed.data.language || "pt",
          content: parsed.data.content || {},
          videoUrl: parsed.data.video_url,
          settings: parsed.data.settings || {},
          tracking: parsed.data.tracking || {},
          status: parsed.data.status || "draft",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Já existe uma página com esse slug." });
      }
      throw error;
    }

    res.status(201).json(mapPresell(page));
  },

  async update(req: Request, res: Response) {
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const updated = await prisma.presellPage.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.title && { title: req.body.title }),
        ...(req.body.slug && { slug: req.body.slug }),
        ...(req.body.type && { type: req.body.type }),
        ...(req.body.category !== undefined && { category: req.body.category }),
        ...(req.body.language && { language: req.body.language }),
        ...(req.body.content && { content: req.body.content }),
        ...(req.body.video_url !== undefined && { videoUrl: req.body.video_url }),
        ...(req.body.settings && { settings: req.body.settings }),
        ...(req.body.tracking && { tracking: req.body.tracking }),
      },
    });

    res.json(mapPresell(updated));
  },

  async delete(req: Request, res: Response) {
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    await prisma.presellPage.delete({ where: { id: req.params.id } });
    res.json({ message: "Página removida" });
  },

  async duplicate(req: Request, res: Response) {
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    let copy: PresellPage;
    try {
      copy = await prisma.presellPage.create({
        data: {
          userId: req.user!.userId,
          title: `${page.title} (cópia)`,
          slug: `${page.slug}_copy_${Date.now()}`,
          type: page.type,
          category: page.category,
          language: page.language,
          content: page.content || {},
          videoUrl: page.videoUrl,
          settings: page.settings || {},
          tracking: page.tracking || {},
          status: "draft",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Falha ao duplicar: slug já existe." });
      }
      throw error;
    }

    res.status(201).json(mapPresell(copy));
  },

  async toggleStatus(req: Request, res: Response) {
    const { status } = req.body;
    if (!["draft", "published", "paused", "archived"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const updated = await prisma.presellPage.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(mapPresell(updated));
  },

  async getCount(req: Request, res: Response) {
    const count = await prisma.presellPage.count({
      where: { userId: req.user!.userId },
    });
    res.json({ count });
  },

  async importFromUrl(req: Request, res: Response) {
    const parsed = importFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    try {
      const data = await importPresellFromProductUrl({
        productUrl: parsed.data.product_url,
        language: parsed.data.language,
        affiliateLink: parsed.data.affiliate_link,
      });
      return res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar dados da página.";
      return res.status(422).json({ error: message });
    }
  },
};

function mapPresellListRow(p: {
  id: string;
  title: string;
  slug: string;
  type: string;
  category: string | null;
  language: string | null;
  status: PresellPage["status"];
  clicks: number;
  impressions: number;
  conversions: number;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    title: p.title,
    content: {} as Record<string, unknown>,
    slug: p.slug,
    type: p.type,
    category: p.category ?? "",
    language: p.language ?? "pt",
    status: p.status,
    clicks: p.clicks,
    impressions: p.impressions,
    conversions: p.conversions,
    video_url: p.videoUrl ?? undefined,
    settings: {} as Record<string, unknown>,
    tracking: {} as Record<string, unknown>,
    created_at: p.createdAt?.toISOString?.() || String(p.createdAt),
    updated_at: p.updatedAt?.toISOString?.() || String(p.updatedAt),
  };
}

function mapPresell(p: PresellPage) {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    slug: p.slug,
    type: p.type,
    category: p.category,
    language: p.language,
    status: p.status,
    clicks: p.clicks,
    impressions: p.impressions,
    conversions: p.conversions,
    video_url: p.videoUrl,
    settings: p.settings,
    tracking: p.tracking,
    created_at: p.createdAt?.toISOString?.() || p.createdAt,
    updated_at: p.updatedAt?.toISOString?.() || p.updatedAt,
  };
}
