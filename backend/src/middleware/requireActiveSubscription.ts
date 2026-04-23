import { Request, Response, NextFunction } from "express";
import { systemPrisma } from "../lib/prisma";
import { resolveDefaultPlanForSignup } from "../lib/defaultPlan";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import type { JwtPayload } from "../lib/jwt";

const reasonToMessage: Record<string, string> = {
  subscription_missing: "Assinatura não encontrada.",
  subscription_suspended: "Sua conta está suspensa. Entre em contato com o suporte.",
  subscription_expired: "Sua assinatura expirou. Atualize seu plano para continuar.",
  subscription_canceled: "Sua assinatura está cancelada. Reative o plano para continuar.",
};

function billingId(req: Request): string {
  const u = req.user as JwtPayload;
  return u.tenantUserId ?? u.userId;
}

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const actor = await systemPrisma.user.findUnique({
    where: { id: req.user.userId },
    include: { roles: true },
  });

  if (!actor) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  if (actor.roles.some((r) => r.role === "admin" || r.role === "super_admin")) {
    return next();
  }

  const billId = billingId(req);
  let billingUser = await systemPrisma.user.findUnique({
    where: { id: billId },
    include: { subscription: true },
  });

  if (!billingUser) {
    return res.status(401).json({ error: "Conta não encontrada" });
  }

  if (!billingUser.subscription) {
    const plan = await resolveDefaultPlanForSignup();
    if (plan) {
      await systemPrisma.subscription.create({
        data: {
          userId: billingUser.id,
          planId: plan.id,
          status: "active",
        },
      });
      billingUser = await systemPrisma.user.findUniqueOrThrow({
        where: { id: billId },
        include: { subscription: true },
      });
    }
  }

  const decision = evaluateSubscriptionAccess(billingUser.subscription);
  if (decision.shouldMarkExpired && billingUser.subscription && billingUser.subscription.status !== "expired") {
    await systemPrisma.subscription.update({
      where: { id: billingUser.subscription.id },
      data: { status: "expired" },
    });
  }

  if (!decision.allowed) {
    const key = decision.reason ?? "subscription_expired";
    return res.status(403).json({
      error: reasonToMessage[key] ?? "Acesso bloqueado por assinatura.",
      code: key,
    });
  }

  return next();
}
