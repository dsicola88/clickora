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
  isMainOrPreviewHostname,
  resolveVerifiedOwnerUserIdFromDb,
} from "../lib/presellHostAccess";
import { getRequestHostname, hostnameLookupVariants } from "../lib/requestHost";
import { getVerifiedOwnerIdForHostname } from "../lib/customDomainCache";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { importPresellFromProductUrl } from "../lib/presellImporter";
import { mergeAccountPixelsIntoSettings } from "../lib/accountPixelsMerge";
import { billingUserId } from "../lib/requestContext";
import { denyIfCannotWritePresells } from "./workspace.controller";
import {
  buildCloakSafePublicPayload,
  shouldServeCloakSafePage,
} from "../lib/presellEnterpriseCloak";
import { enforceTrackingRules } from "../lib/trackGuard";
import { preferredTrackApiBaseForUser } from "../lib/publicApiBase";
import { extractClientIp } from "../lib/clientIp";
import { reconcileMirrorInPresellContent } from "../lib/presellMirrorRehost";
import { sanitizeMirrorInContentRecord } from "../lib/presellMirrorSanitizeContent";
import { assertPublishAllowed } from "../compliance/service";
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

export const presellController = {
  async getPublicById(req: Request, res: Response) {
    const id = req.params.id;
    /** Rota pública sem JWT / ALS — usar systemPrisma com filtro explícito por id. */
    const page = await systemPrisma.presellPage.findFirst({
      where: { id },
      include: { user: { include: { subscription: { include: { plan: true } } } } },
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

    const mapped = await mapPresellForPublic(page);
    return sendPublicPresell(req, res, page, mapped);
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
      include: { user: { include: { subscription: { include: { plan: true } } } } },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const access = evaluateSubscriptionAccess(page.user.subscription);
    if (!access.allowed) return res.status(403).json({ error: "Página indisponível." });

    const mapped = await mapPresellForPublic(page);
    return sendPublicPresell(req, res, page, mapped);
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
      select: { id: true, rootPresellId: true, purpose: true },
    });
    if (!cd) {
      return res.status(404).json({ error: "Domínio não encontrado.", code: "ROOT_PRESELL_NO_DOMAIN" });
    }

    if (cd.purpose === "tracking") {
      return res.status(200).json({
        id: null,
        purpose: "tracking",
        code: "TRACKING_DOMAIN_ROOT",
        message:
          "Este hostname é só de tracking. Use /api/track/… neste domínio; a lander fica no domínio de hosting.",
      });
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
    if (!userId || !filename || !isSafeBuilderMediaFilename(filename)) {
      return res.status(404).end();
    }
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
      return res.sendFile(resolvedFile);
    }
    if (isR2Configured()) {
      return res.redirect(302, r2PublicUrl(builderMediaObjectKey(userId, filename)));
    }
    return res.status(404).end();
  },

  async getAll(req: Request, res: Response) {
    /** Sem `content` na lista — JSON gigante por página fazia GET lento e 502 no proxy; detalhe em GET /:id. */
    const pages = await prisma.presellPage.findMany({
      where: { userId: billingUserId(req) },
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
      where: { id: req.params.id, userId: billingUserId(req) },
    });

    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    res.json(mapPresell(page));
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

      const [count, sub, operatorUser] = await timedCreateStage("03_parallel_domain_quota_identity", async () => {
        const [c, s, op] = await Promise.all([
          prisma.presellPage.count({ where: { userId } }),
          prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true },
          }),
          loadUserOperatorIdentity(userId),
          domainPromise,
        ]).then(([c, s, op]) => [c, s, op] as const);
        return [c, s, op] as const;
      });

      if (domainError) {
        return res.status(400).json({ error: domainError });
      }

      if (sub?.plan.maxPresellPages != null && count >= sub.plan.maxPresellPages) {
        return res.status(403).json({ error: `Limite de ${sub.plan.maxPresellPages} páginas atingido. Faça upgrade do seu plano.` });
      }

      let page: PresellPage;
      try {
        let contentPayload: Record<string, unknown> =
          parsed.data.content && typeof parsed.data.content === "object" && !Array.isArray(parsed.data.content)
            ? (parsed.data.content as Record<string, unknown>)
            : {};

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
          settings: settingsRecord(parsed.data.settings),
          content: contentPayload,
          user: operatorUser ?? {},
        });
        recordCreateStage("06_enrich_identity", Date.now() - tIdent);
        const settingsPayload = identityEnriched.settings;

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
              tracking: (parsed.data.tracking || {}) as Prisma.InputJsonValue,
              status: "draft",
              complianceGate: "unchecked",
              ...customDomainIdField,
            },
          }),
        );

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

    // Conteúdo/destino alterado invalida a gate até nova auditoria.
    if (
      nextContent ||
      req.body.settings ||
      req.body.title ||
      req.body.tracking ||
      req.body.video_url !== undefined
    ) {
      data.complianceGate = "unchecked";
      data.contentFingerprint = null;
    }

    let updated = await systemPrisma.presellPage.update({
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
      // Já publicada: reauditoria após conteúdo/settings (exceto builder — fica no ar de imediato).
      // Não pausar em surpresa: derruba a URL do anúncio. Avisamos; o toggle published→ continua a gate.
      page.status === "published" &&
      (nextContent || req.body.settings || req.body.title || req.body.video_url !== undefined)
    ) {
      const gate = await assertPublishAllowed({ page: updated, runIfStale: true });
      if (!gate.ok) {
        return res.status(200).json({
          ...mapPresell(updated),
          compliance_blocked: true,
          compliance: gate.body,
          message:
            "Alterações guardadas. A página continua publicada, mas há avisos de conformidade — reveja antes de escalar anúncios.",
        });
      }
    }

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
    res.json({ message: "Página removida" });
  },

  async duplicate(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId: billingUserId(req) },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    let copy: PresellPage;
    try {
      copy = await prisma.presellPage.create({
        data: {
          userId: billingUserId(req),
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
        return res.status(gate.status).json(gate.body);
      }
    }

    const updated = await systemPrisma.presellPage.update({
      where: { id: pageForPublish.id },
      data: { status },
    });

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
    compliance_gate: p.complianceGate ?? "unchecked",
    last_compliance_audit_at: p.lastComplianceAuditAt?.toISOString?.() ?? null,
    created_at: p.createdAt?.toISOString?.() || p.createdAt,
    updated_at: p.updatedAt?.toISOString?.() || p.updatedAt,
  };
}

type PresellPageWithOwnerPlan = Prisma.PresellPageGetPayload<{
  include: { user: { include: { subscription: { include: { plan: true } } } } };
}>;

/** Resposta pública: rodapé dclickora + white-label do tenant. */
async function sendPublicPresell(
  req: Request,
  res: Response,
  page: { id: string; userId: string; settings: unknown },
  mapped: Record<string, unknown>,
) {
  const geo = shouldServeCloakSafePage(req, page.settings);
  if (geo.cloak) {
    console.info("[presell.public] página segura", { id: page.id, reason: geo.reason });
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(buildCloakSafePublicPayload({ base: mapped, settingsRaw: page.settings, reason: geo.reason }));
  }
  const ip = extractClientIp(req);
  /**
   * Bloqueios automáticos de datacenter/cloud foram removidos.
   * Só entram regras que o afiliado configurou (geo cloak, blacklist/whitelist manual, bots/proxy opt-in).
   */
  const guard = await enforceTrackingRules({
    ownerUserId: page.userId,
    presellPageId: page.id,
    ip,
    userAgent: req.headers["user-agent"] || "",
    headers: req.headers as Record<string, string | string[] | undefined>,
    channel: "public_page",
    recordedEventType: "other",
  });
  if (!guard.ok) {
    console.info("[presell.public] página segura", { id: page.id, reason: guard.reason });
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(buildCloakSafePublicPayload({ base: mapped, settingsRaw: page.settings, reason: guard.reason }));
  }
  // Publicado OK: cache curto partilhável (CDN/browser) — cloak/guard já filtraram.
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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
  const hidePlatform = branding?.hidePoweredBy === true && plan?.hasBranding === false;
  const footerBranding = hidePlatform ? false : (plan?.hasBranding ?? true);
  const base = mapPresell(page);
  return {
    ...base,
    settings: mergeAccountPixelsIntoSettings(base.settings, page.user),
    content: slimPublicContent(base.content),
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
          brand_name: branding.brandName,
          logo_url: branding.logoUrl,
          favicon_url: branding.faviconUrl,
          primary_color: branding.primaryColor,
          accent_color: branding.accentColor,
        }
      : null,
  };
}
