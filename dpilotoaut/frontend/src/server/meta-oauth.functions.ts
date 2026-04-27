import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

export const checkMetaOAuthAvailable = createServerFn({ method: "GET" }).handler(async () => {
  return {
    available: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    appId: process.env.META_APP_ID ? "configured" : null,
  };
});

const disconnectInput = z.object({ projectId: z.string().uuid() });

export const disconnectMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => disconnectInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAdminProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para desconectar.");
    }

    const conn = await prisma.metaConnection.findUnique({
      where: { projectId: data.projectId },
      select: { id: true, tokenRef: true },
    });

    if (conn?.tokenRef && !conn.tokenRef.startsWith("state:")) {
      try {
        await fetch(
          `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(conn.tokenRef)}`,
          { method: "DELETE" },
        );
      } catch {
        // ignore
      }
    }

    await prisma.metaConnection.update({
      where: { projectId: data.projectId },
      data: {
        status: "disconnected",
        tokenRef: null,
        adAccountId: null,
        accountName: null,
        businessId: null,
        errorMessage: null,
        lastSyncAt: null,
      },
    });

    return { success: true as const };
  });
