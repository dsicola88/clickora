import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Prefixo exclusivo. Não coincide com presell-mirror, branding, avatars nem healthcheck. */
export const BACKUP_KEY_PREFIX = "postgres/";

const MEDIA_PREFIXES = ["presell-mirror/", "presell-builder/", "branding/", "avatars/", "healthcheck/"];

export type BackupConfig = {
  databaseUrl: string;
  databaseName: string;
  bucket: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  retentionDays: number;
  maxBytes: number;
  minFreeBytes: number;
  lockTtlMs: number;
  alertWebhookUrl: string | null;
  pgDumpBin: string;
  pgRestoreBin: string;
};

export type BackupObject = {
  key: string;
  size: number;
  lastModified?: Date;
  sha256?: string;
};

export type BackupStore = {
  put(args: {
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
    ifNoneMatch?: boolean;
  }): Promise<"created" | "exists">;
  head(key: string): Promise<{ size: number; metadata: Record<string, string> } | null>;
  get(key: string): Promise<Buffer | null>;
  list(prefix: string): Promise<BackupObject[]>;
  delete(key: string): Promise<void>;
};

export type BackupResult = {
  status: "inactive" | "skipped_concurrent" | "ok" | "failed";
  backup_id: string | null;
  duration_ms: number;
  error_code: string | null;
  alert: "sent" | "unconfigured" | "failed" | "skipped";
};

const RAILWAY_HOST = /(^|\.)rlwy\.net$|(^|\.)railway\.app$/i;

export function parseDatabaseName(databaseUrl: string): string {
  const name = new URL(databaseUrl).pathname.replace(/^\//, "").split("/")[0] || "db";
  return /^[A-Za-z0-9_-]{1,63}$/.test(name) ? name : "db";
}

export function readBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig | null {
  const databaseUrl = (env.BACKUP_DATABASE_URL || env.DATABASE_URL || "").trim();
  const bucket = (env.BACKUP_R2_BUCKET || "").trim();
  const accountId = (env.BACKUP_R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (env.BACKUP_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.BACKUP_R2_SECRET_ACCESS_KEY || "").trim();
  if (!databaseUrl || !bucket || !accountId || !accessKeyId || !secretAccessKey) return null;
  const mediaBucket = (env.R2_BUCKET || "").trim();
  if (mediaBucket && mediaBucket === bucket) {
    throw new Error("bucket_igual_ao_de_media");
  }
  let databaseName = "db";
  try {
    databaseName = parseDatabaseName(databaseUrl);
  } catch {
    throw new Error("database_url_invalida");
  }
  const retentionDays = positiveInt(env.BACKUP_RETENTION_DAYS, 14);
  const maxBytes = positiveInt(env.BACKUP_MAX_BYTES, 2 * 1024 * 1024 * 1024);
  const minFreeBytes = positiveInt(env.BACKUP_MIN_FREE_BYTES, 512 * 1024 * 1024);
  const lockTtlMs = positiveInt(env.BACKUP_LOCK_TTL_MS, 3 * 60 * 60 * 1000);
  const alertWebhookUrl = (env.BACKUP_ALERT_WEBHOOK_URL || "").trim() || null;
  return {
    databaseUrl,
    databaseName,
    bucket,
    accountId,
    accessKeyId,
    secretAccessKey,
    retentionDays,
    maxBytes,
    minFreeBytes,
    lockTtlMs,
    alertWebhookUrl,
    pgDumpBin: (env.BACKUP_PG_DUMP_BIN || "pg_dump").trim(),
    pgRestoreBin: (env.BACKUP_PG_RESTORE_BIN || "pg_restore").trim(),
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function backupObjectKey(databaseName: string, at: Date, runId: string): string {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const safeRun = runId.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "run";
  const safeDb = databaseName.replace(/[^A-Za-z0-9_-]/g, "") || "db";
  return `${BACKUP_KEY_PREFIX}${safeDb}/${stamp}-${safeRun}.dump`;
}

export function assertBackupKey(key: string): void {
  for (const prefix of MEDIA_PREFIXES) {
    if (key.startsWith(prefix)) throw new Error("chave_de_media");
  }
  if (!key.startsWith(BACKUP_KEY_PREFIX) || key.includes("..") || key.includes("//")) {
    throw new Error("chave_recusada");
  }
}

export function sha256Buffer(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function redactSecrets(text: string, secrets: string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join("[redacted]");
  }
  out = out.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://[redacted]");
  out = out.replace(/([?&](?:password|secret|token)=)[^&\s]+/gi, "$1[redacted]");
  return out;
}

export function pgDumpMajor(versionText: string): number | null {
  const match = versionText.match(/(\d+)\.\d+/);
  return match ? Number(match[1]) : null;
}

export function versionsCompatible(dumpMajor: number, serverMajor: number): boolean {
  return dumpMajor >= serverMajor;
}

export function assertCustomDump(body: Buffer): void {
  if (body.subarray(0, 5).toString("utf8") !== "PGDMP") {
    throw new Error("formato_invalido");
  }
}

export function verifyRemoteObject(
  localSize: number,
  localSha: string,
  remote: { size: number; metadata: Record<string, string> } | null,
): string | null {
  if (!remote) return "objeto_ausente";
  if (remote.size !== localSize) return "tamanho";
  const remoteSha = (remote.metadata.sha256 || "").toLowerCase();
  if (remoteSha !== localSha.toLowerCase()) return "checksum";
  return null;
}

export function planRetention(objects: BackupObject[], now: Date, retentionDays: number): { keep: string[]; deleteKeys: string[] } {
  const sidecars = new Set(objects.filter((item) => item.key.endsWith(".dump.sha256")).map((item) => item.key));
  const valid = objects.filter(
    (item) =>
      item.key.startsWith(BACKUP_KEY_PREFIX) &&
      item.key.endsWith(".dump") &&
      !item.key.includes("/_") &&
      item.size > 0 &&
      sidecars.has(`${item.key}.sha256`),
  );
  valid.sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0));
  if (valid.length === 0) return { keep: [], deleteKeys: [] };
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  const newest = valid[0]!;
  const keep = new Set<string>();
  const deleteKeys: string[] = [];
  for (const item of valid) {
    const fresh = (item.lastModified?.getTime() ?? 0) >= cutoff;
    if (fresh || item.key === newest.key) keep.add(item.key);
    else deleteKeys.push(item.key, `${item.key}.sha256`);
  }
  if (keep.size === 0) return { keep: [newest.key], deleteKeys: [] };
  return { keep: [...keep], deleteKeys };
}

export function lockIsActive(lock: { runId: string; expiresAt: string } | null, now: Date, myRunId: string): boolean {
  if (!lock || lock.runId === myRunId) return false;
  const expires = new Date(lock.expiresAt).getTime();
  return Number.isFinite(expires) && expires > now.getTime();
}

export function restoreTargetBlockReason(restoreUrl: string, sourceUrl?: string): string | null {
  let host = "";
  try {
    host = new URL(restoreUrl).hostname;
  } catch {
    return "url_invalida";
  }
  if (RAILWAY_HOST.test(host)) return "destino_de_producao";
  if (sourceUrl && restoreUrl.trim() === sourceUrl.trim()) return "igual_a_origem";
  const local = host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (!local && process.env.BACKUP_ALLOW_REMOTE_RESTORE !== "1") return "so_base_isolada";
  return null;
}

export function classifyBackupError(error: unknown): string {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/403|AccessDenied|InvalidAccessKey|SignatureDoesNotMatch|credencial/i.test(message)) return "credenciais";
  if (/ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|socket/i.test(message)) return "rede";
  const integrity = message.match(/tamanho|checksum|objeto_ausente/);
  if (integrity) return integrity[0];
  const known = message.match(/pg_dump_ausente|versao_incompativel|sem_espaco|dump_grande|formato_invalido|bucket_igual_ao_de_media/);
  if (known) return known[0];
  return "falha";
}

export function createMemoryBackupStore(): BackupStore & { keys(): string[] } {
  const objects = new Map<string, { body: Buffer; metadata: Record<string, string> }>();
  return {
    keys: () => [...objects.keys()],
    async put(args) {
      assertBackupKey(args.key);
      if (args.ifNoneMatch && objects.has(args.key)) return "exists";
      objects.set(args.key, { body: Buffer.from(args.body), metadata: { ...(args.metadata ?? {}) } });
      return "created";
    },
    async head(key) {
      const found = objects.get(key);
      if (!found) return null;
      return { size: found.body.length, metadata: found.metadata };
    },
    async get(key) {
      const found = objects.get(key);
      return found ? Buffer.from(found.body) : null;
    },
    async list(prefix) {
      return [...objects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          size: value.body.length,
          sha256: value.metadata.sha256,
          lastModified: new Date(),
        }));
    },
    async delete(key) {
      assertBackupKey(key);
      objects.delete(key);
    },
  };
}

export async function uploadVerifiedDump(store: BackupStore, key: string, body: Buffer): Promise<string> {
  assertBackupKey(key);
  assertCustomDump(body);
  const sha256 = sha256Buffer(body);
  await store.put({
    key,
    body,
    contentType: "application/octet-stream",
    metadata: { sha256 },
  });
  const head = await store.head(key);
  const problem = verifyRemoteObject(body.length, sha256, head);
  if (problem) throw new Error(problem);
  const downloaded = await store.get(key);
  if (!downloaded || sha256Buffer(downloaded) !== sha256) throw new Error("checksum");
  await store.put({
    key: `${key}.sha256`,
    body: Buffer.from(`${sha256}\n`),
    contentType: "text/plain",
    metadata: { sha256 },
  });
  return sha256;
}

export function hasEnoughFreeSpace(dir: string, minFreeBytes: number): boolean {
  try {
    const stats = fs.statfsSync(dir);
    return stats.bavail * stats.bsize >= minFreeBytes;
  } catch {
    return true;
  }
}

export async function notifyBackup(
  webhookUrl: string | null,
  payload: { ok: boolean; backup_id: string | null; duration_ms: number; error_code: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "unconfigured" | "failed"> {
  if (!webhookUrl) return "unconfigured";
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function dumpDatabase(args: {
  bin: string;
  databaseUrl: string;
  outPath: string;
  maxBytes: number;
}): Promise<void> {
  const url = new URL(args.databaseUrl);
  const password = decodeURIComponent(url.password);
  const port = url.port || "5432";
  const database = parseDatabaseName(args.databaseUrl);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      args.bin,
      ["-Fc", "--no-owner", "--no-acl", "--no-password", "-h", url.hostname, "-p", port, "-U", decodeURIComponent(url.username), "-d", database, "-f", args.outPath],
      {
        env: {
          ...process.env,
          PGPASSWORD: password,
          PGSSLMODE: url.hostname === "127.0.0.1" || url.hostname === "localhost" ? "disable" : "require",
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    const timer = setInterval(() => {
      try {
        if (fs.existsSync(args.outPath) && fs.statSync(args.outPath).size > args.maxBytes) {
          child.kill("SIGKILL");
        }
      } catch {
        /* o ficheiro ainda não existe */
      }
    }, 400);
    child.stderr?.on("data", (chunk) => {
      stderr = redactSecrets(`${stderr}${chunk.toString()}`, [password, args.databaseUrl]).slice(0, 500);
    });
    child.on("error", (error) => {
      clearInterval(timer);
      reject(new Error(error.code === "ENOENT" ? "pg_dump_ausente" : "falha"));
    });
    child.on("close", (code) => {
      clearInterval(timer);
      if (code === 0) {
        const size = fs.statSync(args.outPath).size;
        if (size > args.maxBytes) {
          fs.rmSync(args.outPath, { force: true });
          reject(new Error("dump_grande"));
          return;
        }
        resolve();
        return;
      }
      fs.rmSync(args.outPath, { force: true });
      reject(new Error(stderr ? "falha" : "falha"));
    });
  });
}

export async function runBackup(args: {
  env?: NodeJS.ProcessEnv;
  store?: BackupStore;
  now?: Date;
  runId?: string;
  dump?: (outPath: string) => Promise<void>;
  fetchImpl?: typeof fetch;
}): Promise<BackupResult> {
  const started = Date.now();
  const now = args.now ?? new Date();
  const runId = args.runId ?? randomUUID();
  let config: BackupConfig | null = null;
  try {
    config = readBackupConfig(args.env ?? process.env);
  } catch (error) {
    return finish(config, started, null, "failed", classifyBackupError(error), args.fetchImpl);
  }
  if (!config) return finish(null, started, null, "inactive", null, args.fetchImpl);

  const store = args.store;
  if (!store) return finish(config, started, null, "failed", "store_ausente", args.fetchImpl);
  const backupId = backupObjectKey(config.databaseName, now, runId);
  const lockKey = `${BACKUP_KEY_PREFIX}_lock`;
  try {
    const existingLock = await store.get(lockKey);
    const parsed = existingLock ? (JSON.parse(existingLock.toString("utf8")) as { runId: string; expiresAt: string }) : null;
    if (lockIsActive(parsed, now, runId)) {
      return finish(config, started, null, "skipped_concurrent", null, args.fetchImpl);
    }
    const lockPut = await store.put({
      key: lockKey,
      body: Buffer.from(JSON.stringify({ runId, expiresAt: new Date(now.getTime() + config.lockTtlMs).toISOString() })),
      contentType: "application/json",
      ifNoneMatch: !parsed,
    });
    if (lockPut === "exists") return finish(config, started, null, "skipped_concurrent", null, args.fetchImpl);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clickora-backup-"));
    const outPath = path.join(dir, "dump.dump");
    try {
      if (!hasEnoughFreeSpace(dir, config.minFreeBytes)) throw new Error("sem_espaco");
      if (args.dump) await args.dump(outPath);
      else await dumpDatabase({ bin: config.pgDumpBin, databaseUrl: config.databaseUrl, outPath, maxBytes: config.maxBytes });
      const body = fs.readFileSync(outPath);
      await uploadVerifiedDump(store, backupId, body);
      const listed = await store.list(BACKUP_KEY_PREFIX);
      const decision = planRetention(listed, now, config.retentionDays);
      for (const key of decision.deleteKeys) {
        assertBackupKey(key);
        if (key === backupId || key === `${backupId}.sha256` || key === lockKey) continue;
        await store.delete(key);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      await store.delete(lockKey).catch(() => undefined);
    }
    return finish(config, started, backupId, "ok", null, args.fetchImpl);
  } catch (error) {
    await store.delete(lockKey).catch(() => undefined);
    return finish(config, started, backupId, "failed", classifyBackupError(error), args.fetchImpl);
  }
}

async function finish(
  config: BackupConfig | null,
  started: number,
  backupId: string | null,
  status: BackupResult["status"],
  errorCode: string | null,
  fetchImpl?: typeof fetch,
): Promise<BackupResult> {
  const duration_ms = Date.now() - started;
  const alert =
    status === "inactive" || status === "skipped_concurrent"
      ? "skipped"
      : await notifyBackup(
          config?.alertWebhookUrl ?? null,
          { ok: status === "ok", backup_id: backupId, duration_ms, error_code: errorCode },
          fetchImpl,
        );
  const line = JSON.stringify({ backup: status, backup_id: backupId, duration_ms, error_code: errorCode, alert });
  console.log(redactSecrets(line));
  return { status, backup_id: backupId, duration_ms, error_code: errorCode, alert };
}
