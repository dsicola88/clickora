/**
 * Submete change requests Meta/TikTok com a mesma política do estúdio Google
 * (Autopilot / dono → aplica já; Copilot + membro → Aprovações).
 */
import type { PaidAdsChangeRequestType } from "@prisma/client";

import { workspaceAllowsApplyBeforeRemote } from "./apply-workspace-guard";
import { applyChangeRequestRemote } from "./change-request-apply";
import { prisma } from "./paidPrisma";
import { shouldApplyStudioChangeImmediately } from "./studio-apply-policy";

export async function submitNetworkStudioChangeRequest(args: {
  projectId: string;
  campaignId: string;
  type: PaidAdsChangeRequestType;
  payload: Record<string, unknown>;
  requestedById: string;
}): Promise<{ id: string; status: string; error?: string }> {
  const project = await prisma.paidAdsProject.findFirst({
    where: { id: args.projectId },
    select: { userId: true, paidMode: true },
  });
  if (!project) {
    return { id: "", status: "error", error: "Projeto não encontrado." };
  }

  const payload = { ...args.payload, campaign_id: args.campaignId };

  const row = await prisma.paidAdsChangeRequest.create({
    data: {
      userId: project.userId,
      projectId: args.projectId,
      type: args.type,
      payload,
      status: "pending",
      requestedById: args.requestedById,
    },
  });

  const applyNow = shouldApplyStudioChangeImmediately({
    paidMode: project.paidMode,
    projectOwnerId: project.userId,
    requestedById: args.requestedById,
  });

  if (!applyNow) {
    return { id: row.id, status: "pending" };
  }

  const now = new Date();
  const pre = await workspaceAllowsApplyBeforeRemote(args.projectId, args.type, payload);
  if (!pre.ok) {
    await prisma.paidAdsChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: pre.message,
        reviewedAt: now,
        reviewedById: args.requestedById,
      },
    });
    return { id: row.id, status: "failed", error: pre.message };
  }

  const out = await applyChangeRequestRemote(args.projectId, args.type, payload);
  if (!out.ok) {
    await prisma.paidAdsChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: out.error,
        reviewedAt: now,
        reviewedById: args.requestedById,
      },
    });
    return { id: row.id, status: "failed", error: out.error };
  }

  await prisma.paidAdsChangeRequest.update({
    where: { id: row.id },
    data: {
      status: "applied",
      reviewedAt: now,
      reviewedById: args.requestedById,
      appliedAt: now,
      errorMessage: null,
    },
  });
  return { id: row.id, status: "applied" };
}
