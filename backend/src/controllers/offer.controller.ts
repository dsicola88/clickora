import { Request, Response } from "express";
import { z } from "zod";
import prisma, { systemPrisma } from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { denyIfCannotWritePresells } from "./workspace.controller";
import { validateOfferSafety } from "../lib/offerValidation";
import {
  syncOfferDomainBindings,
  syncOfferHoplinkToLinkedPresells,
  validateAndPersistOffer,
} from "../lib/offerService";
import { recordDomainRoutingEvent } from "../lib/domainRoutingService";
import { backfillAccountOffersAndDomainBindings } from "../lib/offerDomainBackfill";
import { appendWorkspaceAuditLog } from "../lib/workspaceAudit";

const bindingItemSchema = z.object({
  custom_domain_id: z.string().uuid(),
  role: z.enum(["primary", "backup", "standby"]).default("backup"),
  priority: z.number().int().min(1).max(10_000).optional(),
  is_active: z.boolean().optional(),
});

const createOfferSchema = z.object({
  name: z.string().trim().min(1).max(200),
  network: z.string().trim().max(64).optional().nullable(),
  hoplink_url: z.string().trim().url().max(4000),
  backup_hoplink_url: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.string().trim().url().max(4000).nullable().optional(),
  ),
  is_active: z.boolean().optional(),
  run_probe: z.boolean().optional(),
  domain_bindings: z.array(bindingItemSchema).max(50).optional(),
});

const updateOfferSchema = createOfferSchema.partial();

const putDomainsSchema = z.object({
  bindings: z.array(bindingItemSchema).max(50),
});

function mapOfferRow(o: {
  id: string;
  name: string;
  network: string | null;
  hoplinkUrl: string;
  backupHoplinkUrl: string | null;
  validationStatus: string;
  compliancePassed: boolean;
  lastValidatedAt: Date | null;
  lastValidationError: string | null;
  resolvedFinalHost: string | null;
  isActive: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count?: { presellPages?: number; affiliateCampaigns?: number };
  domainBindings?: Array<{
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
      healthStatus: string;
      isActive: boolean;
    };
  }>;
}) {
  return {
    id: o.id,
    name: o.name,
    network: o.network,
    hoplink_url: o.hoplinkUrl,
    backup_hoplink_url: o.backupHoplinkUrl,
    validation_status: o.validationStatus,
    compliance_passed: o.compliancePassed,
    last_validated_at: o.lastValidatedAt?.toISOString() ?? null,
    last_validation_error: o.lastValidationError,
    resolved_final_host: o.resolvedFinalHost,
    is_active: o.isActive,
    metadata: o.metadata ?? null,
    presells_count: o._count?.presellPages ?? undefined,
    campaigns_count: o._count?.affiliateCampaigns ?? undefined,
    domain_bindings: o.domainBindings
      ? o.domainBindings.map((b) => ({
          id: b.id,
          custom_domain_id: b.customDomainId,
          role: b.role,
          priority: b.priority,
          is_active: b.isActive,
          hostname: b.customDomain?.hostname ?? null,
          domain_status: b.customDomain?.status ?? null,
          domain_health_status: b.customDomain?.healthStatus ?? null,
          domain_is_active: b.customDomain?.isActive ?? null,
        }))
      : undefined,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  };
}

export const offerController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const rows = await prisma.offer.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { presellPages: true, affiliateCampaigns: true } },
        domainBindings: {
          orderBy: { priority: "asc" },
          include: {
            customDomain: {
              select: { id: true, hostname: true, status: true, purpose: true, healthStatus: true, isActive: true },
            },
          },
        },
      },
    });
    return res.json(rows.map(mapOfferRow));
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    const row = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      include: {
        _count: { select: { presellPages: true, affiliateCampaigns: true } },
        domainBindings: {
          orderBy: { priority: "asc" },
          include: {
            customDomain: {
              select: { id: true, hostname: true, status: true, purpose: true, healthStatus: true, isActive: true },
            },
          },
        },
        presellPages: {
          select: { id: true, title: true, slug: true, status: true, customDomainId: true },
        },
        affiliateCampaigns: {
          select: { id: true, name: true, status: true, trafficSource: true },
        },
      },
    });
    if (!row) return res.status(404).json({ error: "Oferta não encontrada." });
    return res.json({
      ...mapOfferRow(row),
      presells: row.presellPages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        custom_domain_id: p.customDomainId,
      })),
      campaigns: row.affiliateCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        traffic_source: c.trafficSource,
      })),
    });
  },

  async create(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const actorUserId = req.user?.userId ?? userId;
    const d = parsed.data;

    const safety = validateOfferSafety({
      hoplinkUrl: d.hoplink_url,
      backupHoplinkUrl: d.backup_hoplink_url,
      network: d.network,
    });
    if (!safety.ok) {
      return res.status(400).json({
        error: safety.issues[0]?.message || "URL de oferta não passou na validação de segurança.",
        issues: safety.issues,
      });
    }

    const created = await systemPrisma.offer.create({
      data: {
        userId,
        name: d.name,
        network: d.network?.trim() || safety.detectedNetwork,
        hoplinkUrl: d.hoplink_url,
        backupHoplinkUrl: d.backup_hoplink_url ?? null,
        validationStatus: "valid",
        compliancePassed: true,
        lastValidatedAt: new Date(),
        resolvedFinalHost: (() => {
          try {
            return new URL(d.hoplink_url).hostname.toLowerCase();
          } catch {
            return null;
          }
        })(),
        isActive: d.is_active ?? true,
      },
    });

    if (d.domain_bindings && d.domain_bindings.length > 0) {
      try {
        await syncOfferDomainBindings({
          userId,
          offerId: created.id,
          bindings: d.domain_bindings.map((b) => ({
            customDomainId: b.custom_domain_id,
            role: b.role,
            priority: b.priority,
            isActive: b.is_active,
          })),
          actorUserId,
          workspaceId: req.user?.workspaceId,
        });
      } catch (err) {
        await systemPrisma.offer.delete({ where: { id: created.id } }).catch(() => undefined);
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Domínios associados inválidos.",
        });
      }
    }

    let finalOffer = created;
    if (d.run_probe) {
      finalOffer = await validateAndPersistOffer({
        offerId: created.id,
        userId,
        actorUserId,
      });
    } else {
      await recordDomainRoutingEvent({
        userId,
        eventType: "offer_validated",
        scope: "offer",
        offerId: created.id,
        actorUserId,
        reason: "Oferta criada e validada na camada estática.",
      });
    }

    if (req.user?.workspaceId) {
      await appendWorkspaceAuditLog({
        workspaceId: req.user.workspaceId,
        actorUserId,
        action: "offer.create",
        resourceType: "offer",
        resourceId: finalOffer.id,
        metadata: { name: finalOffer.name, network: finalOffer.network },
      });
    }

    const withRel = await prisma.offer.findFirst({
      where: { id: finalOffer.id, userId },
      include: {
        _count: { select: { presellPages: true, affiliateCampaigns: true } },
        domainBindings: {
          orderBy: { priority: "asc" },
          include: {
            customDomain: {
              select: { id: true, hostname: true, status: true, purpose: true, healthStatus: true, isActive: true },
            },
          },
        },
      },
    });

    return res.status(201).json(mapOfferRow(withRel ?? finalOffer));
  },

  async update(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = updateOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const actorUserId = req.user?.userId ?? userId;
    const existing = await prisma.offer.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: "Oferta não encontrada." });

    const d = parsed.data;
    const nextHoplink = d.hoplink_url ?? existing.hoplinkUrl;
    const nextBackup = d.backup_hoplink_url !== undefined ? d.backup_hoplink_url : existing.backupHoplinkUrl;
    const nextNetwork = d.network !== undefined ? d.network : existing.network;

    const hoplinkChanged = d.hoplink_url !== undefined && d.hoplink_url !== existing.hoplinkUrl;
    const backupChanged =
      d.backup_hoplink_url !== undefined && (d.backup_hoplink_url ?? null) !== (existing.backupHoplinkUrl ?? null);

    // Só valida URLs alteradas: ofertas importadas de presells antigas (status `unchecked`) continuam
    // editáveis (nome, rede, pausa) sem exigir que o hoplink legado passe nas heurísticas novas.
    const safety = validateOfferSafety({
      hoplinkUrl: nextHoplink,
      backupHoplinkUrl: backupChanged ? nextBackup : null,
      network: nextNetwork,
    });
    const blockingIssues = safety.issues.filter(
      (i) => (i.field === "hoplinkUrl" && hoplinkChanged) || (i.field === "backupHoplinkUrl" && backupChanged),
    );
    if (blockingIssues.length > 0) {
      return res.status(400).json({
        error: blockingIssues[0]?.message || "URL de oferta inválido ou bloqueado por segurança.",
        issues: blockingIssues,
      });
    }

    const updated = await systemPrisma.offer.update({
      where: { id: existing.id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.network !== undefined ? { network: d.network?.trim() || safety.detectedNetwork } : {}),
        ...(d.hoplink_url !== undefined ? { hoplinkUrl: d.hoplink_url } : {}),
        ...(d.backup_hoplink_url !== undefined ? { backupHoplinkUrl: d.backup_hoplink_url } : {}),
        ...(d.is_active !== undefined ? { isActive: d.is_active } : {}),
        ...(hoplinkChanged
          ? {
              validationStatus: "valid",
              compliancePassed: true,
              lastValidatedAt: new Date(),
              lastValidationError: null,
            }
          : {}),
      },
    });

    if (d.domain_bindings !== undefined) {
      try {
        await syncOfferDomainBindings({
          userId,
          offerId: updated.id,
          bindings: d.domain_bindings.map((b) => ({
            customDomainId: b.custom_domain_id,
            role: b.role,
            priority: b.priority,
            isActive: b.is_active,
          })),
          actorUserId,
          workspaceId: req.user?.workspaceId,
        });
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Domínios associados inválidos.",
        });
      }
    }

    let propagatedPresells: string[] = [];
    if (hoplinkChanged) {
      propagatedPresells = await syncOfferHoplinkToLinkedPresells({
        userId,
        offerId: updated.id,
        hoplinkUrl: updated.hoplinkUrl,
      });
    } else if (d.is_active !== undefined && d.is_active !== existing.isActive) {
      const linked = await systemPrisma.presellPage.findMany({
        where: { userId, offerId: updated.id },
        select: { id: true },
      });
      const { invalidateTrackEdgeDest } = await import("../lib/trackEdgeDestCache");
      for (const p of linked) void invalidateTrackEdgeDest(p.id);
    }

    let finalOffer = updated;
    if (d.run_probe) {
      finalOffer = await validateAndPersistOffer({
        offerId: updated.id,
        userId,
        actorUserId,
      });
    }

    if (req.user?.workspaceId) {
      await appendWorkspaceAuditLog({
        workspaceId: req.user.workspaceId,
        actorUserId,
        action: "offer.update",
        resourceType: "offer",
        resourceId: finalOffer.id,
        metadata: {
          hoplink_changed: hoplinkChanged,
          propagated_presells_count: propagatedPresells.length,
        },
      });
    }

    const withRel = await prisma.offer.findFirst({
      where: { id: finalOffer.id, userId },
      include: {
        _count: { select: { presellPages: true, affiliateCampaigns: true } },
        domainBindings: {
          orderBy: { priority: "asc" },
          include: {
            customDomain: {
              select: { id: true, hostname: true, status: true, purpose: true, healthStatus: true, isActive: true },
            },
          },
        },
      },
    });

    return res.json({
      ...mapOfferRow(withRel ?? finalOffer),
      propagated_presell_ids: propagatedPresells,
    });
  },

  async validate(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const actorUserId = req.user?.userId ?? userId;
    const skipProbe = req.body?.skip_probe === true;
    try {
      const updated = await validateAndPersistOffer({
        offerId: req.params.id,
        userId,
        actorUserId,
        skipNetworkProbe: skipProbe,
      });
      return res.json(mapOfferRow(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao validar oferta.";
      return res.status(msg.includes("não encontrada") ? 404 : 400).json({ error: msg });
    }
  },

  async putDomains(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = putDomainsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const actorUserId = req.user?.userId ?? userId;
    try {
      await syncOfferDomainBindings({
        userId,
        offerId: req.params.id,
        bindings: parsed.data.bindings.map((b) => ({
          customDomainId: b.custom_domain_id,
          role: b.role,
          priority: b.priority,
          isActive: b.is_active,
        })),
        actorUserId,
        workspaceId: req.user?.workspaceId,
      });
      const updated = await prisma.offer.findFirst({
        where: { id: req.params.id, userId },
        include: {
          _count: { select: { presellPages: true, affiliateCampaigns: true } },
          domainBindings: {
            orderBy: { priority: "asc" },
            include: {
              customDomain: {
                select: { id: true, hostname: true, status: true, purpose: true, healthStatus: true, isActive: true },
              },
            },
          },
        },
      });
      if (!updated) return res.status(404).json({ error: "Oferta não encontrada." });
      return res.json(mapOfferRow(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar domínios da oferta.";
      return res.status(msg.includes("não encontrada") ? 404 : 400).json({ error: msg });
    }
  },

  async events(req: Request, res: Response) {
    const userId = billingUserId(req);
    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!offer) return res.status(404).json({ error: "Oferta não encontrada." });
    const rows = await prisma.domainRoutingEvent.findMany({
      where: { userId, offerId: offer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json(
      rows.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        scope: e.scope,
        custom_domain_id: e.customDomainId,
        previous_domain_id: e.previousDomainId,
        target_domain_id: e.targetDomainId,
        presell_id: e.presellId,
        offer_id: e.offerId,
        actor_user_id: e.actorUserId,
        reason: e.reason,
        metadata: e.metadata ?? null,
        created_at: e.createdAt.toISOString(),
      })),
    );
  },

  async backfill(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const summary = await backfillAccountOffersAndDomainBindings(userId);
    return res.json({ ok: true, ...summary });
  },

  async remove(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const existing = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, name: true },
    });
    if (!existing) return res.status(404).json({ error: "Oferta não encontrada." });

    const linkedPages = await systemPrisma.presellPage.findMany({
      where: { userId, offerId: existing.id },
      select: { id: true },
    });
    await systemPrisma.offer.delete({ where: { id: existing.id } });
    const { invalidateTrackEdgeDest } = await import("../lib/trackEdgeDestCache");
    for (const p of linkedPages) void invalidateTrackEdgeDest(p.id);

    if (req.user?.workspaceId) {
      await appendWorkspaceAuditLog({
        workspaceId: req.user.workspaceId,
        actorUserId: req.user.userId,
        action: "offer.delete",
        resourceType: "offer",
        resourceId: existing.id,
        metadata: { name: existing.name },
      });
    }
    return res.json({ ok: true });
  },
};
