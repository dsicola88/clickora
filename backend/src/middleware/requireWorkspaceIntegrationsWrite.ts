import type { Request, Response, NextFunction } from "express";
import { denyIfCannotWriteIntegrations } from "../controllers/workspace.controller";

/** Bloqueia mutações em `/integrations/*` para quem não pode alterar integrações no workspace. */
export async function requireWorkspaceIntegrationsWrite(req: Request, res: Response, next: NextFunction) {
  if (await denyIfCannotWriteIntegrations(req, res)) return;
  next();
}
