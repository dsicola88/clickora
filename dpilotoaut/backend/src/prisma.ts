import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

/** Evita que `findMany` / login fiquem minutos a pendurar se o Postgres não estiver acessível. */
function withPostgresConnectTimeout(url: string, seconds: number): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return url;
    if (!u.searchParams.has("connect_timeout"))
      u.searchParams.set("connect_timeout", String(seconds));
    return u.toString();
  } catch {
    return url;
  }
}

/** Raiz do repo a partir de `backend/src` (código fonte) ou, no bundle SSR, procura ficheiros `.env`. */
function findEnvFile(): string | undefined {
  const fromSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", ".env");
  if (existsSync(fromSource)) return fromSource;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const p = path.join(dir, ".env");
    if (existsSync(p)) return p;
    if (path.basename(dir) === "backend") {
      const up = path.join(dir, "..", ".env");
      if (existsSync(up)) return up;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const envPath = findEnvFile();
if (envPath) {
  config({ path: envPath });
}

if (process.env.NODE_ENV === "development" && process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (u.username === "USER" || u.password === "PASSWORD") {
      console.warn(
        "[prisma] DATABASE_URL ainda tem o placeholder (USER/PASSWORD). No ficheiro .env na raiz do projeto, use o utilizador e palavra-passe reais do PostgreSQL.",
      );
    }
  } catch {
    /* URL inválido */
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const databaseUrl = process.env.DATABASE_URL
  ? withPostgresConnectTimeout(process.env.DATABASE_URL, 12)
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl && { datasources: { db: { url: databaseUrl } } }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
