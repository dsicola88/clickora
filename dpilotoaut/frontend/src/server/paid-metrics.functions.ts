import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { fetchLast14DaysSpend, getAccessFromRefreshToken } from "@backend/google-ads.api";
import { prisma } from "@backend/prisma";
import { canAccessProject } from "@backend/permissions";

const projectIdInput = z.object({ projectId: z.string().uuid() });

export const getGoogleAdsMetrics = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await canAccessProject(data.projectId, context.userId))) {
      throw new Error("Sem acesso ao projeto.");
    }
    const conn = await prisma.googleAdsConnection.findUnique({
      where: { projectId: data.projectId },
    });

    if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
      return {
        state: "disconnected" as const,
        todayMicros: null as number | null,
        seriesUsd: null as { date: string; spendUsd: number }[] | null,
        lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
        message: "Ligue uma conta Google Ads para ver o gasto real dos últimos 14 dias.",
      };
    }

    const refresh = conn.tokenRef;
    try {
      const { access_token: access } = await getAccessFromRefreshToken(refresh);
      const { todayMicros, seriesUsd } = await fetchLast14DaysSpend(
        access,
        conn.googleCustomerId.replace(/-/g, ""),
      );

      return {
        state: "ok" as const,
        todayMicros: Number(todayMicros),
        seriesUsd,
        lastSyncAt: new Date().toISOString(),
        message: null as string | null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao obter métricas Google.";
      return {
        state: "error" as const,
        todayMicros: null as number | null,
        seriesUsd: null as { date: string; spendUsd: number }[] | null,
        lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
        message,
      };
    }
  });
