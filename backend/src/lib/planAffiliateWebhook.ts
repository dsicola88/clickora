import type { Plan } from "@prisma/client";

/** Postback de afiliados (Plataformas): depende do plano; configurável no admin. */
export function planAllowsAffiliateWebhook(
  plan: Pick<Plan, "affiliateWebhookEnabled"> | null | undefined,
): boolean {
  return Boolean(plan?.affiliateWebhookEnabled);
}
