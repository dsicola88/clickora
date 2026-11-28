import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import type { PresellPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import {
  builderMediaObjectKey,
  getPresellBuilderMediaDir,
  isSafeBuilderMediaFilename,
  persistPresellBuilderMedia,
} from "../lib/presellBuilderMediaUpload";
import { isR2Configured, r2PublicUrl } from "../lib/r2Storage";
import {
  assertPresellAllowedOnRequestHost,
  assertPresellHostBindingAllowed,
  evaluatePublicPresellAccess,
  isMainOrPreviewHostname,
  resolveVerifiedOwnerUserIdFromDb,
} from "../lib/presellHostAccess";
import { getRequestHostname, hostnameLookupVariants } from "../lib/requestHost";
import { getVerifiedOwnerIdForHostname, refreshCustomDomainCache } from "../lib/customDomainCache";
import {
  alignPresellBindingsWithLegacyDomain,
  DomainRoutingRefusedError,
  planRollbackTarget,
  swapPresellPrimaryDomain,
  syncPresellDomainBindings,
} from "../lib/domainRoutingService";
import { affiliateLinkFromPresellPage } from "../lib/trackOfferRedirectGuard";
import {
  resolveEffectiveOfferForPresell,
  type LinkedOfferSnapshot,
} from "../lib/offerValidation";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { importPresellFromProductUrl } from "../lib/presellImporter";
import { mergeAccountPixelsIntoSettings } from "../lib/accountPixelsMerge";
import { billingUserId } from "../lib/requestContext";
import { assertCanCreatePresellPages } from "../lib/presellPageLimits";
import { denyIfCannotWritePresells } from "./workspace.controller";
import { resolvePublicFooterBranding } from "../lib/publicFooterBranding";
import { enforceTrackingRules } from "../lib/trackGuard";
import { preferredTrackApiBaseForUser, sameOriginTrackApiBase } from "../lib/publicApiBase";
import { extractClientIp } from "../lib/clientIp";
import { reconcileMirrorInPresellContent } from "../lib/presellMirrorRehost";
import { sanitizeMirrorInContentRecord } from "../lib/presellMirrorSanitizeContent";
import { assertPublishAllowed } from "../compliance/service";
import { shouldEnforceComplianceServeBlock } from "../compliance/evaluate";
import { ensureShowAffiliateTrustFooterOnCreate } from "../lib/presellAffiliateTrustFooter";
import {
  enrichPresellPageRecords,
  enrichPresellSettingsWithOperatorIdentity,
  settingsRecord,
} from "../lib/presellOperatorIdentity";
import {
  coercePresellTypeForNiche,
  normalizePresellGenerationNiche,
  resolvePresellGenerationNicheFromContent,
} from "../lib/presellGenerationNiche";
import {
  beginPresellCreate,
  recordCreateStage,
  timedCreateStage,
} from "../lib/createStageMetrics";
import { enqueuePresellDraftAudit } from "../lib/complianceAuditQueue";
import { buildPresellLiteHtml, isPresellLiteHtmlEligible } from "../lib/presellLiteHtml";
import { PRESSELL_LITE_HTML_CSP } from "../lib/sanitizeMirrorEmbedForLiteHtml";
import { buildLiteImpressionPixelUrl, liteLandingAttributionParams } from "../lib/buildLiteImpressionPixelUrl";
import { decideRootPresell } from "../lib/customDomainRoot";
import { invalidateTrackEdgeDest } from "../lib/trackEdgeDestCache";
import { isPresellUuidParam, publicSpaPresellUrl } from "../lib/publicSpaOrigin";
import { PUBLIC_DOMAIN_REQUIRED_MESSAGE } from "../lib/publicPresellHost";
import { isPublicSafeTenantBrandName } from "../lib/tenantBrandingPublic";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum([
    "cookies",
    "segmentacao",
    "fantasma",
    "vsl",
    "tsl",
    "dtc",
    "review",
    "advertorial",
    "vsl_tsl",
    "sexo",
    "idade",
    "idade_sexo",
    "idade_pais",
    "sexo_pais",
    "grupo_homem",
    "grupo_mulher",
    "pais",
    "captcha",
    "modelos",
    "desconto",
    /** Editor visual por blocos — documento em `content.pageDocument`. */
    "builder",
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
  /** Oferta associada (entidade independente Offer); opcional para compatibilidade legada. */
  offer_id: z.preprocess(
    (v) => (v === "" || v === null ? null : v === undefined ? undefined : v),
    z.union([z.string().uuid(), z.null()]).optional(),
  ),
});

function isMissingSmartRoutingSchemaError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022")
  );
}

const presellOfferSelect = {
  id: true,
  name: true,
  network: true,
  hoplinkUrl: true,
  backupHoplinkUrl: true,
  validationStatus: true,
  isActive: true,
} as const;

const presellBindingInclude: Prisma.PresellPage$domainBindingsArgs = {
  include: {
    customDomain: {
      select: {
        id: true,
        hostname: true,
        status: true,
        purpose: true,
        isActive: true,
        healthStatus: true,
        routingRole: true,
        isDefault: true,
      },
    },
  },
  orderBy: [{ role: "asc" }, { priority: "asc" }],
};

const setPresellDomainsSchema = z.object({
  bindings: z
    .array(
      z.object({
        custom_domain_id: z.string().uuid(),
        role: z.enum(["primary", "backup", "standby"]).default("backup"),
        priority: z.number().int().min(1).max(999).optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .max(25),
});

const swapPresellPrimarySchema = z.object({
  target_domain_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  demote_previous_to: z.enum(["backup", "standby"]).optional(),
});

async function resolveCustomDomainIdForUser(userId: string, raw: string | null): Promise<string | null> {
  if (raw === null) return null;
  const d = await prisma.customDomain.findFirst({
    where: { id: raw, userId, status: "verified" },
  });
  if (!d) {
    throw new Error("Domínio inválido ou não verificado.");
  }
  if (d.purpose === "tracking") {
    throw new Error(
      "Domínio só de tracking não pode alojar lander — escolha hosting ou both, ou o domínio padrão da conta.",
    );
  }
  return raw;
}

/**
 * Quando o cliente não envia `custom_domain_id`, associa um domínio verificado.
 * Mesma prioridade que a migração de backfill: `is_default` primeiro, depois o mais antigo (`created_at`).
 */
async function loadUserOperatorIdentity(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, saleNotifyEmail: true },
  });
}

/** Preenche CT-002 (nome + e-mail) a partir da conta — evita rascunho silencioso no white. */
async function ensurePresellOperatorIdentityOnPage(page: PresellPage): Promise<PresellPage> {
  const user = await loadUserOperatorIdentity(page.userId);
  if (!user) return page;
  const { content, settings, changed } = enrichPresellPageRecords({
    content: page.content,
    settings: page.settings,
    user,
  });
  if (!changed) return page;
  return systemPrisma.presellPage.update({
    where: { id: page.id },
    data: {
      settings: settings as Prisma.InputJsonValue,
      content: content as Prisma.InputJsonValue,
      complianceGate: "unchecked",
      contentFingerprint: null,
    },
  });
}

async function resolveDefaultVerifiedCustomDomainIdForUser(userId: string): Promise<string | null> {
  const row = await prisma.customDomain.findFirst({
    where: {
      userId,
      status: "verified",
      OR: [{ purpose: "hosting" }, { purpose: "both" }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return row?.id ?? null;
}

const importFromUrlSchema = z.object({
  product_url: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().url()),
  language: z.string().optional(),
  generation_niche: z.enum(["black", "white"]).optional(),
  /** `""` do cliente não pode falhar `.url().optional()`. */
  affiliate_link: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().url().optional(),
  ),
});

async function findLitePageByUuid(id: string) {
  try {
    return await systemPrisma.presellPage.findFirst({
      where: { id },
      include: {
        offer: { select: presellOfferSelect },
        user: { include: { subscription: { include: { plan: true } } } },
      },
    });
  } catch (e) {
    if (!isMissingSmartRoutingSchemaError(e)) throw e;
    const row = await systemPrisma.presellPage.findFirst({
      where: { id },
      include: { user: { include: { subscription: { include: { plan: true } } } } },
    });
    return row ? { ...row, offer: null } : null;
  }
}

export const presellController = {
  async getPublicById(req: Request, res: Response) {
    const id = req.params.id;
    /** Rota pública sem JWT / ALS — usar systemPrisma com filtro explícito por id. */
    const page = await findLitePageByUuid(id);

    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    /**
     * Em domínio personalizado verificado, só landers do dono desse host.
     * Em dclickora.com / preview / host sem domínio verificado, `assert` falha aberto
     * (getRequestHostname já prefere forwarded do visitante vs *.railway.app).
     */
    const access = await evaluatePublicPresellAccess(req, page.userId);
    if (!access.allowed) {
      return sendPresellNotPublic(res, access.reason, "json");
    }
    if (!access.ownerPreview && !(await assertPresellHostBindingAllowed(req, page.id))) {
      return sendPresellNotPublic(res, "host_mismatch", "json");
    }
    if (page.status !== "published") {
      const hint =
        page.status === "draft"
          ? "Esta página ainda não está publicada. No painel, altere o estado para «Publicada»."
          : page.status === "paused"
            ? "Esta página está em pausa. No painel, reativa ou publica de novo."
            : "Esta página não está disponível publicamente.";
      return res.status(404).json({ error: hint, code: "PRESHELL_NOT_PUBLISHED" });
    }
    if (
      shouldEnforceComplianceServeBlock({
        gate: page.complianceGate,
        pageType: page.type,
      })
    ) {
      return res.status(404).json({
        error: "Página indisponível por conformidade.",
        code: "PRESHELL_COMPLIANCE_BLOCKED",
      });
    }

    const subscription = evaluateSubscriptionAccess(page.user.subscription);
    if (!subscription.allowed) return res.status(403).json({ error: "Página indisponível." });

    const mapped = await mapPresellForPublic(page);
    return sendPublicPresell(req, res, page, mapped, { ownerPreview: access.ownerPreview });
  },

  /**
   * HTML estático cacheável para Ads LCP (`/l/:uuid` via rewrite Vercel).
   * Tipos com gate → 302 para SPA `/p/:id`.
   */
  async getPublicHtml(req: Request, res: Response) {
    const rawParam = typeof req.params.id === "string" ? req.params.id : "";
    let page: Awaited<ReturnType<typeof findLitePageByUuid>> = null;
    if (isPresellUuidParam(rawParam)) {
      page = await findLitePageByUuid(rawParam);
    } else {
      /** `/l/{slug}` — só em domínio personalizado verificado (slug é único por utilizador). */
      let slug = "";
      try {
        slug = decodeURIComponent(rawParam).trim();
      } catch {
        slug = "";
      }
      const host = getRequestHostname(req);
      if (slug && slug.length <= 200 && host && !isMainOrPreviewHostname(host)) {
        let ownerId = getVerifiedOwnerIdForHostname(host);
        if (!ownerId) ownerId = await resolveVerifiedOwnerUserIdFromDb(host);
        if (ownerId) {
          try {
            page = await systemPrisma.presellPage.findFirst({
              where: { userId: ownerId, status: "published", slug: { equals: slug, mode: "insensitive" } },
              include: {
                offer: { select: presellOfferSelect },
                user: { include: { subscription: { include: { plan: true } } } },
              },
            });
          } catch (e) {
            if (!isMissingSmartRoutingSchemaError(e)) throw e;
            const fallback = await systemPrisma.presellPage.findFirst({
              where: { userId: ownerId, status: "published", slug: { equals: slug, mode: "insensitive" } },
              include: { user: { include: { subscription: { include: { plan: true } } } } },
            });
            page = fallback ? { ...fallback, offer: null } : null;
          }
        }
      }
    }
    if (!page) return res.status(404).type("text/plain").send("Página não encontrada");
    const htmlAccess = await evaluatePublicPresellAccess(req, page.userId);
    if (!htmlAccess.allowed) {
      return sendPresellNotPublic(res, htmlAccess.reason, "text");
    }
    if (!htmlAccess.ownerPreview && !(await assertPresellHostBindingAllowed(req, page.id))) {
      return sendPresellNotPublic(res, "host_mismatch", "text");
    }
    if (page.status !== "published") {
      return res.status(404).type("text/plain").send("Página não publicada");
    }
    if (
      shouldEnforceComplianceServeBlock({
        gate: page.complianceGate,
        pageType: page.type,
      })
    ) {
      return res.status(404).type("text/plain").send("Página indisponível por conformidade");
    }
    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) {
      return res.status(403).type("text/plain").send("Página indisponível");
    }

    const spaUrl = publicSpaPresellUrl(req, page.id, page.slug);
    if (!spaUrl) {
      /** Sem domínio de assinante nem `PUBLIC_PRESELL_HOST`: não há onde publicar. */
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      return res.status(404).type("text/plain").send(PUBLIC_DOMAIN_REQUIRED_MESSAGE);
    }
    if (!isPresellLiteHtmlEligible(page.type)) {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Presell-Lite", "redirect-spa");
      return res.redirect(302, spaUrl);
    }

    /**
     * Mesma página para todos (humanos, AdsBot, Googlebot): sem troca de conteúdo por país,
     * IP, User-Agent ou lista. O antifraude actua no hop `/track/r/` e nos relatórios.
     */
    const liteUa = req.headers["user-agent"] || "";
    const ip = extractClientIp(req);
    /** Só regista a visita; o resultado nunca altera o HTML (antifraude = hop/pixel). */
    await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: page.id,
      ip,
      userAgent: liteUa,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "public_page",
      recordedEventType: "other",
    });
    // Sem domínio de tracking: mesma origem da presell (o domínio principal não serve /api/track/r).
    const trackApiBase =
      (await preferredTrackApiBaseForUser(page.userId)) ?? sameOriginTrackApiBase(req, spaUrl);
    const built = buildPresellLiteHtml({
      id: page.id,
      title: page.title,
      type: page.type,
      language: page.language,
      content: page.content,
      tracking: page.tracking,
      offer: (page as { offer?: LinkedOfferSnapshot | null }).offer ?? null,
      trackApiBase,
      spaPath: spaUrl,
      impressionPixelUrl: buildLiteImpressionPixelUrl(trackApiBase, page.id, req),
      landingAttributionQuery: liteLandingAttributionParams(req).toString(),
    });
    if (!built.ok) {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Presell-Lite", built.reason);
      return res.redirect(302, spaUrl);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      htmlAccess.ownerPreview ? "private, no-store" : "public, max-age=120, stale-while-revalidate=600",
    );
    res.setHeader("Content-Security-Policy", PRESSELL_LITE_HTML_CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Presell-Lite", "1");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.status(200).send(built.html);
  },

  /**
   * Link público por slug (`/{slug}` ou legado `/p/{slug}`) — só em domínio personalizado verificado.
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

    let page: PresellPageWithOwnerPlan | null = null;
    try {
      page = await systemPrisma.presellPage.findFirst({
        where: {
          userId: ownerId,
          status: "published",
          slug: { equals: slug, mode: "insensitive" },
        },
        include: {
          offer: { select: presellOfferSelect },
          user: { include: { subscription: { include: { plan: true } } } },
        },
      });
    } catch (e) {
      if (!isMissingSmartRoutingSchemaError(e)) throw e;
      const fallback = await systemPrisma.presellPage.findFirst({
        where: {
          userId: ownerId,
          status: "published",
          slug: { equals: slug, mode: "insensitive" },
        },
        include: { user: { include: { subscription: { include: { plan: true } } } } },
      });
      page = fallback ? ({ ...fallback, offer: null } as PresellPageWithOwnerPlan) : null;
    }

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (!(await assertPresellHostBindingAllowed(req, page.id))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (
      shouldEnforceComplianceServeBlock({
        gate: page.complianceGate,
        pageType: page.type,
      })
    ) {
      return res.status(404).json({
        error: "Página indisponível por conformidade.",
        code: "PRESHELL_COMPLIANCE_BLOCKED",
      });
    }

    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    const mapped = await mapPresellForPublic(page);
    return sendPublicPresell(req, res, page, mapped);
  },

  /**
   * Raiz do domínio personalizado: devolve a presell que o assinante escolheu manualmente em
   * «Presell ao abrir» (`custom_domains.root_presell_id`). NÃO há modo automático: sem escolha
   * (ou escolha indisponível) a raiz mostra a página neutra — 404 `ROOT_PRESELL_NONE` para a SPA.
   * A SPA renderiza a presell em `/` sem redirecionar o browser.
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
      select: { id: true, userId: true, rootPresellId: true, purpose: true, isDefault: true },
    });
    if (!cd) {
      return res.status(404).json({ error: "Domínio não encontrado.", code: "ROOT_PRESELL_NO_DOMAIN" });
    }

    const decision = await decideRootPresell(cd, (presellId) =>
      systemPrisma.presellPage.findFirst({
        where: { id: presellId, userId: ownerId },
        include: { user: { include: { subscription: true } } },
      }),
    );

    if (decision.kind === "tracking") {
      return res.status(200).json({
        id: null,
        purpose: "tracking",
        code: "TRACKING_DOMAIN_ROOT",
        message:
          "Este hostname é só de tracking. Use /api/track/… neste domínio; a lander fica no domínio de hosting.",
      });
    }

    if (decision.kind === "neutral") {
      return res.status(404).json({
        error: "Nenhuma presell escolhida para a raiz deste domínio.",
        code: "ROOT_PRESELL_NONE",
        reason: decision.reason,
      });
    }

    const page = decision.page;
    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    const slug = typeof page.slug === "string" ? page.slug.trim() : "";
    return res.json({ id: page.id, slug: slug || null });
  },

  async uploadBuilderMedia(req: Request, res: Response) {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Envie um ficheiro no campo image." });
    }
    const userId = billingUserId(req);
    const rawProto = req.get("x-forwarded-proto") || req.protocol || "https";
    const proto = rawProto.split(",")[0].trim();
    const host = req.get("host");
    if (!host) {
      return res.status(500).json({ error: "Host desconhecido." });
    }
    try {
      const saved = await persistPresellBuilderMedia({
        userId,
        buffer: file.buffer,
        mimetype: file.mimetype,
        apiOrigin: `${proto}://${host}`,
      });
      return res.json({ url: saved.url, storage: saved.storage });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      return res.status(500).json({ error: msg });
    }
  },

  /** Servir imagens do editor de presells (URL pública para `<img src>`). Legacy local + redirect R2. */
  async getBuilderMediaFile(req: Request, res: Response) {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    const filename = typeof req.params.filename === "string" ? req.params.filename.trim() : "";
    if (
      !userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
      !filename ||
      !isSafeBuilderMediaFilename(filename)
    ) {
      return res.status(404).end();
    }
    /** Só serve se a conta tiver pelo menos uma presell (reduz fishing de userIds vazios). */
    const owns = await systemPrisma.presellPage.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!owns) return res.status(404).end();

    const resolvedBase = path.resolve(path.join(getPresellBuilderMediaDir(), userId));
    const resolvedFile = path.resolve(path.join(resolvedBase, filename));
    if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
      return res.status(404).end();
    }
    if (fs.existsSync(resolvedFile)) {
      const ext = path.extname(filename).slice(1).toLowerCase();
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.sendFile(resolvedFile);
    }
    if (isR2Configured()) {
      return res.redirect(302, r2PublicUrl(builderMediaObjectKey(userId, filename)));
    }
    return res.status(404).end();
  },

  async getAll(req: Request, res: Response) {
    /** Sem `content` na lista — JSON gigante por página fazia GET lento e 502 no proxy; detalhe em GET /:id. */
    const userId = billingUserId(req);
    try {
      const pages = await prisma.presellPage.findMany({
        where: { userId },
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
          offerId: true,
          offer: { select: presellOfferSelect },
          domainBindings: presellBindingInclude,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.json(pages.map(mapPresellListRow));
    } catch (e) {
      if (!isMissingSmartRoutingSchemaError(e)) throw e;
      const pages = await prisma.presellPage.findMany({
        where: { userId },
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
      return res.json(pages.map(mapPresellListRow));
    }
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    try {
      const page = await prisma.presellPage.findFirst({
        where: { id: req.params.id, userId },
        include: {
          offer: { select: presellOfferSelect },
          domainBindings: presellBindingInclude,
        },
      });
      if (!page) return res.status(404).json({ error: "Página não encontrada" });
      return res.json(mapPresell(page));
    } catch (e) {
      if (!isMissingSmartRoutingSchemaError(e)) throw e;
      const page = await prisma.presellPage.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!page) return res.status(404).json({ error: "Página não encontrada" });
      return res.json(mapPresell(page));
    }
  },

  async create(req: Request, res: Response) {
    const endCreate = beginPresellCreate();
    const tAll = Date.now();
    try {
      const tAuthz = Date.now();
      if (await denyIfCannotWritePresells(req, res)) return;
      recordCreateStage("01_authz_write", Date.now() - tAuthz);

      const tValidate = Date.now();
      const parsed = createSchema.safeParse(req.body);
      recordCreateStage("02_validate", Date.now() - tValidate);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });

      const userId = billingUserId(req);

      // Domínio + quota + identidade do operador em paralelo (caminho crítico).
      let customDomainIdField: { customDomainId?: string | null } = {};
      let domainError: string | null = null;
      const domainPromise =
        parsed.data.custom_domain_id !== undefined
          ? resolveCustomDomainIdForUser(userId, parsed.data.custom_domain_id)
              .then((id) => {
                customDomainIdField = { customDomainId: id };
              })
              .catch((e) => {
                domainError = e instanceof Error ? e.message : "Domínio inválido.";
              })
          : resolveDefaultVerifiedCustomDomainIdForUser(userId).then((auto) => {
              if (auto) customDomainIdField = { customDomainId: auto };
            });

      const [pageLimit, operatorUser] = await timedCreateStage("03_parallel_domain_quota_identity", async () => {
        const [limit, op] = await Promise.all([
          assertCanCreatePresellPages(userId, 1),
          loadUserOperatorIdentity(userId),
          domainPromise,
        ]).then(([limit, op]) => [limit, op] as const);
        return [limit, op] as const;
      });

      if (domainError) {
        return res.status(400).json({ error: domainError });
      }

      if (!pageLimit.ok) {
        return res.status(pageLimit.status).json(pageLimit.body);
      }

      let linkedOffer: {
        id: string;
        name: string;
        network: string | null;
        hoplinkUrl: string;
        backupHoplinkUrl: string | null;
        validationStatus: string;
        isActive: boolean;
      } | null = null;
      if (parsed.data.offer_id) {
        linkedOffer = await prisma.offer.findFirst({
          where: { id: parsed.data.offer_id, userId },
          select: presellOfferSelect,
        });
        if (!linkedOffer) {
          return res.status(400).json({ error: "Oferta inválida ou não pertence à conta." });
        }
      }

      let page: PresellPage;
      try {
        let contentPayload: Record<string, unknown> =
          parsed.data.content && typeof parsed.data.content === "object" && !Array.isArray(parsed.data.content)
            ? (parsed.data.content as Record<string, unknown>)
            : {};

        if (linkedOffer && !String(contentPayload.affiliateLink ?? "").trim()) {
          contentPayload = { ...contentPayload, affiliateLink: linkedOffer.hoplinkUrl };
        }

        const tSanitize = Date.now();
        contentPayload = sanitizeMirrorInContentRecord(contentPayload);
        recordCreateStage("04_sanitize_mirror", Date.now() - tSanitize);

        const reconciled = await timedCreateStage("05_reconcile_mirror", () =>
          reconcileMirrorInPresellContent({
            content: contentPayload,
            userId,
            pageHint: parsed.data.slug,
          }),
        );
        contentPayload = reconciled.content;
        const niche = normalizePresellGenerationNiche(
          contentPayload.generationNiche ?? contentPayload.generation_niche,
        );
        contentPayload.generationNiche = niche;
        const safeType = coercePresellTypeForNiche(parsed.data.type || "cookies", niche);

        const tIdent = Date.now();
        const identityEnriched = enrichPresellSettingsWithOperatorIdentity({
          settings: ensureShowAffiliateTrustFooterOnCreate(settingsRecord(parsed.data.settings)),
          content: contentPayload,
          user: operatorUser ?? {},
        });
        recordCreateStage("06_enrich_identity", Date.now() - tIdent);
        const settingsPayload = identityEnriched.settings;

        const trackingPayload =
          parsed.data.tracking && typeof parsed.data.tracking === "object" && !Array.isArray(parsed.data.tracking)
            ? { ...(parsed.data.tracking as Record<string, unknown>) }
            : {};
        if (linkedOffer && !String(trackingPayload.offerUrl ?? "").trim()) {
          trackingPayload.offerUrl = linkedOffer.hoplinkUrl;
        }

        const requestedStatus = parsed.data.status || "draft";
        page = await timedCreateStage("07_db_insert", () =>
          prisma.presellPage.create({
            data: {
              userId,
              title: parsed.data.title,
              slug: parsed.data.slug,
              type: safeType,
              category: parsed.data.category,
              language: parsed.data.language || "pt",
              content: contentPayload as Prisma.InputJsonValue,
              videoUrl: parsed.data.video_url,
              settings: settingsPayload as Prisma.InputJsonValue,
              tracking: trackingPayload as Prisma.InputJsonValue,
              status: "draft",
              complianceGate: "unchecked",
              ...customDomainIdField,
              ...(parsed.data.offer_id !== undefined ? { offerId: parsed.data.offer_id } : {}),
            },
          }),
        );

        if (page.customDomainId) {
          void syncPresellDomainBindings({
            userId,
            presellId: page.id,
            bindings: [{ customDomainId: page.customDomainId, role: "primary", priority: 10 }],
          }).catch(() => {});
        }

        if (requestedStatus === "published") {
          page = await timedCreateStage("08_publish_identity", () => ensurePresellOperatorIdentityOnPage(page));
          const gate = await timedCreateStage("09_publish_gate", () =>
            assertPublishAllowed({ page, runIfStale: true }),
          );
          if (!gate.ok) {
            const tSer = Date.now();
            const body = {
              ...mapPresell(page),
              compliance_blocked: true,
              compliance: gate.body,
              message:
                "A página foi criada em rascunho. Foram detetados problemas que impedem a publicação. A aprovação final depende da plataforma publicitária.",
            };
            recordCreateStage("10_serialize_response", Date.now() - tSer);
            recordCreateStage("00_total", Date.now() - tAll);
            return res.status(201).json(body);
          }
          page = await timedCreateStage("09b_publish_update", () =>
            systemPrisma.presellPage.update({
              where: { id: page.id },
              data: { status: "published" },
            }),
          );
        } else {
          // Auditoria preventiva — fila persistente (Fase 5); nunca drop silencioso.
          const auditJob = await timedCreateStage("08_enqueue_draft_audit", () =>
            enqueuePresellDraftAudit(page),
          );
          (page as PresellPage & { __auditJob?: typeof auditJob }).__auditJob = auditJob;
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "Já existe uma página com esse slug." });
        }
        throw error;
      }

      const tSer = Date.now();
      const auditJob = (page as PresellPage & { __auditJob?: Awaited<ReturnType<typeof enqueuePresellDraftAudit>> })
        .__auditJob;
      const body = {
        ...mapPresell(page),
        audit_scheduled: auditJob ? auditJob.scheduled : false,
        audit_job_id: auditJob && auditJob.ok ? auditJob.jobId : null,
        audit_enqueue_error:
          auditJob && !auditJob.ok ? auditJob.error : undefined,
      };
      recordCreateStage("10_serialize_response", Date.now() - tSer);
      recordCreateStage("00_total", Date.now() - tAll);
      res.status(201).json(body);
    } finally {
      endCreate();
    }
  },

  async update(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    let nextContent: Record<string, unknown> | undefined;
    let mirrorRehosted = 0;
    if (req.body.content && typeof req.body.content === "object" && !Array.isArray(req.body.content)) {
      const sanitized = sanitizeMirrorInContentRecord(req.body.content as Record<string, unknown>);
      const reconciled = await reconcileMirrorInPresellContent({
        content: sanitized,
        userId,
        pageHint: page.slug || page.id.slice(0, 8),
      });
      nextContent = reconciled.content;
      mirrorRehosted = reconciled.rehosted;
    }

    const contentForNiche =
      nextContent ||
      (page.content && typeof page.content === "object" && !Array.isArray(page.content)
        ? (page.content as Record<string, unknown>)
        : {});
    // Espelho longo sem nicho explícito → white (não forçar portal black).
    const niche = resolvePresellGenerationNicheFromContent(contentForNiche);
    if (nextContent) {
      nextContent.generationNiche = niche;
    }
    const requestedType = typeof req.body.type === "string" ? req.body.type : page.type;
    const safeType = coercePresellTypeForNiche(requestedType || "cookies", niche);

    const requestedStatus =
      typeof req.body.status === "string" &&
      ["draft", "published", "paused", "archived"].includes(req.body.status)
        ? (req.body.status as "draft" | "published" | "paused" | "archived")
        : undefined;

    const data: Record<string, unknown> = {
      ...(req.body.title && { title: req.body.title }),
      ...(req.body.slug && { slug: req.body.slug }),
      type: safeType,
      ...(req.body.category !== undefined && { category: req.body.category }),
      ...(req.body.language && { language: req.body.language }),
      ...(nextContent && { content: nextContent as Prisma.InputJsonValue }),
      ...(req.body.video_url !== undefined && { videoUrl: req.body.video_url }),
      ...(req.body.settings && { settings: req.body.settings as Prisma.InputJsonValue }),
      ...(req.body.tracking && { tracking: req.body.tracking as Prisma.InputJsonValue }),
    };

    if (req.body.custom_domain_id !== undefined) {
      try {
        const raw = req.body.custom_domain_id;
        const next = await resolveCustomDomainIdForUser(
          userId,
          raw === null || raw === "" ? null : String(raw),
        );
        data.customDomainId = next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Domínio inválido.";
        return res.status(400).json({ error: msg });
      }
    }

    let finalOffer: { id: string; hoplinkUrl: string } | null = null;
    if (req.body.offer_id !== undefined) {
      const rawOfferId = req.body.offer_id;
      if (rawOfferId === null || rawOfferId === "") {
        data.offerId = null;
      } else {
        const linkedOffer = await prisma.offer.findFirst({
          where: { id: String(rawOfferId), userId },
          select: presellOfferSelect,
        });
        if (!linkedOffer) {
          return res.status(400).json({ error: "Oferta inválida ou não pertence à conta." });
        }
        data.offerId = linkedOffer.id;
        finalOffer = linkedOffer;
      }
    } else if (page.offerId) {
      finalOffer = await prisma.offer
        .findFirst({ where: { id: page.offerId, userId }, select: presellOfferSelect })
        .catch(() => null);
    }
    const offerChanged = data.offerId !== undefined && data.offerId !== (page.offerId ?? null);

    const previousLink = affiliateLinkFromPresellPage(page.content, page.tracking);
    const nextLink = affiliateLinkFromPresellPage(
      nextContent ?? page.content,
      req.body.tracking ?? page.tracking,
    );
    if (finalOffer) {
      const offerHoplink = finalOffer.hoplinkUrl.trim();
      if (offerChanged && !nextLink) {
        // Oferta escolhida agora e presell sem link: semear como no create.
        const seededContent = { ...(nextContent ?? (contentForNiche as Record<string, unknown>)) };
        seededContent.affiliateLink = offerHoplink;
        data.content = seededContent as Prisma.InputJsonValue;
        nextContent = seededContent;
      } else if (!offerChanged && nextLink !== previousLink && nextLink && nextLink !== offerHoplink) {
        // Link editado manualmente para outro destino: a presell deixa de seguir a Offer
        // (evita que uma edição futura da Offer sobrescreva o link escolhido pelo dono).
        data.offerId = null;
      }
    }
    const offerLinkChanged = data.offerId !== undefined && data.offerId !== (page.offerId ?? null);

    // Conteúdo/destino alterado invalida a gate até nova auditoria.
    if (
      nextContent ||
      req.body.settings ||
      req.body.title ||
      req.body.tracking ||
      req.body.video_url !== undefined ||
      offerLinkChanged
    ) {
      data.complianceGate = "unchecked";
      data.contentFingerprint = null;
    }

    let updated: PresellPage;
    try {
      updated = await systemPrisma.presellPage.update({
        where: { id: page.id },
        data: data as Prisma.PresellPageUpdateInput,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Já existe uma página com esse slug." });
      }
      throw error;
    }

    if (req.body.custom_domain_id !== undefined) {
      const oldId = page.customDomainId;
      const newId = updated.customDomainId;
      if (newId !== oldId) {
        try {
          await alignPresellBindingsWithLegacyDomain({
            userId,
            presellId: page.id,
            customDomainId: newId,
            actorUserId: req.user?.userId ?? userId,
          });
        } catch (err) {
          console.warn(
            "[presell.update] falha ao alinhar bindings de domínio:",
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // Transição de estado (ex.: wizard draft→published após bake) — mesma gate que create/toggle.
    if (requestedStatus && requestedStatus !== updated.status) {
      if (requestedStatus === "published") {
        updated = await ensurePresellOperatorIdentityOnPage(updated);
        const gate = await assertPublishAllowed({ page: updated, runIfStale: true });
        if (!gate.ok) {
          // Conteúdo já guardado em draft — 200 para o cliente continuar o fluxo (como create).
          return res.status(200).json({
            ...mapPresell(updated),
            compliance_blocked: true,
            compliance: gate.body,
            message:
              "Alterações guardadas em rascunho. Corrija a conformidade e publique novamente.",
          });
        }
      }
      updated = await systemPrisma.presellPage.update({
        where: { id: updated.id },
        data: { status: requestedStatus },
      });
    } else if (
      // Já publicada: reauditoria após conteúdo/settings.
      // Builder: assertPublishAllowed não bloqueia nem pausa. Outros tipos: a auditoria
      // síncrona pode pausar (gate=blocked) — relemos o estado real antes de responder.
      page.status === "published" &&
      (nextContent || req.body.settings || req.body.title || req.body.video_url !== undefined)
    ) {
      const gate = await assertPublishAllowed({ page: updated, runIfStale: true });
      if (!gate.ok) {
        const afterAudit =
          (await systemPrisma.presellPage.findUnique({ where: { id: updated.id } })) || updated;
        const wasPaused = afterAudit.status === "paused";
        return res.status(200).json({
          ...mapPresell(afterAudit),
          compliance_blocked: true,
          compliance: gate.body,
          message: wasPaused
            ? "Alterações guardadas. A página foi pausada por conformidade — corrija e publique novamente."
            : "Alterações guardadas. A página continua publicada, mas há avisos de conformidade — reveja antes de escalar anúncios.",
        });
      }
    }

    void invalidateTrackEdgeDest(updated.id);

    const mapped = mapPresell(updated) as Record<string, unknown>;
    if (mirrorRehosted > 0) {
      mapped.mirror_images_rehosted = mirrorRehosted;
    }
    res.json(mapped);
  },

  async delete(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: billingUserId(req) },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    await systemPrisma.presellPage.delete({ where: { id: page.id } });
    void invalidateTrackEdgeDest(page.id);
    res.json({ message: "Página removida" });
  },

  async duplicate(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const pageLimit = await assertCanCreatePresellPages(userId, 1);
    if (!pageLimit.ok) {
      return res.status(pageLimit.status).json(pageLimit.body);
    }

    let copy: PresellPage;
    try {
      copy = await prisma.presellPage.create({
        data: {
          userId,
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
          offerId: page.offerId,
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
    if (await denyIfCannotWritePresells(req, res)) return;
    const { status } = req.body;
    if (!["draft", "published", "paused", "archived"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: billingUserId(req) },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    let pageForPublish = page;
    if (status === "published") {
      pageForPublish = await ensurePresellOperatorIdentityOnPage(page);
      const gate = await assertPublishAllowed({ page: pageForPublish, runIfStale: true });
      if (!gate.ok) {
        // Alinhado ao PUT: 200 + compliance_blocked (estado actual preservado).
        return res.status(200).json({
          ...mapPresell(pageForPublish),
          compliance_blocked: true,
          compliance: gate.body,
          message:
            "A página permanece no estado actual. Corrija a conformidade e publique novamente.",
        });
      }
    }

    const updated = await systemPrisma.presellPage.update({
      where: { id: pageForPublish.id },
      data: { status },
    });

    void invalidateTrackEdgeDest(updated.id);

    res.json(mapPresell(updated));
  },

  async getCount(req: Request, res: Response) {
    const count = await prisma.presellPage.count({
      where: { userId: billingUserId(req) },
    });
    res.json({ count });
  },

  async importFromUrl(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = importFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    try {
      const data = await importPresellFromProductUrl({
        productUrl: parsed.data.product_url,
        language: parsed.data.language,
        affiliateLink: parsed.data.affiliate_link,
        generationNiche: parsed.data.generation_niche,
        userId: billingUserId(req),
      });
      return res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar dados da página.";
      return res.status(422).json({ error: message });
    }
  },

  async getDomains(req: Request, res: Response) {
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, title: true, slug: true, customDomainId: true },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const [bindings, availableDomains, events] = await Promise.all([
      prisma.presellDomainBinding.findMany({
        where: { presellId: page.id, userId },
        include: presellBindingInclude.include,
        orderBy: presellBindingInclude.orderBy,
      }),
      prisma.customDomain.findMany({
        where: { userId, purpose: { in: ["hosting", "both"] } },
        orderBy: [{ isDefault: "desc" }, { routingPriority: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          hostname: true,
          status: true,
          purpose: true,
          isDefault: true,
          isActive: true,
          healthStatus: true,
          routingRole: true,
          routingPriority: true,
          httpsReachableCached: true,
        },
      }),
      prisma.domainRoutingEvent.findMany({
        where: { userId, presellId: page.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    return res.json({
      presell_id: page.id,
      custom_domain_id: page.customDomainId,
      bindings: bindings.map(mapPresellBindingDto),
      available_domains: availableDomains.map((d) => ({
        id: d.id,
        hostname: d.hostname,
        status: d.status,
        purpose: d.purpose,
        is_default: d.isDefault,
        is_active: d.isActive,
        health_status: d.healthStatus,
        routing_role: d.routingRole,
        routing_priority: d.routingPriority,
        https_reachable_cached: d.httpsReachableCached,
      })),
      routing_events: events.map((ev) => ({
        id: ev.id,
        event_type: ev.eventType,
        scope: ev.scope,
        custom_domain_id: ev.customDomainId,
        previous_domain_id: ev.previousDomainId,
        target_domain_id: ev.targetDomainId,
        presell_id: ev.presellId,
        offer_id: ev.offerId,
        actor_user_id: ev.actorUserId,
        reason: ev.reason,
        metadata: ev.metadata ?? null,
        created_at: ev.createdAt.toISOString(),
      })),
    });
  },

  async setDomains(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, customDomainId: true },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const parsed = setPresellDomainsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const ids = [...new Set(parsed.data.bindings.map((b) => b.custom_domain_id))];
    if (ids.length > 0) {
      const owned = await prisma.customDomain.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, purpose: true, status: true },
      });
      if (owned.length !== ids.length) {
        return res.status(400).json({ error: "Um ou mais domínios não pertencem à conta." });
      }
      const trackingOnly = owned.find((d) => d.purpose === "tracking");
      if (trackingOnly) {
        return res.status(400).json({
          error: "Domínios exclusivos de tracking não podem alojar presells.",
        });
      }
    }

    try {
      const synced = await syncPresellDomainBindings({
        userId,
        presellId: page.id,
        actorUserId: req.user?.userId ?? userId,
        bindings: parsed.data.bindings.map((b) => ({
          customDomainId: b.custom_domain_id,
          role: b.role,
          priority: b.priority,
          isActive: b.is_active,
        })),
      });
      const updatedBindings = await prisma.presellDomainBinding.findMany({
        where: { presellId: page.id, userId },
        include: presellBindingInclude.include,
        orderBy: presellBindingInclude.orderBy,
      });
      void refreshCustomDomainCache().catch(() => {});
      void invalidateTrackEdgeDest(page.id);
      return res.json({
        presell_id: page.id,
        primary_domain_id: synced.primaryDomainId,
        bindings: updatedBindings.map(mapPresellBindingDto),
      });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao atualizar domínios." });
    }
  },

  async swapPrimaryDomain(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const parsed = swapPresellPrimarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      const result = await swapPresellPrimaryDomain({
        userId,
        presellId: req.params.id,
        targetDomainId: parsed.data.target_domain_id,
        actorUserId: req.user?.userId ?? userId,
        reason: parsed.data.reason ?? "manual_presell_swap",
      });
      void refreshCustomDomainCache().catch(() => {});
      void invalidateTrackEdgeDest(req.params.id);
      return res.json({
        ok: true,
        presell_id: req.params.id,
        previous_domain_id: result.previousDomainId,
        target_domain_id: result.targetDomainId,
      });
    } catch (e) {
      return res
        .status(e instanceof DomainRoutingRefusedError ? 409 : 400)
        .json({ error: e instanceof Error ? e.message : "Falha na troca de domínio." });
    }
  },

  async rollbackPrimaryDomain(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, customDomainId: true },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const [events, domains] = await Promise.all([
      prisma.domainRoutingEvent.findMany({
        where: { userId, presellId: page.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.customDomain.findMany({
        where: { userId },
      }),
    ]);
    const plan = planRollbackTarget({
      currentPrimaryId: page.customDomainId,
      events: events.map((ev) => ({
        eventType: ev.eventType,
        previousDomainId: ev.previousDomainId,
        targetDomainId: ev.targetDomainId,
      })),
      domains,
    });
    if (!plan.ok) {
      return res.status(409).json({
        error: plan.error,
      });
    }
    try {
      const result = await swapPresellPrimaryDomain({
        userId,
        presellId: page.id,
        targetDomainId: plan.targetDomainId,
        actorUserId: req.user?.userId ?? userId,
        reason: typeof req.body?.reason === "string" ? req.body.reason : "manual_rollback",
        isRollback: true,
      });
      void refreshCustomDomainCache().catch(() => {});
      void invalidateTrackEdgeDest(page.id);
      return res.json({
        ok: true,
        presell_id: page.id,
        previous_domain_id: result.previousDomainId,
        target_domain_id: result.targetDomainId,
      });
    } catch (e) {
      return res
        .status(e instanceof DomainRoutingRefusedError ? 409 : 400)
        .json({ error: e instanceof Error ? e.message : "Falha no rollback." });
    }
  },
};

type PresellOfferSummaryRow = {
  id: string;
  name?: string | null;
  network?: string | null;
  hoplinkUrl: string;
  backupHoplinkUrl?: string | null;
  validationStatus: string;
  isActive: boolean;
} | null;

type PresellBindingSummaryRow = {
  id: string;
  customDomainId: string;
  role: string;
  priority: number;
  isActive: boolean;
  customDomain?: {
    id: string;
    hostname: string;
    status: string;
    purpose: string;
    isActive?: boolean;
    healthStatus?: string;
    routingRole?: string;
    isDefault?: boolean;
  } | null;
};

function mapPresellOfferSummary(offer: PresellOfferSummaryRow | undefined) {
  if (!offer) return null;
  return {
    id: offer.id,
    name: offer.name ?? null,
    network: offer.network ?? null,
    hoplink_url: offer.hoplinkUrl,
    backup_hoplink_url: offer.backupHoplinkUrl ?? null,
    validation_status: offer.validationStatus,
    is_active: offer.isActive,
  };
}

function mapPresellBindingDto(b: PresellBindingSummaryRow) {
  return {
    id: b.id,
    custom_domain_id: b.customDomainId,
    hostname: b.customDomain?.hostname ?? null,
    role: b.role,
    priority: b.priority,
    is_active: b.isActive,
    domain_active: b.customDomain?.isActive ?? true,
    health_status: b.customDomain?.healthStatus ?? "unknown",
    status: b.customDomain?.status ?? "pending",
    purpose: b.customDomain?.purpose ?? "both",
    is_default: b.customDomain?.isDefault ?? false,
  };
}

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
  offerId?: string | null;
  offer?: PresellOfferSummaryRow;
  domainBindings?: PresellBindingSummaryRow[];
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
    offer_id: p.offerId ?? null,
    offer: mapPresellOfferSummary(p.offer),
    domain_bindings: Array.isArray(p.domainBindings) ? p.domainBindings.map(mapPresellBindingDto) : undefined,
    settings: {} as Record<string, unknown>,
    tracking: {} as Record<string, unknown>,
    created_at: p.createdAt?.toISOString?.() || String(p.createdAt),
    updated_at: p.updatedAt?.toISOString?.() || String(p.updatedAt),
  };
}

function mapPresell(
  p: PresellPage & {
    offer?: PresellOfferSummaryRow;
    domainBindings?: PresellBindingSummaryRow[];
  },
) {
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
    offer_id: p.offerId ?? null,
    offer: mapPresellOfferSummary(p.offer),
    domain_bindings: Array.isArray(p.domainBindings) ? p.domainBindings.map(mapPresellBindingDto) : undefined,
    settings: p.settings,
    tracking: p.tracking,
    compliance_gate: p.complianceGate ?? "unchecked",
    last_compliance_audit_at: p.lastComplianceAuditAt?.toISOString?.() ?? null,
    created_at: p.createdAt?.toISOString?.() || p.createdAt,
    updated_at: p.updatedAt?.toISOString?.() || p.updatedAt,
  };
}

type PresellPageWithOwnerPlan = Prisma.PresellPageGetPayload<{
  include: { user: { include: { subscription: { include: { plan: true } } } } };
}> & { offer?: LinkedOfferSnapshot | null };

/** Resposta pública: rodapé dclickora + white-label do tenant. */
/**
 * Presell não servida neste host. No domínio principal responde 404 sem cache e sem indexação:
 * a plataforma não hospeda presells públicas (só o dono vê preview autenticado).
 */
function sendPresellNotPublic(res: Response, reason: "main_host" | "host_mismatch", kind: "json" | "text") {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (kind === "text") return res.status(404).type("text/plain").send("Página não encontrada");
  return res.status(404).json(
    reason === "main_host"
      ? { error: "Página não encontrada", code: "PRESELL_NOT_PUBLIC_ON_MAIN_HOST" }
      : { error: "Página não encontrada" },
  );
}

async function sendPublicPresell(
  req: Request,
  res: Response,
  page: { id: string; userId: string; settings: unknown },
  mapped: Record<string, unknown>,
  opts: { ownerPreview?: boolean } = {},
) {
  /**
   * Mesma resposta para todos (humanos, AdsBot, Googlebot): sem «página segura» por país,
   * IP, User-Agent ou lista. Antifraude actua no hop `/track/r/` e nos relatórios.
   */
  const ip = extractClientIp(req);
  /** Só regista a visita; o resultado nunca altera o payload. */
  await enforceTrackingRules({
    ownerUserId: page.userId,
    presellPageId: page.id,
    ip,
    userAgent: req.headers["user-agent"] || "",
    headers: req.headers as Record<string, string | string[] | undefined>,
    channel: "public_page",
    recordedEventType: "other",
  });
  // Publicado OK: cache curto partilhável (CDN/browser); mesma resposta para qualquer visitante.
  if (opts.ownerPreview) {
    /** Domínio principal: preview privado do dono — nunca em cache partilhado, nunca indexável. */
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  } else {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  }
  return res.json(mapped);
}

/** Conteúdo público sem rascunho do editor nem métricas internas (JSON mais leve → TTFB). */
function slimPublicContent(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const c = { ...(raw as Record<string, unknown>) };
  delete c.editorWorkingDocument;
  delete c.editor_working_document;
  return c;
}

async function mapPresellForPublic(page: PresellPageWithOwnerPlan) {
  const plan = page.user?.subscription?.plan;
  const [branding, trackApiBase] = await Promise.all([
    systemPrisma.tenantBranding.findUnique({
      where: { userId: page.userId },
    }),
    preferredTrackApiBaseForUser(page.userId),
  ]);
  const footerBranding = resolvePublicFooterBranding({
    planHasBranding: plan?.hasBranding,
    hidePoweredBy: branding?.hidePoweredBy,
  });
  const base = mapPresell(page);
  const resolvedOffer = resolveEffectiveOfferForPresell({
    offer: page.offer ?? null,
    content: base.content,
    tracking: base.tracking,
  });
  const slimContent = slimPublicContent(base.content);
  const publicContent =
    slimContent && typeof slimContent === "object" && !Array.isArray(slimContent)
      ? {
          ...(slimContent as Record<string, unknown>),
          ...(resolvedOffer.ok
            ? { affiliateLink: resolvedOffer.destination }
            : page.offer
              ? { affiliateLink: "" }
              : {}),
        }
      : slimContent;
  return {
    ...base,
    settings: mergeAccountPixelsIntoSettings(base.settings, page.user),
    content: publicContent,
    /** Nome interno, hoplink de backup e bindings são privados do dono. */
    offer: undefined,
    offer_id: undefined,
    domain_bindings: undefined,
    clicks: undefined,
    impressions: undefined,
    conversions: undefined,
    compliance_gate: undefined,
    last_compliance_audit_at: undefined,
    footer_branding: footerBranding,
    /** Domínio de tracking da conta (go.) quando configurado — pixel/CTAs preferem este host. */
    track_api_base: trackApiBase,
    tenant_branding: branding
      ? {
          brand_name: isPublicSafeTenantBrandName(branding.brandName) ? branding.brandName : null,
          logo_url: branding.logoUrl,
          favicon_url: branding.faviconUrl,
          primary_color: branding.primaryColor,
          accent_color: branding.accentColor,
        }
      : null,
  };
}
