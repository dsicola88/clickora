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

export function normalizeSubscriptionStatus(input: string): SubscriptionStatus {
  const normalized = input.trim().toLowerCase();

  if (["approved", "authorized", "active", "purchase_approved", "subscription_started", "billet_printed"].includes(normalized)) {
    return "active";
  }
  if (["canceled", "cancelled", "refunded", "chargeback"].includes(normalized)) {
    return "canceled";
  }
  if (["expired", "overdue", "delinquent", "subscription_expired", "payment_refused"].includes(normalized)) {
    return "expired";
  }
  if (["suspended", "blocked"].includes(normalized)) {
    return "suspended";
  }

  return "active";
}
