import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { isGoogleAdsOAuthConfigured } from "@backend/google-ads.api";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

export const checkGoogleAdsOAuthAvailable = createServerFn({ method: "GET" }).handler(async () => {
  return {
    available: isGoogleAdsOAuthConfigured(),
  };
});

const disconnectInput = z.object({ projectId: z.string().uuid() });

export const disconnectGoogleAdsConnection = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => disconnectInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAdminProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para desligar a conta Google Ads.");
    }
    const project = await prisma.project.findFirst({
      where: { id: data.projectId },
      select: { organizationId: true },
    });
    if (!project) {
      throw new Error("Projeto não encontrado.");
    }
    await prisma.googleAdsConnection.upsert({
      where: { projectId: data.projectId },
      create: {
        organizationId: project.organizationId,
        projectId: data.projectId,
        status: "disconnected",
        tokenRef: null,
        googleCustomerId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
      update: {
        status: "disconnected",
        tokenRef: null,
        googleCustomerId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
    });
    return { ok: true as const };
  });
