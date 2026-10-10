import type { PlanType, Subscription, SubscriptionStatus } from "@prisma/client";

type AccessDecision = {
  allowed: boolean;
  reason?: "subscription_missing" | "subscription_suspended" | "subscription_expired" | "subscription_canceled";
  shouldMarkExpired?: boolean;
};

export function evaluateSubscriptionAccess(
  subscription: Pick<Subscription, "status" | "endsAt"> | null | undefined
): AccessDecision {
  if (!subscription) {
    return { allowed: false, reason: "subscription_missing" };
  }

  const now = new Date();
  const hasEnded = !!subscription.endsAt && subscription.endsAt.getTime() <= now.getTime();

  if (subscription.status === "suspended") {
    return { allowed: false, reason: "subscription_suspended" };
  }

  if (subscription.status === "expired") {
    return { allowed: false, reason: "subscription_expired" };
  }

  if (subscription.status === "canceled") {
    if (!subscription.endsAt || hasEnded) {
      return { allowed: false, reason: "subscription_canceled", shouldMarkExpired: hasEnded };
    }
    return { allowed: true };
  }

  if (subscription.status === "active" && hasEnded) {
    return { allowed: false, reason: "subscription_expired", shouldMarkExpired: true };
  }

  return { allowed: true };
}

export function periodEndByPlan(planType: PlanType, startsAt = new Date()): Date | null {
  const end = new Date(startsAt);

  if (planType === "free_trial") {
    end.setDate(end.getDate() + 7);
    return end;
  }
  if (planType === "monthly") {
    end.setMonth(end.getMonth() + 1);
    return end;
  }
  if (planType === "quarterly") {
    end.setMonth(end.getMonth() + 3);
    return end;
  }
  if (planType === "annual") {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }

  return null;
}

/**
 * Efeito de um evento Hotmart 2.0 na subscrição da app.
 * `null` = não alterar acesso (boleto impresso, evento desconhecido, protesto).
 * Não trata nomes oficiais como compra aprovada.
 */
export function normalizeSubscriptionStatus(input: string): SubscriptionStatus | null {
  const normalized = input.trim().toLowerCase().replace(/[\s.-]+/g, "_");

  const active = new Set([
    "approved",
    "authorized",
    "active",
    "purchase_approved",
    "purchase_complete",
    "subscription_started",
  ]);
  const canceled = new Set([
    "canceled",
    "cancelled",
    "refunded",
    "chargeback",
    "purchase_canceled",
    "purchase_cancelled",
    "purchase_refunded",
    "purchase_chargeback",
    "subscription_cancellation",
    "subscription_canceled",
    "subscription_cancelled",
  ]);
  const expired = new Set([
    "expired",
    "overdue",
    "delinquent",
    "subscription_expired",
    "payment_refused",
    "purchase_expired",
  ]);
  const suspended = new Set(["suspended", "blocked"]);

  if (active.has(normalized)) return "active";
  if (canceled.has(normalized)) return "canceled";
  if (expired.has(normalized)) return "expired";
  if (suspended.has(normalized)) return "suspended";
  return null;
}
