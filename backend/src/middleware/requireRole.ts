import { Request, Response, NextFunction } from "express";
import { systemPrisma } from "../lib/prisma";

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const userRoles = await systemPrisma.userRole.findMany({
      where: { userId: req.user.userId },
      select: { role: true },
    });

    const hasRole = userRoles.some((ur) => roles.includes(ur.role));
    if (!hasRole) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    next();
  };
}
