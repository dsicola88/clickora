import type { NextFunction, Request, Response } from "express";
import { systemPrisma } from "../lib/prisma";
import { resolveWorkspaceSessionForLogin } from "../lib/workspaceSession";

/**
 * Plano com `dpilot_ads_enabled` ou `super_admin` (rotas `/api/paid/*`).
 */
export async function requireDpilotPlan(req: Request, res: Response, next: NextFunction) {
  const auth = req.user;
  if (!auth) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const user = await systemPrisma.user.findUnique({
    where: { id: auth.userId },
    include: { roles: true, subscription: { include: { plan: true } } },
  });
  if (!user) {
    return res.status(404).json({ error: "Utilizador não encontrado." });
  }

  const sess = await resolveWorkspaceSessionForLogin(user.id);
  const billing = await systemPrisma.user.findUnique({
    where: { id: sess.tenantUserId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!billing) {
    return res.status(403).json({ error: "Conta de faturação não encontrada." });
  }

  const isSuperAdmin = user.roles.some((r) => r.role === "super_admin");
  const plan = billing.subscription?.plan;
  const dpilotEnabled =
    isSuperAdmin ||
    (plan != null && typeof plan.dpilotAdsEnabled === "boolean" && plan.dpilotAdsEnabled);

  if (!dpilotEnabled) {
    return res.status(403).json({ error: "O seu plano não inclui o módulo de anúncios." });
  }

  next();
}
