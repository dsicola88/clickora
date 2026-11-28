import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyToken, JwtPayload } from "../lib/jwt";
import {
  resolveLiveWorkspaceClaims,
  SessionRevokedError,
  SessionUserGoneError,
} from "../lib/workspaceSessionGuard";

/** 401 só quando o token é de facto inválido; falhas de infraestrutura (BD) não podem terminar a sessão no cliente. */
export function respondSessionAuthError(err: unknown, res: Response) {
  if (err instanceof SessionRevokedError) {
    return res.status(401).json({ error: "Sessão terminada. Inicie sessão novamente.", code: "SESSION_REVOKED" });
  }
  if (err instanceof SessionUserGoneError || err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
  console.error("[auth] falha ao validar sessão:", err);
  return res.status(503).json({
    error: "Autenticação temporariamente indisponível. Tente de novo dentro de instantes.",
    code: "AUTH_UNAVAILABLE",
  });
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const token = header.split(" ")[1];
    const raw = verifyToken(token);
    if (raw.purpose === "mfa" || raw.purpose === "password_reset") {
      return res.status(401).json({
        error:
          raw.purpose === "mfa"
            ? "Complete a verificação MFA"
            : "Token de recuperação inválido para esta operação",
      });
    }
    const live = await resolveLiveWorkspaceClaims(raw);
    req.user = {
      ...raw,
      tenantUserId: live.tenantUserId,
      workspaceId: live.workspaceId,
      workspaceRole: live.workspaceRole ?? "owner",
      workspacePermissions: live.workspacePermissions ?? [],
    };
    next();
  } catch (err) {
    return respondSessionAuthError(err, res);
  }
}
