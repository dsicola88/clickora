import { Request, Response, NextFunction } from "express";
import {
  apiKeyHasScope,
  scopeRequiredForHttpMethod,
  type ApiKeyScope,
} from "../lib/apiKeyScopes";

/**
 * JWT de sessão passa sempre.
 * API key precisa do scope pedido (`write` implica `read`).
 */
export function requireApiKeyScope(need: ApiKeyScope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.authVia !== "api_key") return next();
    const scopes = req.apiKeyScopes ?? [];
    if (!apiKeyHasScope(scopes, need)) {
      return res.status(403).json({
        error: `API key sem permissão «${need}»`,
        code: "api_key_scope_denied",
        required_scope: need,
        scopes,
      });
    }
    return next();
  };
}

/**
 * Aplica scope automático pelo método HTTP (GET→read, mutações→write).
 * Usar depois de `authenticateJwtOrApiKey`.
 */
export function enforceApiKeyHttpScope(req: Request, res: Response, next: NextFunction) {
  if (req.authVia !== "api_key") return next();
  const need = scopeRequiredForHttpMethod(req.method);
  return requireApiKeyScope(need)(req, res, next);
}

/**
 * Gestão sensível (API keys, MFA) — só sessão JWT, nunca API key.
 */
export function requireSessionJwt(req: Request, res: Response, next: NextFunction) {
  if (req.authVia === "api_key") {
    return res.status(403).json({
      error: "Esta operação requer login na app (sessão), não API key.",
      code: "session_required",
    });
  }
  return next();
}
