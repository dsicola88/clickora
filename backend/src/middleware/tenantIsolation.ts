import { Request, Response, NextFunction } from "express";
import type { TenantContext } from "../lib/tenantContext";
import { runWithTenantContext } from "../lib/tenantContext";
import { logTenantViolation } from "../lib/tenantLogging";

/**
 * Obriga contexto de tenant no ALS para o resto do pedido.
 * `tenantId` = utilizador autenticado (JWT). Sem bypass: admins usam `prismaAdmin` nas rotas /admin.
 *
 * Deve ser montado depois de `authenticate`.
 */
export function tenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    logTenantViolation("tenant_isolation_without_user", { path: req.path, method: req.method });
    return res.status(401).json({ error: "Não autenticado" });
  }

  const ctx: TenantContext = {
    tenantId: req.user.userId,
  };

  runWithTenantContext(ctx, () => next());
}
