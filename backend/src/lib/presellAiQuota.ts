import type { PlanType } from "@prisma/client";
import prisma from "./prisma";
import { resolveDefaultPlanForSignup } from "./defaultPlan";

/** Fallback quando o plano ainda não tem `maxPresellAiGenerations` configurado pelo admin. */
export function monthlyPresellAiLimitForPlanType(type: PlanType | string | null | undefined): number {
  const t = String(type || "free_trial");
  if (t === "annual") return 120;
  if (t === "monthly" || t === "quarterly") return 40;
  return 8; // free_trial / desconhecido
}

/** Limite efectivo: coluna do plano (admin) ou fallback por tipo. */
export function effectiveMaxPresellAiGenerationsFromPlan(plan: {
  type: PlanType | string;
  maxPresellAiGenerations?: number | null;
}): number {
  if (typeof plan.maxPresellAiGenerations === "number" && !Number.isNaN(plan.maxPresellAiGenerations)) {
    return Math.max(0, Math.floor(plan.maxPresellAiGenerations));
  }
  return monthlyPresellAiLimitForPlanType(plan.type);
}

export function currentUtcMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function resolvePresellAiQuota(userId: string): Promise<{
  planType: PlanType | null;
  limit: number | null;
  used: number;
  remaining: number | null;
  privileged: boolean;
  monthKey: string;
}> {
  const monthKey = currentUtcMonthKey();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      workspaceId: true,
      roles: { select: { role: true } },
      subscription: {
        include: {
          plan: {
            select: {
              type: true,
              maxPresellAiGenerations: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return { planType: null, limit: 0, used: 0, remaining: 0, privileged: false, monthKey };
  }

  const privileged = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
  let plan = user.subscription?.plan ?? null;
  if (!plan) {
    const def = await resolveDefaultPlanForSignup();
    plan = def
      ? {
          type: def.type,
          maxPresellAiGenerations:
            "maxPresellAiGenerations" in def
              ? (def as { maxPresellAiGenerations?: number | null }).maxPresellAiGenerations ?? null
              : null,
        }
      : null;
  }

  const planType = plan?.type ?? null;

  const since = new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1));
  const used = await prisma.workspaceAuditLog.count({
    where: {
      workspaceId: user.workspaceId,
      actorUserId: userId,
      action: "presell_ai_review_copy",
      createdAt: { gte: since },
    },
  });

  if (privileged) {
    return { planType, limit: null, used, remaining: null, privileged: true, monthKey };
  }

  const limit = plan
    ? effectiveMaxPresellAiGenerationsFromPlan(plan)
    : monthlyPresellAiLimitForPlanType(null);
  const remaining = Math.max(0, limit - used);
  return { planType, limit, used, remaining, privileged: false, monthKey };
}

export async function assertPresellAiQuotaAvailable(userId: string): Promise<{
  ok: true;
  quota: Awaited<ReturnType<typeof resolvePresellAiQuota>>;
} | {
  ok: false;
  status: number;
  body: Record<string, unknown>;
}> {
  const quota = await resolvePresellAiQuota(userId);
  if (quota.privileged || quota.limit == null) return { ok: true, quota };
  if ((quota.remaining ?? 0) <= 0) {
    return {
      ok: false,
      status: 429,
      body: {
        error:
          "Atingiu o limite mensal de gerações IA de review neste plano. Use o texto determinístico, faça upgrade, ou espere o próximo mês.",
        code: "PRESELL_AI_QUOTA",
        quota: {
          plan_type: quota.planType,
          limit: quota.limit,
          used: quota.used,
          remaining: 0,
          month: quota.monthKey,
        },
      },
    };
  }
  return { ok: true, quota };
}
