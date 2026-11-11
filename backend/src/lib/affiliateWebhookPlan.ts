import { systemPrisma } from "./prisma";

/** Subscription+plan para gates do webhook de afiliados (systemPrisma — sem ALS tenant). */
export async function subscriptionPlanForWebhookGate(userId: string) {
  return systemPrisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}
