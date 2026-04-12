import { systemPrisma } from "./prisma";
import type { Plan } from "@prisma/client";

/**
 * Plano a usar em novos registos ou quando um utilizador ainda não tem subscription
 * (ex.: registo antes dos planos existirem na BD).
 */
export async function resolveDefaultPlanForSignup(): Promise<Plan | null> {
  const byType = await systemPrisma.plan.findFirst({
    where: { type: "free_trial" },
    orderBy: { id: "asc" },
  });
  if (byType) return byType;

  const planFree = await systemPrisma.plan.findUnique({ where: { id: "plan_free" } });
  if (planFree) return planFree;

  return systemPrisma.plan.findFirst({
    orderBy: { priceCents: "asc" },
  });
}
