import type { Request, Response } from "express";
import path from "path";
import { z } from "zod";

import { systemPrisma } from "../lib/prisma";
import * as mappers from "./api-mappers";
import { workspaceAllowsApplyBeforeRemote } from "./apply-workspace-guard";
import { applyChangeRequestRemote } from "./change-request-apply";
import { intersectGeoTargetsWithAllowedCountries } from "./guardrails-eval";
import { ensurePaidAdsBootstrapForUser, ensurePaidAdsProjectRows } from "./bootstrap";
import { prisma } from "./paidPrisma";
import { googleCampaignPlanInputSchema, runGoogleCampaignPlan } from "./google-campaign-plan";
import { metaCampaignPlanInputSchema, runMetaCampaignPlan } from "./meta-campaign-plan";
import { reconcileProjectCampaigns } from "./reconcile-campaigns";
import { runTiktokCampaignPlan, tiktokCampaignPlanInputSchema } from "./tiktok-campaign-plan";
import { canAccessProject, canAdminProject, canWriteProject, getPaidActor } from "./permissions";

const projectIdParam = z.object({ projectId: z.string().uuid() });

function parseGeoTargetsJson(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x).trim()).filter(Boolean);
}

/** Campanhas geradas sem chamada ao modelo usam `fallback/deterministic` no registo AI. */
function planSourceFromModel(model: string): "llm" | "deterministic" {
  return model.startsWith("fallback/") ? "deterministic" : "llm";
}

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
    const campaignStatus = z.enum([
      "draft",
      "pending_publish",
      "live",
      "paused",
      "archived",
      "error",
    ]);
    const parsed = z
      .object({
        projectId: z.string().uuid(),
        platform: z.enum(["google_ads", "meta_ads", "tiktok_ads"]).optional(),
        status: campaignStatus.optional(),
      })
      .safeParse({
        projectId: req.params.projectId,
        platform: req.query.platform as "google_ads" | "meta_ads" | "tiktok_ads" | undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
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
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ campaigns: rows.map(mappers.mapPaidCampaign) });
  },

  /**
   * Histórico do motor automático (pausa, escala, flags) — auditoria enterprise.
   * Query: `limit` (1–200, predef. 50), `offset` (paginação).
   */
  async listOptimizerDecisions(req: Request, res: Response) {
    const parsed = z
      .object({
        projectId: z.string().uuid(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        offset: z.coerce.number().int().min(0).max(50_000).optional(),
      })
      .safeParse({
        projectId: req.params.projectId,
        limit: req.query.limit,
        offset: req.query.offset,
      });
    if (!parsed.success) return res.status(400).json({ error: "Parâmetros inválidos." });
    const { projectId } = parsed.data;
    const limit = parsed.data.limit ?? 50;
    const offset = parsed.data.offset ?? 0;

    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAccessProject(projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem acesso ao projeto." });
    }

    const [decisions, total] = await Promise.all([
      prisma.paidAdsOptimizerDecision.findMany({
        where: { projectId },
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.paidAdsOptimizerDecision.count({ where: { projectId } }),
    ]);

    return res.json({
      decisions: decisions.map((row) => mappers.mapOptimizerDecision(row)),
      pagination: { limit, offset, total },
    });
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
      if (cr.status === "applied") {
        return res.json({ ok: true });
      }
      if (cr.status !== "pending" && cr.status !== "approved" && cr.status !== "failed") {
        return res.status(400).json({ error: "Só é possível aplicar pedidos pendentes, aprovados ou falhados (nova tentativa)." });
      }
      const pre = await workspaceAllowsApplyBeforeRemote(cr.projectId, cr.type, cr.payload);
      if (!pre.ok) {
        return res.status(400).json({ error: pre.message });
      }
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
      optimizer_pause_spend_usd: z.number().positive().max(1_000_000).nullable().optional(),
      optimizer_pause_min_clicks: z.number().int().min(0).max(500).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canAdminProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Somente administradores podem editar guardrails." });
    }
    const d = parsed.data;
    const optSpendUsd =
      d.optimizer_pause_spend_usd !== undefined
        ? (d.optimizer_pause_spend_usd != null ? d.optimizer_pause_spend_usd : null)
        : undefined;
    const optPauseClicks =
      d.optimizer_pause_min_clicks !== undefined
        ? (d.optimizer_pause_min_clicks != null ? d.optimizer_pause_min_clicks : null)
        : undefined;
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
        ...(optSpendUsd !== undefined ? { optimizerPauseSpendUsd: optSpendUsd } : {}),
        ...(optPauseClicks !== undefined ? { optimizerPauseMinClicks: optPauseClicks } : {}),
      },
      update: {
        maxDailyBudgetMicros: BigInt(Math.round(d.max_daily_budget_micros)),
        maxMonthlySpendMicros: BigInt(Math.round(d.max_monthly_spend_micros)),
        maxCpcMicros: d.max_cpc_micros != null ? BigInt(Math.round(d.max_cpc_micros)) : null,
        allowedCountries: d.allowed_countries,
        blockedKeywords: d.blocked_keywords,
        requireApprovalAboveMicros:
          d.require_approval_above_micros != null ? BigInt(Math.round(d.require_approval_above_micros)) : null,
        ...(optSpendUsd !== undefined ? { optimizerPauseSpendUsd: optSpendUsd } : {}),
        ...(optPauseClicks !== undefined ? { optimizerPauseMinClicks: optPauseClicks } : {}),
      },
    });
    return res.json(mappers.mapGuardrails(g));
  },

  async googleCampaignPlan(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const body = googleCampaignPlanInputSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: body.error.flatten() });
    }
    const out = await runGoogleCampaignPlan(parsed.data.projectId, body.data, a);
    if (!out.ok) return res.status(400).json({ error: out.error });
    return res.json({
      ok: true,
      campaignId: out.campaignId,
      model: out.model,
      planSource: planSourceFromModel(out.model),
      autoApplied: out.autoApplied,
      reasons: out.reasons,
    });
  },

  async metaCampaignPlan(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const body = metaCampaignPlanInputSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: body.error.flatten() });
    }
    const out = await runMetaCampaignPlan(parsed.data.projectId, body.data, a);
    if (!out.ok) return res.status(400).json({ error: out.error });
    return res.json({
      ok: true,
      campaignId: out.campaignId,
      model: out.model,
      planSource: planSourceFromModel(out.model),
      autoApplied: out.autoApplied,
      reasons: out.reasons,
    });
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

  async uploadMetaAsset(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para carregar ficheiros neste projecto." });
    }
    const f = (req as Request & { file?: Express.Multer.File }).file;
    if (!f?.filename) {
      return res.status(400).json({ error: "Ficheiro em falta (campo «file»)." });
    }
    const rel = path.posix.join(parsed.data.projectId, f.filename);
    return res.json({ path: rel });
  },

  async uploadTiktokAsset(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para carregar ficheiros neste projecto." });
    }
    const f = (req as Request & { file?: Express.Multer.File }).file;
    if (!f?.filename) {
      return res.status(400).json({ error: "Ficheiro em falta (campo «file»)." });
    }
    const rel = path.posix.join(parsed.data.projectId, f.filename);
    return res.json({ path: rel });
  },

  async tiktokCampaignPlan(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const body = tiktokCampaignPlanInputSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: body.error.flatten() });
    }
    const out = await runTiktokCampaignPlan(parsed.data.projectId, body.data, a);
    if (!out.ok) return res.status(400).json({ error: out.error });
    return res.json({
      ok: true,
      campaignId: out.campaignId,
      model: out.model,
      planSource: planSourceFromModel(out.model),
      autoApplied: out.autoApplied,
      reasons: out.reasons,
    });
  },

  /** Alinha o orçamento diário local da campanha ao teto dos guardrails (quando o actual o excede). Rascunho / pré-publicação. */
  async snapCampaignDailyBudgetToGuardrailCeiling(req: Request, res: Response) {
    const parsed = z
      .object({ projectId: z.string().uuid(), campaignId: z.string().uuid() })
      .safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Parâmetros inválidos." });
    const { projectId, campaignId } = parsed.data;
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para editar campanhas neste projecto." });
    }
    const gr = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
    if (!gr) {
      return res.status(400).json({ error: "Não há guardrails neste projecto; não há teto para alinhar o orçamento." });
    }
    const maxMicros = Number(gr.maxDailyBudgetMicros);
    const camp = await prisma.paidAdsCampaign.findFirst({
      where: { id: campaignId, projectId },
    });
    if (!camp) return res.status(404).json({ error: "Campanha não encontrada." });
    const cur = camp.dailyBudgetMicros != null ? Number(camp.dailyBudgetMicros) : 0;
    if (cur <= maxMicros) {
      return res.json({ campaign: mappers.mapPaidCampaign(camp), adjusted: false as const });
    }
    const updated = await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { dailyBudgetMicros: BigInt(maxMicros) },
    });
    return res.json({ campaign: mappers.mapPaidCampaign(updated), adjusted: true as const });
  },

  /** Remove da segmentação os países que não estão na lista permitida dos guardrails (mantém ordem dos permitidos). */
  async snapCampaignGeoTargetsToGuardrailAllowed(req: Request, res: Response) {
    const parsed = z
      .object({ projectId: z.string().uuid(), campaignId: z.string().uuid() })
      .safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Parâmetros inválidos." });
    const { projectId, campaignId } = parsed.data;
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para editar campanhas neste projecto." });
    }
    const gr = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
    if (!gr) {
      return res.status(400).json({ error: "Não há guardrails neste projecto." });
    }
    if (gr.allowedCountries.length === 0) {
      return res.status(400).json({ error: "Lista de países permitidos está vazia." });
    }
    const camp = await prisma.paidAdsCampaign.findFirst({
      where: { id: campaignId, projectId },
    });
    if (!camp) return res.status(404).json({ error: "Campanha não encontrada." });

    const beforeArr = parseGeoTargetsJson(camp.geoTargets);
    const afterArr = intersectGeoTargetsWithAllowedCountries(beforeArr, gr.allowedCountries);

    if (beforeArr.length > 0 && afterArr.length === 0) {
      return res.status(400).json({
        error:
          "Nenhum dos países actuais está na lista permitida. Alargue os guardrails em «Visão geral» ou defina destinos permitidos em «Campanhas».",
      });
    }

    function geoTargetsLooselyEqual(a: string[], b: string[]): boolean {
      if (a.length !== b.length) return false;
      return a.every(
        (x, i) => String(x).trim().toUpperCase() === String(b[i]).trim().toUpperCase(),
      );
    }
    if (geoTargetsLooselyEqual(beforeArr, afterArr)) {
      return res.json({ campaign: mappers.mapPaidCampaign(camp), adjusted: false as const });
    }

    const updated = await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { geoTargets: afterArr },
    });
    return res.json({ campaign: mappers.mapPaidCampaign(updated), adjusted: true as const });
  },

  async patchCampaignOptimizerLimits(req: Request, res: Response) {
    const parsed = z
      .object({
        projectId: z.string().uuid(),
        campaignId: z.string().uuid(),
        optimizer_pause_spend_usd: z.number().positive().max(1_000_000).nullable().optional(),
        optimizer_pause_min_clicks: z.number().int().min(0).max(500).nullable().optional(),
      })
      .safeParse({ ...req.params, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    const { projectId, campaignId } = parsed.data;
    if (!(await canAdminProject(projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Somente administradores podem editar limites do motor por campanha." });
    }
    const d = parsed.data;
    const optSpend =
      d.optimizer_pause_spend_usd !== undefined
        ? d.optimizer_pause_spend_usd != null
          ? d.optimizer_pause_spend_usd
          : null
        : undefined;
    const optClicks =
      d.optimizer_pause_min_clicks !== undefined
        ? d.optimizer_pause_min_clicks != null
          ? d.optimizer_pause_min_clicks
          : null
        : undefined;
    if (d.optimizer_pause_spend_usd === undefined && d.optimizer_pause_min_clicks === undefined) {
      return res.status(400).json({ error: "Envie optimizer_pause_spend_usd e/ou optimizer_pause_min_clicks." });
    }
    const row = await prisma.paidAdsCampaign.findFirst({
      where: { id: campaignId, projectId },
    });
    if (!row) return res.status(404).json({ error: "Campanha não encontrada." });
    const updated = await prisma.paidAdsCampaign.update({
      where: { id: row.id },
      data: {
        ...(optSpend !== undefined ? { optimizerPauseSpendUsd: optSpend } : {}),
        ...(optClicks !== undefined ? { optimizerPauseMinClicks: optClicks } : {}),
      },
    });
    return res.json({ campaign: mappers.mapPaidCampaign(updated) });
  },

  async reconcileCampaigns(req: Request, res: Response) {
    const parsed = projectIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "projectId inválido." });
    const a = getPaidActor(req);
    if (!a) return res.status(401).json({ error: "Não autenticado." });
    if (!(await canWriteProject(parsed.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para sincronizar campanhas." });
    }
    const r = await reconcileProjectCampaigns(parsed.data.projectId);
    return res.json(r);
  },
};
