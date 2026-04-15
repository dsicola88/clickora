import type { PlanType } from "@prisma/client";
import prisma from "./prisma";
import { resolveDefaultPlanForSignup } from "./defaultPlan";

/** Quando a coluna ainda não existe ou é nula — anual = 2, resto = 0. */
export function fallbackMaxCustomDomainsFromPlanType(type: PlanType): number {
  if (type === "annual") return 2;
  return 0;
}

export function effectiveMaxCustomDomainsFromPlan(plan: {
  maxCustomDomains?: number | null;
  type: PlanType;
}): number {
  if (typeof plan.maxCustomDomains === "number" && !Number.isNaN(plan.maxCustomDomains)) {
    return Math.max(0, plan.maxCustomDomains);
  }
  return fallbackMaxCustomDomainsFromPlanType(plan.type);
}

export async function resolveCustomDomainQuotaForUser(userId: string): Promise<{
  maxCustomDomains: number | null;
  used: number;
  canAdd: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    return { maxCustomDomains: 0, used: 0, canAdd: false };
  }

  const isPrivileged = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
  const used = await prisma.customDomain.count({ where: { userId } });

  if (isPrivileged) {
    return { maxCustomDomains: null, used, canAdd: true };
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  let plan = sub?.plan ?? null;
  if (!plan) {
    plan = await resolveDefaultPlanForSignup();
  }

  if (!plan) {
    return { maxCustomDomains: 0, used, canAdd: false };
  }

  const max = effectiveMaxCustomDomainsFromPlan(plan);
  const canAdd = used < max;
  return { maxCustomDomains: max, used, canAdd };
}
