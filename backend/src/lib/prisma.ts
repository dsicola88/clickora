import { PrismaClient } from "@prisma/client";
import { applyTenantSafeExtension } from "./tenantPrisma";

const forceQuietPrismaLog =
  process.env.QUIET_PRISMA === "1" || process.env.QUIET_PRISMA === "true";
/** Em dev, sem isto o consola fica cheia de `prisma:error` quando o Postgres está offline (ex. Railway inacessível). */
const prismaDevVerbose =
  process.env.PRISMA_DEV_VERBOSE === "1" || process.env.PRISMA_DEV_VERBOSE === "true";

function prismaLogOptions(): ("query" | "info" | "warn" | "error")[] {
  if (forceQuietPrismaLog) return [];
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    return prismaDevVerbose ? ["query", "error", "warn"] : [];
  }
  return ["error"];
}

/**
 * Aumenta o pool Prisma quando a URL não declara connection_limit.
 * Sob carga (analytics + creates concorrentes) o default (~CPUs*2+1) esgota e gera 5xx.
 * Override: PRISMA_CONNECTION_LIMIT=N ou ?connection_limit= na DATABASE_URL.
 */
export function databaseUrlWithPool(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit")) {
      const n = Math.max(
        5,
        Math.min(50, Number(process.env.PRISMA_CONNECTION_LIMIT || "25") || 25),
      );
      u.searchParams.set("connection_limit", String(n));
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT || "20");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Instância base única — usada por systemPrisma e prismaAdmin (sem filtro automático).
 * ⚠️ Só usar diretamente através dos exports nomeados; não exportar esta constante.
 *
 * - **Local (`npm run dev`, NODE_ENV vazio ou ≠ production):** sem logs do motor por defeito.
 * - **`QUIET_PRISMA=1`:** força silêncio total do motor (também em produção). Erros de rotas Express não são afectados.
 */
const basePrisma = new PrismaClient({
  log: prismaLogOptions(),
  datasources: {
    db: { url: databaseUrlWithPool(process.env.DATABASE_URL) },
  },
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
