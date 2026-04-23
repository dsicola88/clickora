import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const token = header.split(" ")[1];
    const raw = verifyToken(token);
    const tenantUserId = raw.tenantUserId ?? raw.userId;
    req.user = {
      ...raw,
      tenantUserId,
      workspaceId: raw.workspaceId,
      workspaceRole: raw.workspaceRole ?? "owner",
      workspacePermissions: raw.workspacePermissions ?? [],
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
