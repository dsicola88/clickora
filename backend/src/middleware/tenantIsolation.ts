import { Request, Response, NextFunction } from "express";
import type { TenantContext } from "../lib/tenantContext";
import { runWithTenantContext } from "../lib/tenantContext";
import { logTenantViolation } from "../lib/tenantLogging";

/**
 * Obriga contexto de tenant no ALS para o resto do pedido.
 * `tenantId` = utilizador autenticado (JWT). O cliente `prisma` (default) injeta `userId`/`id` em todas
 * as leituras/escritas por modelo multi-tenant — um utilizador não vê nem altera dados de outro.
 * Rotas globais: `prismaAdmin` (/admin) ou `systemPrisma` (auth, webhooks com token, tracking público).
 * Assinatura ativa: `requireActiveSubscription` (admins internos ignoram bloqueio de plano, não o isolamento).
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
