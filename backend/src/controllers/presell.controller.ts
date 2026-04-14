import { Request, Response } from "express";
import type { PresellPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import {
  assertPresellAllowedOnRequestHost,
  isMainOrPreviewHostname,
  resolveVerifiedOwnerUserIdFromDb,
} from "../lib/presellHostAccess";
import { getRequestHostname, hostnameLookupVariants } from "../lib/requestHost";
import { getVerifiedOwnerIdForHostname } from "../lib/customDomainCache";
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
  /** Domínio público para links; omitir = sem override; null = usar só o padrão da conta. */
  custom_domain_id: z.preprocess(
    (v) => (v === "" || v === null ? null : v === undefined ? undefined : v),
    z.union([z.string().uuid(), z.null()]).optional(),
  ),
});

async function resolveCustomDomainIdForUser(userId: string, raw: string | null): Promise<string | null> {
  if (raw === null) return null;
  const d = await prisma.customDomain.findFirst({
    where: { id: raw, userId, status: "verified" },
  });
  if (!d) {
    throw new Error("Domínio inválido ou não verificado.");
  }
  return raw;
}

/**
 * Quando o cliente não envia `custom_domain_id`, associa um domínio verificado.
 * Mesma prioridade que a migração de backfill: `is_default` primeiro, depois o mais antigo (`created_at`).
 */
async function resolveDefaultVerifiedCustomDomainIdForUser(userId: string): Promise<string | null> {
  const rows = await prisma.customDomain.findMany({
    where: { userId, status: "verified" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return rows[0]?.id ?? null;
}

const importFromUrlSchema = z.object({
  product_url: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().url()),
  language: z.string().optional(),
  /** `""` do cliente não pode falhar `.url().optional()`. */
  affiliate_link: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().url().optional(),
  ),
});

export const presellController = {
  async getPublicById(req: Request, res: Response) {
    const id = req.params.id;
    /** Rota pública sem JWT / ALS — usar systemPrisma com filtro explícito por id. */
    const page = await systemPrisma.presellPage.findFirst({
      where: { id },
      include: { user: { include: { subscription: true } } },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    /**
     * Não aplicar `assertPresellAllowedOnRequestHost` aqui: o id (UUID) é único globalmente.
     * Atrás de Vercel→Railway o `Host`/`X-Forwarded-*` por vezes não bate com o domínio do visitante,
     * causando 404 falsos em domínios personalizados. O slug (`getPublicBySlug`) continua restrito ao host.
     */
    if (page.status !== "published") {
      const hint =
        page.status === "draft"
          ? "Esta página ainda não está publicada. No painel, altere o estado para «Publicada»."
          : page.status === "paused"
            ? "Esta página está em pausa. No painel, reativa ou publica de novo."
            : "Esta página não está disponível publicamente.";
      return res.status(404).json({ error: hint, code: "PRESHELL_NOT_PUBLISHED" });
    }

    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    return res.json(mapPresell(page));
  },

  /**
   * Link público por slug (estilo «/p/meu_endereco») — só em domínio personalizado verificado.
   * No dclickora.com / localhost / preview Vercel usa-se sempre GET /presells/id/:uuid.
   */
  async getPublicBySlug(req: Request, res: Response) {
    const raw = req.params.slug;
    const slug = typeof raw === "string" ? decodeURIComponent(raw) : "";
    if (!slug || slug.length > 200) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const host = getRequestHostname(req);
    if (!host || isMainOrPreviewHostname(host)) {
      return res.status(404).json({
        error:
          "O link por slug só funciona no teu domínio personalizado verificado. No dclickora.com usa o URL com /p/ e o identificador (UUID).",
        code: "PRESHELL_SLUG_MAIN_HOST",
      });
    }

    let ownerId = getVerifiedOwnerIdForHostname(host);
    if (!ownerId) {
      ownerId = await resolveVerifiedOwnerUserIdFromDb(host);
    }
    if (!ownerId) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const page = await systemPrisma.presellPage.findFirst({
      where: {
        userId: ownerId,
        status: "published",
        slug: { equals: slug, mode: "insensitive" },
      },
      include: { user: { include: { subscription: true } } },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    return res.json(mapPresell(page));
  },

  /**
   * Raiz do domínio personalizado: id da presell publicada associada a este host (`custom_domain_id`).
   * Se `custom_domains.root_presell_id` estiver definido, usa essa; senão a mais recentemente atualizada.
   */
  async getRootPresellForHost(req: Request, res: Response) {
    const host = getRequestHostname(req);
    if (!host || isMainOrPreviewHostname(host)) {
      return res.status(404).json({ error: "Indisponível neste host.", code: "ROOT_PRESELL_MAIN_HOST" });
    }

    let ownerId = getVerifiedOwnerIdForHostname(host);
    if (!ownerId) {
      ownerId = await resolveVerifiedOwnerUserIdFromDb(host);
    }
    if (!ownerId) {
      return res.status(404).json({ error: "Domínio não verificado.", code: "ROOT_PRESELL_NOT_VERIFIED" });
    }

    const variants = hostnameLookupVariants(host);
    const cd = await systemPrisma.customDomain.findFirst({
      where: { status: "verified", userId: ownerId, hostname: { in: variants } },
      select: { id: true, rootPresellId: true },
    });
    if (!cd) {
      return res.status(404).json({ error: "Domínio não encontrado.", code: "ROOT_PRESELL_NO_DOMAIN" });
    }

    let page = null as
      | Prisma.PresellPageGetPayload<{ include: { user: { include: { subscription: true } } } }>
      | null;

    if (cd.rootPresellId) {
      const byRoot = await systemPrisma.presellPage.findFirst({
        where: {
          id: cd.rootPresellId,
          userId: ownerId,
          customDomainId: cd.id,
          status: "published",
        },
        include: { user: { include: { subscription: true } } },
      });
      if (byRoot && evaluateSubscriptionAccess(byRoot.user.subscription).allowed) {
        page = byRoot;
      }
    }

    if (!page) {
      page = await systemPrisma.presellPage.findFirst({
        where: {
          userId: ownerId,
          customDomainId: cd.id,
          status: "published",
        },
        orderBy: [{ updatedAt: "desc" }],
        include: { user: { include: { subscription: true } } },
      });
    }

    if (!page) {
      return res.status(404).json({
        error: "Nenhuma presell publicada neste domínio.",
        code: "ROOT_PRESELL_NONE",
      });
    }

    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    return res.json({ id: page.id });
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
        customDomainId: true,
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

    let customDomainIdField: { customDomainId?: string | null } = {};
    if (parsed.data.custom_domain_id !== undefined) {
      try {
        customDomainIdField.customDomainId = await resolveCustomDomainIdForUser(
          req.user!.userId,
          parsed.data.custom_domain_id,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Domínio inválido.";
        return res.status(400).json({ error: msg });
      }
    } else {
      const auto = await resolveDefaultVerifiedCustomDomainIdForUser(req.user!.userId);
      if (auto) customDomainIdField = { customDomainId: auto };
    }

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
          ...customDomainIdField,
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

    const data: Record<string, unknown> = {
      ...(req.body.title && { title: req.body.title }),
      ...(req.body.slug && { slug: req.body.slug }),
      ...(req.body.type && { type: req.body.type }),
      ...(req.body.category !== undefined && { category: req.body.category }),
      ...(req.body.language && { language: req.body.language }),
      ...(req.body.content && { content: req.body.content }),
      ...(req.body.video_url !== undefined && { videoUrl: req.body.video_url }),
      ...(req.body.settings && { settings: req.body.settings }),
      ...(req.body.tracking && { tracking: req.body.tracking }),
    };

    if (req.body.custom_domain_id !== undefined) {
      try {
        const raw = req.body.custom_domain_id;
        const next = await resolveCustomDomainIdForUser(
          req.user!.userId,
          raw === null || raw === "" ? null : String(raw),
        );
        data.customDomainId = next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Domínio inválido.";
        return res.status(400).json({ error: msg });
      }
    }

    const updated = await systemPrisma.presellPage.update({
      where: { id: page.id },
      data: data as Prisma.PresellPageUpdateInput,
    });

    if (req.body.custom_domain_id !== undefined) {
      const oldId = page.customDomainId;
      const newId = updated.customDomainId;
      if (oldId && oldId !== newId) {
        await systemPrisma.customDomain.updateMany({
          where: { id: oldId, rootPresellId: page.id },
          data: { rootPresellId: null },
        });
      }
    }

    res.json(mapPresell(updated));
  },

  async delete(req: Request, res: Response) {
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    await systemPrisma.presellPage.delete({ where: { id: page.id } });
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
          customDomainId: page.customDomainId,
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

    const updated = await systemPrisma.presellPage.update({
      where: { id: page.id },
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
  customDomainId: string | null;
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
    custom_domain_id: p.customDomainId ?? null,
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
    custom_domain_id: p.customDomainId ?? null,
    settings: p.settings,
    tracking: p.tracking,
    created_at: p.createdAt?.toISOString?.() || p.createdAt,
    updated_at: p.updatedAt?.toISOString?.() || p.updatedAt,
  };
}
