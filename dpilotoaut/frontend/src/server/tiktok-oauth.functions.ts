import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

export const checkTikTokOAuthAvailable = createServerFn({ method: "GET" }).handler(async () => {
  return {
    available: Boolean(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET),
    appId: process.env.TIKTOK_APP_ID ? "configured" : null,
  };
});

const disconnectInput = z.object({ projectId: z.string().uuid() });

export const disconnectTikTokConnection = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => disconnectInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAdminProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para desconectar.");
    }

    const project = await prisma.project.findFirst({
      where: { id: data.projectId },
      select: { organizationId: true },
    });
    if (!project) {
      throw new Error("Projeto não encontrado.");
    }

    await prisma.tikTokConnection.upsert({
      where: { projectId: data.projectId },
      create: {
        organizationId: project.organizationId,
        projectId: data.projectId,
        status: "disconnected",
      },
      update: {
        status: "disconnected",
        tokenRef: null,
        refreshTokenRef: null,
        advertiserId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
    });

    return { ok: true as const };
  });
