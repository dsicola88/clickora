/**
 * Restaura um dump custom (pg_restore) numa base isolada.
 * Recusa hosts da Railway e uma URL igual à origem.
 *
 *   RESTORE_DATABASE_URL=postgresql://postgres:e2e@127.0.0.1:55434/clickora_restore \
 *   BACKUP_FILE=/caminho/backup.dump \
 *   npx tsx scripts/postgres-restore-from-r2.ts
 *
 * Ou, com o sidecar .sha256 ao lado do ficheiro, a integridade é confirmada antes do pg_restore.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertCustomDump,
  pgDumpMajor,
  redactSecrets,
  restoreTargetBlockReason,
  sha256Buffer,
  versionsCompatible,
} from "../src/lib/postgresBackup";

const ESSENTIAL = (process.env.RESTORE_EXPECT_TABLES || "users,plans,presell_pages,subscriptions")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function run(bin: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", (error) => reject(error.code === "ENOENT" ? new Error("pg_restore_ausente") : error));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

async function main() {
  const restoreUrl = (process.env.RESTORE_DATABASE_URL || "").trim();
  const sourceUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || "").trim();
  const filePath = (process.env.BACKUP_FILE || "").trim();
  const blocked = restoreTargetBlockReason(restoreUrl, sourceUrl || undefined);
  if (blocked) throw new Error(blocked);
  if (!filePath) throw new Error("ficheiro_ausente");

  const body = fs.readFileSync(filePath);
  assertCustomDump(body);
  const actual = sha256Buffer(body);
  const sidecar = `${filePath}.sha256`;
  if (fs.existsSync(sidecar)) {
    const expected = fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0]?.toLowerCase();
    if (expected && expected !== actual) throw new Error("checksum");
  }

  const restoreBin = (process.env.BACKUP_PG_RESTORE_BIN || "pg_restore").trim();
  const version = await run(restoreBin, ["--version"], process.env);
  const major = pgDumpMajor(version.stdout);
  const serverMajor = Number(process.env.RESTORE_SERVER_MAJOR || "18");
  if (major != null && !versionsCompatible(major, serverMajor)) throw new Error("versao_incompativel");

  const url = new URL(restoreUrl);
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.hostname === "127.0.0.1" || url.hostname === "localhost" ? "disable" : "require",
  };
  const conn = ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", url.pathname.replace(/^\//, "")];
  const restored = await run(restoreBin, ["--no-owner", "--no-acl", "--exit-on-error", ...conn, filePath], env);
  if (restored.code !== 0) throw new Error("restauro_falhou");

  const psql = (process.env.BACKUP_PSQL_BIN || "psql").trim();
  const listed = await run(psql, [...conn, "-tAc", "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"], env);
  if (listed.code !== 0) throw new Error("validacao_falhou");
  const tables = new Set(listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean));
  const missing = ESSENTIAL.filter((table) => !tables.has(table));
  if (missing.length) throw new Error("tabelas_em_falta");

  console.log(JSON.stringify({ restore: "ok", bytes: body.length, sha256: actual, tables: ESSENTIAL.length }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "falha";
  console.error(JSON.stringify({ restore: "failed", error_code: redactSecrets(message).split(/\s+/)[0] }));
  process.exit(1);
});
