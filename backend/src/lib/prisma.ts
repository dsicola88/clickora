import { PrismaClient } from "@prisma/client";
import { applyTenantSafeExtension } from "./tenantPrisma";

/**
 * Instância base única — usada por systemPrisma e prismaAdmin (sem filtro automático).
 * ⚠️ Só usar diretamente através dos exports nomeados; não exportar esta constante.
 */
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

/**
 * systemPrisma — operações sem contexto de tenant (auth, seeds, webhooks públicos, jobs, resolução explícita por id).
 * Deve sempre filtrar manualmente por userId/tenant quando aceder a dados de negócio.
 */
export const systemPrisma = basePrisma;

/**
 * prismaAdmin — mesmo motor que systemPrisma; usar **apenas** em rotas / controladores de administração global
 * (já protegidas por authenticate + requireRole). Não aplica isolamento por tenant por design.
 */
export const prismaAdmin = basePrisma;

/**
 * Cliente predefinido (tenant-safe): exige tenantId no ALS; injeta filtros; bloqueia raw SQL.
 * Usado em rotas com `tenantIsolation` após `authenticate`.
 */
const tenantPrisma = applyTenantSafeExtension(basePrisma);

export default tenantPrisma;
