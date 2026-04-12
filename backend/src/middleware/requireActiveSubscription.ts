import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { resolveDefaultPlanForSignup } from "../lib/defaultPlan";
import { evaluateSubscriptionAccess } from "../lib/subscription";

const reasonToMessage: Record<string, string> = {
  subscription_missing: "Assinatura não encontrada.",
  subscription_suspended: "Sua conta está suspensa. Entre em contato com o suporte.",
  subscription_expired: "Sua assinatura expirou. Atualize seu plano para continuar.",
  subscription_canceled: "Sua assinatura está cancelada. Reative o plano para continuar.",
};

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  let user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { roles: true, subscription: true },
  });

  if (!user) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  // Admin / super_admin bypass for internal operations.
  if (user.roles.some((r) => r.role === "admin" || r.role === "super_admin")) {
    return next();
  }

  // Sem subscription (ex.: registo quando ainda não havia linhas em `plans`) — tentar plano trial/default.
  if (!user.subscription) {
    const plan = await resolveDefaultPlanForSignup();
    if (plan) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: "active",
        },
      });
      user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.userId },
        include: { roles: true, subscription: true },
      });
    }
  }

  const decision = evaluateSubscriptionAccess(user.subscription);
  if (decision.shouldMarkExpired && user.subscription && user.subscription.status !== "expired") {
    await prisma.subscription.update({
      where: { id: user.subscription.id },
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
