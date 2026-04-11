import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { TenantIsolationError } from "../lib/tenantErrors";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[ERROR]", err.message);

  if (err instanceof TenantIsolationError) {
    return res.status(403).json({
      error: process.env.NODE_ENV === "production" ? "Acesso negado." : err.message,
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Registro duplicado." });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Registro não encontrado." });
    }
  }

  res.status(500).json({
    error: process.env.NODE_ENV === "production"
      ? "Erro interno do servidor"
      : err.message,
  });
}
