/**
 * Guardas partilhadas para scripts de carga / limpeza.
 * Regra: nunca Railway, nunca dclickora.com produção, nunca mutações sem BD local.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BLOCKED_HOST_SNIPPETS = [
  "railway",
  "rlwy.net",
  "dclickora.com",
  "vercel.app",
  "amazonaws.com",
  "neon.tech",
  "supabase.co",
] as const;

export type LoadTargetKind = "health_only" | "mutating";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const fromFile = parseEnvFile(resolve(process.cwd(), ".env")).DATABASE_URL;
  return (fromFile || "").trim();
}

export function databaseHostInfo(url = resolveDatabaseUrl()): {
  host: string;
  port: string;
  isLocal: boolean;
  blocked: boolean;
} {
  if (!url) return { host: "", port: "", isLocal: false, blocked: true };
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const blocked = BLOCKED_HOST_SNIPPETS.some((s) => host.includes(s));
    const isLocal = host === "127.0.0.1" || host === "localhost";
    return { host, port: u.port || "5432", isLocal, blocked };
  } catch {
    return { host: "", port: "", isLocal: false, blocked: true };
  }
}

export function assertSafeHttpTarget(baseUrl: string, kind: LoadTargetKind = "health_only"): URL {
  if (!baseUrl?.trim()) {
    throw new Error("Defina LOAD_TEST_BASE_URL (ex.: http://127.0.0.1:3001)");
  }
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error("LOAD_TEST_BASE_URL inválido");
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST_SNIPPETS.some((s) => host.includes(s)) || host === "0.0.0.0") {
    throw new Error(`Alvo HTTP bloqueado por segurança: ${host}`);
  }
  const local = host === "127.0.0.1" || host === "localhost";
  if (!local && process.env.ALLOW_LOAD_TEST !== "1") {
    throw new Error(
      "Host HTTP não local: defina ALLOW_LOAD_TEST=1 apenas em staging dedicado com dados fictícios.",
    );
  }
  if (kind === "mutating") {
    assertLocalDatabaseForMutations();
    if (process.env.ALLOW_MUTATING_LOAD_TEST !== "1") {
      throw new Error(
        "Mutações de carga exigem ALLOW_MUTATING_LOAD_TEST=1 + DATABASE_URL localhost (nunca Railway).",
      );
    }
  }
  return u;
}

/** Scripts Prisma (cleanup / raise limits) — só localhost. */
export function assertLocalDatabaseForMutations(): void {
  const info = databaseHostInfo();
  if (!info.host) {
    throw new Error("DATABASE_URL em falta — recusado.");
  }
  if (info.blocked || !info.isLocal) {
    throw new Error(
      `DATABASE_URL bloqueada para mutações de carga: host=${info.host}. ` +
        "Use Postgres local (ex. localhost:5434) ou staging dedicado — nunca Railway/produção.",
    );
  }
}

export function assertHealthOnlyOk(): void {
  // Health pode correr contra API local mesmo se a API estiver mal apontada;
  // documentamos o risco no relatório. Não bloqueamos health por DATABASE_URL.
}
