/**
 * Lista variáveis críticas em falta (produção).
 * Use em health checks ou na documentação de arranque; não bloqueia o build.
 */
export function getMissingCriticalEnvInProduction(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL");
  }
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    missing.push("AUTH_SECRET (mínimo 16 caracteres)");
  }
  return missing;
}
