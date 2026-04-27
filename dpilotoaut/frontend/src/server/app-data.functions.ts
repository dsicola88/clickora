import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import {
  mapAiRun,
  mapChangeRequest,
  mapGoogleAdsConnection,
  mapGuardrails,
  mapMetaConnection,
  mapPaidCampaign,
  mapProjectMode,
  mapTikTokConnection,
} from "@backend/api-mappers";
import { applyChangeRequestRemote } from "@backend/change-request-apply";
import { prisma } from "@backend/prisma";
import { canAccessProject, canAdminProject, canWriteProject } from "@backend/permissions";
import { assertUserInOrganization, listWorkspacesForUser } from "@backend/tenancy";

const projectIdInput = z.object({ projectId: z.string().uuid() });

const listProjectInput = z
  .object({ organizationId: z.string().uuid().optional() })
  .optional();

export type WorkspaceOption = Awaited<ReturnType<typeof listWorkspacesForUser>>[number];

/** Workspaces (tenants) em que o utilizador é membro — base do multi-tenant. */
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    return listWorkspacesForUser(context.userId);
  });

/** Ids de projectos acessíveis. Opcional: filtrar por um `organizationId` (workspace) após verificar membro. */
export const listProjectIdsForUser = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => listProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const orgId = data?.organizationId;
    if (orgId) {
      await assertUserInOrganization(context.userId, orgId);
    }
    const rows = await prisma.project.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { id: true, organizationId: true, name: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows;
  });

export const getProjectWithOrg = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const p = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      organization_id: p.organizationId,
      organizations: { name: p.organization.name },
    };
  });

export const getPaidOverview = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }

    const [project, conn, gr, pendingCount] = await Promise.all([
      prisma.project.findFirst({
        where: { id: data.projectId },
        select: { paidMode: true },
      }),
      prisma.googleAdsConnection.findUnique({ where: { projectId: data.projectId } }),
      prisma.paidGuardrails.findUnique({ where: { projectId: data.projectId } }),
      prisma.paidChangeRequest.count({
        where: { projectId: data.projectId, status: "pending" },
      }),
    ]);

    if (!project || !conn || !gr) {
      throw new Error("Dados do projeto incompletos.");
    }

    return {
      project: mapProjectMode(project),
      connection: mapGoogleAdsConnection(conn),
      guardrails: mapGuardrails(gr),
      pendingApprovals: pendingCount,
    };
  });

export const updateProjectPaidMode = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        paidMode: z.enum(["copilot", "autopilot"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await canWriteProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para alterar o modo.");
    }
    await prisma.project.update({
      where: { id: data.projectId },
      data: { paidMode: data.paidMode },
    });
    return { ok: true as const };
  });

const guardrailsUpsertSchema = z.object({
  projectId: z.string().uuid(),
  max_daily_budget_micros: z.number(),
  max_monthly_spend_micros: z.number(),
  max_cpc_micros: z.number().nullable(),
  allowed_countries: z.array(z.string()),
  blocked_keywords: z.array(z.string()),
  require_approval_above_micros: z.number().nullable(),
});

export const upsertGuardrails = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => guardrailsUpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAdminProject(data.projectId, context.userId))) {
      throw new Error("Somente administradores podem editar guardrails.");
    }

    const g = await prisma.paidGuardrails.upsert({
      where: { projectId: data.projectId },
      create: {
        projectId: data.projectId,
        maxDailyBudgetMicros: BigInt(Math.round(data.max_daily_budget_micros)),
        maxMonthlySpendMicros: BigInt(Math.round(data.max_monthly_spend_micros)),
        maxCpcMicros: data.max_cpc_micros != null ? BigInt(Math.round(data.max_cpc_micros)) : null,
        allowedCountries: data.allowed_countries,
        blockedKeywords: data.blocked_keywords,
        requireApprovalAboveMicros:
          data.require_approval_above_micros != null
            ? BigInt(Math.round(data.require_approval_above_micros))
            : null,
      },
      update: {
        maxDailyBudgetMicros: BigInt(Math.round(data.max_daily_budget_micros)),
        maxMonthlySpendMicros: BigInt(Math.round(data.max_monthly_spend_micros)),
        maxCpcMicros: data.max_cpc_micros != null ? BigInt(Math.round(data.max_cpc_micros)) : null,
        allowedCountries: data.allowed_countries,
        blockedKeywords: data.blocked_keywords,
        requireApprovalAboveMicros:
          data.require_approval_above_micros != null
            ? BigInt(Math.round(data.require_approval_above_micros))
            : null,
      },
    });

    return mapGuardrails(g);
  });

export const listPaidCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        platform: z.enum(["google_ads", "meta_ads", "tiktok_ads"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const rows = await prisma.paidCampaign.findMany({
      where: {
        projectId: data.projectId,
        ...(data.platform ? { platform: data.platform } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapPaidCampaign);
  });

export const listChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const rows = await prisma.paidChangeRequest.findMany({
      where: { projectId: data.projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapChangeRequest);
  });

export const reviewChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "applied"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const cr = await prisma.paidChangeRequest.findFirst({
      where: {
        id: data.id,
        project: { organization: { members: { some: { userId: context.userId } } } },
      },
    });
    if (!cr) throw new Error("Pedido não encontrado.");
    if (!(await canAdminProject(cr.projectId, context.userId))) {
      throw new Error("Sem permissão para revisar.");
    }

    const now = new Date();

    if (data.status === "applied") {
      const out = await applyChangeRequestRemote(cr.projectId, cr.type, cr.payload);
      if (!out.ok) {
        await prisma.paidChangeRequest.update({
          where: { id: data.id },
          data: {
            status: "failed",
            errorMessage: out.error,
            reviewedById: context.userId,
            reviewedAt: now,
          },
        });
        throw new Error(out.error);
      }
      await prisma.paidChangeRequest.update({
        where: { id: data.id },
        data: {
          status: "applied",
          reviewedById: context.userId,
          reviewedAt: now,
          appliedAt: now,
          errorMessage: null,
        },
      });
      return { ok: true as const };
    }

    await prisma.paidChangeRequest.update({
      where: { id: data.id },
      data: {
        status: data.status,
        reviewedById: context.userId,
        reviewedAt: now,
      },
    });

    return { ok: true as const };
  });

export const getMetaConnection = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const c = await prisma.metaConnection.findUnique({
      where: { projectId: data.projectId },
    });
    return c ? mapMetaConnection(c) : null;
  });

export const getTikTokConnection = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    let c = await prisma.tikTokConnection.findUnique({
      where: { projectId: data.projectId },
    });
    if (!c) {
      const p = await prisma.project.findFirst({
        where: { id: data.projectId },
        select: { organizationId: true },
      });
      if (!p) return null;
      c = await prisma.tikTokConnection.create({
        data: {
          organizationId: p.organizationId,
          projectId: data.projectId,
          status: "disconnected",
        },
      });
    }
    return mapTikTokConnection(c);
  });

export const getMetaOverviewCounts = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }

    const [campaigns, drafts, pending, campaignIds] = await Promise.all([
      prisma.paidCampaign.count({
        where: { projectId: data.projectId, platform: "meta_ads" },
      }),
      prisma.paidCampaign.count({
        where: { projectId: data.projectId, platform: "meta_ads", status: "draft" },
      }),
      prisma.paidChangeRequest.count({
        where: {
          projectId: data.projectId,
          status: "pending",
          type: "meta_create_campaign",
        },
      }),
      prisma.paidCampaign.findMany({
        where: { projectId: data.projectId, platform: "meta_ads" },
        select: { id: true },
      }),
    ]);

    const ids = campaignIds.map((c) => c.id);
    let creatives = 0;
    if (ids.length) {
      const adsets = await prisma.metaAdset.findMany({
        where: { campaignId: { in: ids } },
        select: { id: true },
      });
      const adsetIds = adsets.map((a) => a.id);
      if (adsetIds.length) {
        creatives = await prisma.metaCreative.count({
          where: { adsetId: { in: adsetIds } },
        });
      }
    }

    return {
      campaigns,
      drafts,
      pending,
      creatives,
    };
  });

export const getTikTokOverviewCounts = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }

    const [campaigns, drafts, pending] = await Promise.all([
      prisma.paidCampaign.count({
        where: { projectId: data.projectId, platform: "tiktok_ads" },
      }),
      prisma.paidCampaign.count({
        where: { projectId: data.projectId, platform: "tiktok_ads", status: "draft" },
      }),
      prisma.paidChangeRequest.count({
        where: {
          projectId: data.projectId,
          status: "pending",
          type: "tiktok_create_campaign",
        },
      }),
    ]);

    return { campaigns, drafts, pending };
  });

const createTikTokDraftInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
});

export const createTikTokDraftCampaign = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => createTikTokDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canWriteProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para criar campanhas.");
    }
    const project = await prisma.project.findFirst({
      where: { id: data.projectId },
      select: { organizationId: true, paidMode: true },
    });
    if (!project) {
      throw new Error("Projeto não encontrado.");
    }

    const name =
      data.name?.trim() ||
      `Campanha TikTok ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

    const defaultDaily = BigInt(50_000_000);
    const campaign = await prisma.paidCampaign.create({
      data: {
        organizationId: project.organizationId,
        projectId: data.projectId,
        platform: "tiktok_ads",
        name,
        status: "draft",
        dailyBudgetMicros: defaultDaily,
        objectiveSummary: "Rascunho TikTok Ads — publicação via API após aprovação.",
        geoTargets: [],
        languageTargets: [],
      },
    });

    await prisma.paidChangeRequest.create({
      data: {
        organizationId: project.organizationId,
        projectId: data.projectId,
        type: "tiktok_create_campaign",
        payload: {
          campaign_id: campaign.id,
          name: campaign.name,
          platform: "tiktok_ads",
        },
        requestedById: context.userId,
        status: "pending",
      },
    });

    return mapPaidCampaign(campaign);
  });

export const listAiRuns = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const rows = await prisma.aiRun.findMany({
      where: { projectId: data.projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(mapAiRun);
  });

export const listAuditChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const rows = await prisma.paidChangeRequest.findMany({
      where: { projectId: data.projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(mapChangeRequest);
  });
