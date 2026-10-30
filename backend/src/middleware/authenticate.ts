import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";
import { resolveLiveWorkspaceClaims } from "../lib/workspaceSessionGuard";

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
    if (raw.purpose === "mfa") {
      return res.status(401).json({ error: "Complete a verificação MFA" });
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
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
