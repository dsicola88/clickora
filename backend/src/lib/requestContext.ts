import type { Request } from "express";
import type { JwtPayload } from "./jwt";

/** Dono dos dados (conta / workspace): presells, rotadores, integrações da conta. */
export function billingUserId(req: Request): string {
  const u = req.user as JwtPayload;
  return u.tenantUserId ?? u.userId;
}

/** Utilizador autenticado (actor) — auditoria, perfil, web push por dispositivo. */
export function actorUserId(req: Request): string {
  return (req.user as JwtPayload).userId;
}
