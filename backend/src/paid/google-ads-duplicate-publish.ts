/**
 * Enfileira create_campaign para uma cópia local (reusa apply + guardrails do estúdio).
 */
import { applyChangeRequestRemote } from "./change-request-apply";
import { workspaceAllowsApplyBeforeRemote } from "./apply-workspace-guard";
import { prisma } from "./paidPrisma";

export async function enqueueCreateCampaignChangeRequest(
  projectId: string,
  campaignId: string,
  requestedById: string,
): Promise<{ ok: true; change_request_id: string; applied: boolean } | { ok: false; error: string }> {
  const project = await prisma.paidAdsProject.findFirst({
    where: { id: projectId },
    select: { userId: true, paidMode: true },
  });
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    select: {
      id: true,
      dailyBudgetMicros: true,
      geoTargets: true,
      languageTargets: true,
      biddingConfig: true,
    },
  });
  if (!camp) return { ok: false, error: "Campanha cópia não encontrada." };

  const payload = {
    campaign_id: camp.id,
    source: "duplicate",
    daily_budget_micros: camp.dailyBudgetMicros != null ? Number(camp.dailyBudgetMicros) : null,
    geo_targets: camp.geoTargets,
    language_targets: camp.languageTargets,
    bidding_config: camp.biddingConfig,
    mode: project.paidMode,
  };

  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { status: "pending_publish" },
  });

  const row = await prisma.paidAdsChangeRequest.create({
    data: {
      userId: project.userId,
      projectId,
      type: "create_campaign",
      payload,
      status: "pending",
      requestedById,
    },
  });

  if (project.paidMode !== "autopilot") {
    return { ok: true, change_request_id: row.id, applied: false };
  }

  const now = new Date();
  const pre = await workspaceAllowsApplyBeforeRemote(projectId, "create_campaign", payload);
  if (!pre.ok) {
    await prisma.paidAdsChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: pre.message,
        reviewedAt: now,
        reviewedById: requestedById,
      },
    });
    await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { status: "error" },
    });
    return { ok: false, error: pre.message };
  }

  const out = await applyChangeRequestRemote(projectId, "create_campaign", payload);
  if (!out.ok) {
    await prisma.paidAdsChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: out.error,
        reviewedAt: now,
        reviewedById: requestedById,
      },
    });
    await prisma.paidAdsCampaign.update({
      where: { id: camp.id },
      data: { status: "error" },
    });
    return { ok: false, error: out.error };
  }

  await prisma.paidAdsChangeRequest.update({
    where: { id: row.id },
    data: {
      status: "applied",
      reviewedAt: now,
      reviewedById: requestedById,
      appliedAt: now,
      errorMessage: null,
    },
  });
  return { ok: true, change_request_id: row.id, applied: true };
}
