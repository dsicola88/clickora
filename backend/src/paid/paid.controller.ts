import type { Request, Response } from "express";
import { z } from "zod";

import { systemPrisma } from "../lib/prisma";
import * as mappers from "./api-mappers";
import { applyChangeRequestRemote } from "./change-request-apply";
import { ensurePaidAdsBootstrapForUser, ensurePaidAdsProjectRows } from "./bootstrap";
import { prisma } from "./paidPrisma";
import { canAccessProject, canAdminProject, canWriteProject, getPaidActor } from "./permissions";

const projectIdParam = z.object({ projectId: z.string().uuid() });

async function resolveDisplayName(tenantUserId: string): Promise<string> {
  const u = await systemPrisma.user.findUnique({
    where: { id: tenantUserId },
    select: { fullName: true, email: true },
  });
  const name = u?.fullName?.trim() || u?.email?.split("@")[0] || "Project";
  return name;
}

export const paidController = {
  async listProjects(req: Request, res: Response) {
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const name = await resolveDisplayName(a.tenantUserId);
    await ensurePaidAdsBootstrapForUser(a.tenantUserId, name);

    const rows = await prisma.paidAdsProject.findMany({
      where: { userId: a.tenantUserId },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return res.json({ projects: rows });
  },

  async getProject(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const p = await prisma.paidAdsProject.findFirst({
      where: {
        id: parsed.data.projectId,
        userId: a.tenantUserId,
      },
    });
    if (!p) return res.status(404).json({ error: "Projeto não encontrado." });
    if (!(await canAccessProject(p.id, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    return res.json({
      id: p.id,
      name: p.name,
      user_id: p.userId,
      organization_id: p.userId,
      paid_mode: p.paidMode,
    });
  },

  async getOverview(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const { projectId } = parsed.data;
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso ao projeto." });
    }

    const projRow = await prisma.paidAdsProject.findFirst({
      where: { id: projectId, userId: a.tenantUserId },
      select: { userId: true, paidMode: true },
    });
    if (!projRow) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    await ensurePaidAdsProjectRows(projectId, projRow.userId);

    const [conn, gr, pendingCount] = await Promise.all([
      prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } }),
      prisma.paidAdsGuardrails.findUnique({ where: { projectId } }),
      prisma.paidAdsChangeRequest.count({ where: { projectId, status: "pending" } }),
    ]);

    if (!conn || !gr) {
      return res.status(500).json({ error: "Dados do projeto incompletos. Contacte o suporte." });
    }

    return res.json({
      project: mappers.mapProjectMode(projRow),
      connection: mappers.mapGoogleAdsConnection(conn),
      guardrails: mappers.mapGuardrails(gr),
      pending_approvals: pendingCount,
    });
  },

  async listCampaigns(req: Request, res: Response) {
    const parsed = z
      .object({
        projectId: z.string().uuid(),
        platform: z.enum(["google_ads", "meta_ads", "tiktok_ads"]).optional(),
      })
      .safeParse({
        projectId: req.params.projectId,
        platform: req.query.platform as "google_ads" | "meta_ads" | "tiktok_ads" | undefined,
      });
    if (!parsed.success) return res.status(400).json({ error: "Parâmetros inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso ao projeto." });
    }
    const rows = await prisma.paidAdsCampaign.findMany({
      where: {
        projectId: parsed.data.projectId,
        ...(parsed.data.platform ? { platform: parsed.data.platform } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ campaigns: rows.map(mappers.mapPaidCampaign) });
  },

  async listChangeRequests(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    const rows = await prisma.paidAdsChangeRequest.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ change_requests: rows.map(mappers.mapChangeRequest) });
  },

  async reviewChangeRequest(req: Request, res: Response) {
    const body = z
      .object({ id: z.string().uuid(), status: z.enum(["approved", "rejected", "applied"]) })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Dados inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });

    const cr = await prisma.paidAdsChangeRequest.findFirst({
      where: { id: body.data.id, project: { userId: a.tenantUserId } },
      include: { project: true },
    });
    if (!cr) return res.status(404).json({ error: "Pedido não encontrado." });
    if (!(await canAdminProject(cr.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para revisar." });
    }

    const now = new Date();
    if (body.data.status === "applied") {
      const out = await applyChangeRequestRemote(cr.projectId, cr.type, cr.payload);
      if (!out.ok) {
        await prisma.paidAdsChangeRequest.update({
          where: { id: cr.id },
          data: {
            status: "failed",
            errorMessage: out.error,
            reviewedById: a.userId,
            reviewedAt: now,
          },
        });
        return res.status(400).json({ error: out.error });
      }
      await prisma.paidAdsChangeRequest.update({
        where: { id: cr.id },
        data: {
          status: "applied",
          reviewedById: a.userId,
          reviewedAt: now,
          appliedAt: now,
          errorMessage: null,
        },
      });
      return res.json({ ok: true });
    }

    await prisma.paidAdsChangeRequest.update({
      where: { id: cr.id },
      data: {
        status: body.data.status,
        reviewedById: a.userId,
        reviewedAt: now,
      },
    });
    return res.json({ ok: true });
  },

  async getMetaConnection(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    const c = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId: parsed.data.projectId } });
    return res.json(c ? mappers.mapMetaConnection(c) : null);
  },

  async getTikTokConnection(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    let c = await prisma.paidAdsTikTokConnection.findUnique({ where: { projectId: parsed.data.projectId } });
    if (!c) {
      const p = await prisma.paidAdsProject.findFirst({
        where: { id: parsed.data.projectId, userId: a.tenantUserId },
        select: { id: true, userId: true },
      });
      if (!p) return res.status(404).json({ error: "Projeto não encontrado." });
      c = await prisma.paidAdsTikTokConnection.create({
        data: { userId: p.userId, projectId: p.id, status: "disconnected" },
      });
    }
    return res.json(mappers.mapTikTokConnection(c));
  },

  async getMetaOverviewCounts(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    const projectId = parsed.data.projectId;
    const [campaigns, drafts, pending, campaignIds] = await Promise.all([
      prisma.paidAdsCampaign.count({ where: { projectId, platform: "meta_ads" } }),
      prisma.paidAdsCampaign.count({ where: { projectId, platform: "meta_ads", status: "draft" } }),
      prisma.paidAdsChangeRequest.count({
        where: { projectId, status: "pending", type: "meta_create_campaign" },
      }),
      prisma.paidAdsCampaign.findMany({ where: { projectId, platform: "meta_ads" }, select: { id: true } }),
    ]);
    const ids = campaignIds.map((c) => c.id);
    let creatives = 0;
    if (ids.length) {
      const adsets = await prisma.paidAdsMetaAdset.findMany({
        where: { campaignId: { in: ids } },
        select: { id: true },
      });
      const adsetIds = adsets.map((x) => x.id);
      if (adsetIds.length) {
        creatives = await prisma.paidAdsMetaCreative.count({ where: { adsetId: { in: adsetIds } } });
      }
    }
    return res.json({ campaigns, drafts, pending, creatives });
  },

  async getTikTokOverviewCounts(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    const projectId = parsed.data.projectId;
    const [campaigns, drafts, pending] = await Promise.all([
      prisma.paidAdsCampaign.count({ where: { projectId, platform: "tiktok_ads" } }),
      prisma.paidAdsCampaign.count({ where: { projectId, platform: "tiktok_ads", status: "draft" } }),
      prisma.paidAdsChangeRequest.count({
        where: { projectId, status: "pending", type: "tiktok_create_campaign" },
      }),
    ]);
    return res.json({ campaigns, drafts, pending });
  },

  async updateProjectPaidMode(req: Request, res: Response) {
    const parsed = z
      .object({ projectId: z.string().uuid(), paidMode: z.enum(["copilot", "autopilot"]) })
      .safeParse({ projectId: req.params.projectId, paidMode: (req.body as { paidMode?: string }).paidMode });
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para alterar o modo." });
    }
    await prisma.paidAdsProject.update({
      where: { id: parsed.data.projectId },
      data: { paidMode: parsed.data.paidMode },
    });
    return res.json({ ok: true });
  },

  async upsertGuardrails(req: Request, res: Response) {
    const schema = z.object({
      projectId: z.string().uuid(),
      max_daily_budget_micros: z.number(),
      max_monthly_spend_micros: z.number(),
      max_cpc_micros: z.number().nullable(),
      allowed_countries: z.array(z.string()),
      blocked_keywords: z.array(z.string()),
      require_approval_above_micros: z.number().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAdminProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Somente administradores podem editar guardrails." });
    }
    const d = parsed.data;
    const g = await prisma.paidAdsGuardrails.upsert({
      where: { projectId: d.projectId },
      create: {
        projectId: d.projectId,
        maxDailyBudgetMicros: BigInt(Math.round(d.max_daily_budget_micros)),
        maxMonthlySpendMicros: BigInt(Math.round(d.max_monthly_spend_micros)),
        maxCpcMicros: d.max_cpc_micros != null ? BigInt(Math.round(d.max_cpc_micros)) : null,
        allowedCountries: d.allowed_countries,
        blockedKeywords: d.blocked_keywords,
        requireApprovalAboveMicros:
          d.require_approval_above_micros != null ? BigInt(Math.round(d.require_approval_above_micros)) : null,
      },
      update: {
        maxDailyBudgetMicros: BigInt(Math.round(d.max_daily_budget_micros)),
        maxMonthlySpendMicros: BigInt(Math.round(d.max_monthly_spend_micros)),
        maxCpcMicros: d.max_cpc_micros != null ? BigInt(Math.round(d.max_cpc_micros)) : null,
        allowedCountries: d.allowed_countries,
        blockedKeywords: d.blocked_keywords,
        requireApprovalAboveMicros:
          d.require_approval_above_micros != null ? BigInt(Math.round(d.require_approval_above_micros)) : null,
      },
    });
    return res.json(mappers.mapGuardrails(g));
  },

  async listAiRuns(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso." });
    }
    const rows = await prisma.paidAdsAiRun.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({ ai_runs: rows.map(mappers.mapAiRun) });
  },
};
