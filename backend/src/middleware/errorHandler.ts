import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { TenantIsolationError } from "../lib/tenantErrors";
import { getRequestId, reportException } from "../lib/opsObservability";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = getRequestId(req);
  console.error("[ERROR]", requestId ? `req=${requestId}` : "", err.message);
  if (err.stack) console.error(err.stack);
  void reportException(err, req);

  const tooLarge =
    (err as NodeJS.ErrnoException & { type?: string; status?: number }).type === "entity.too.large" ||
    (err as NodeJS.ErrnoException & { status?: number }).status === 413;
  if (tooLarge) {
    return res.status(413).json({
      error: "Pedido demasiado grande (corpo JSON). Tente reduzir conteúdo ou contacte o suporte.",
      request_id: requestId,
    });
  }

  if (err instanceof TenantIsolationError) {
    return res.status(403).json({
      error: process.env.NODE_ENV === "production" ? "Acesso negado." : err.message,
      code: err.code,
      request_id: requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      error: "Ligação à base de dados indisponível. Tente de novo dentro de instantes.",
      request_id: requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("[PRISMA_VALIDATION]", err.message);
    return res.status(400).json({
      error: process.env.NODE_ENV === "production" ? "Pedido inválido." : err.message,
      request_id: requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Registro duplicado.", request_id: requestId });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Registro não encontrado.", request_id: requestId });
    }
    if (err.code === "P2022") {
      return res.status(503).json({
        error:
          "Esquema da base de dados desatualizado (coluna em falta). Execute as migrações no servidor ou contacte o suporte.",
        request_id: requestId,
      });
    }
    console.error("[PRISMA]", err.code, err.message, err.meta);
  }

  console.error("[ERROR_TYPE]", err.constructor?.name);

  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Erro interno do servidor" : err.message,
    request_id: requestId,
  });
}
