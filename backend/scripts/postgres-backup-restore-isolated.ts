/**
 * Restauro real numa Postgres descartável. Não usa a Railway.
 * Exige a imagem local postgres:16-alpine. Não faz pull.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sha256Buffer, uploadVerifiedDump, createMemoryBackupStore, assertCustomDump } from "../src/lib/postgresBackup";

const SRC = "clickora-backup-src";
const DST = "clickora-backup-dst";

function sh(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args[0]} ${result.status} ${(result.stderr || "").slice(0, 240)}`);
  }
  return result.stdout;
}

async function main() {
  const image = spawnSync("docker", ["image", "inspect", "postgres:16-alpine"], { encoding: "utf8" });
  if (image.status !== 0) {
    console.log("RESTORE_PENDING imagem postgres:16-alpine ausente");
    process.exit(2);
  }
  spawnSync("docker", ["rm", "-f", SRC, DST], { encoding: "utf8" });
  sh("docker", ["run", "-d", "--name", SRC, "--pull", "never", "-e", "POSTGRES_PASSWORD=e2e", "-e", "POSTGRES_USER=postgres", "-e", "POSTGRES_DB=clickora_backup", "-p", "127.0.0.1:55434:5432", "postgres:16-alpine"]);
  sh("docker", ["run", "-d", "--name", DST, "--pull", "never", "-e", "POSTGRES_PASSWORD=e2e", "-e", "POSTGRES_USER=postgres", "-e", "POSTGRES_DB=clickora_restore", "-p", "127.0.0.1:55435:5432", "postgres:16-alpine"]);
  for (const name of [SRC, DST]) {
    for (let i = 0; i < 30; i++) {
      const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
      if (ready.status === 0) break;
      if (i === 29) throw new Error(`postgres ${name} não arrancou`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  sh("docker", ["exec", SRC, "psql", "-U", "postgres", "-d", "clickora_backup", "-c", "CREATE TABLE backup_probe (id int primary key, note text); INSERT INTO backup_probe VALUES (1, 'isolado');"]);
  sh("docker", ["exec", SRC, "pg_dump", "-Fc", "-U", "postgres", "-d", "clickora_backup", "-f", "/tmp/probe.dump"]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clickora-restore-"));
  const file = path.join(dir, "probe.dump");
  sh("docker", ["cp", `${SRC}:/tmp/probe.dump`, file]);
  const body = fs.readFileSync(file);
  assertCustomDump(body);
  const version = sh("docker", ["exec", SRC, "pg_dump", "--version"]);
  if (!/ 16\./.test(version)) throw new Error(`pg_dump inesperado: ${version.trim()}`);
  const store = createMemoryBackupStore();
  const sha = await uploadVerifiedDump(store, "postgres/clickora_backup/probe.dump", body);
  fs.writeFileSync(`${file}.sha256`, `${sha}\n`);
  sh("docker", ["cp", file, `${DST}:/tmp/probe.dump`]);
  sh("docker", ["exec", DST, "pg_restore", "--no-owner", "--no-acl", "--exit-on-error", "-U", "postgres", "-d", "clickora_restore", "/tmp/probe.dump"]);
  const note = sh("docker", ["exec", DST, "psql", "-U", "postgres", "-d", "clickora_restore", "-tAc", "SELECT note FROM backup_probe"]);
  if (note.trim() !== "isolado") throw new Error(`valor inesperado: ${note.trim()}`);
  if (sha256Buffer(fs.readFileSync(file)) !== sha) throw new Error("checksum local mudou");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ restore: "ok", sha256: sha, bytes: body.length, pg_dump: version.trim() }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "falha");
    process.exit(1);
  })
  .finally(() => {
    spawnSync("docker", ["rm", "-f", SRC, DST], { encoding: "utf8" });
  });
