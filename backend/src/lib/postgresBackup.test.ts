import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertBackupKey,
  assertCustomDump,
  backupObjectKey,
  classifyBackupError,
  createMemoryBackupStore,
  lockIsActive,
  pgDumpMajor,
  planRetention,
  readBackupConfig,
  redactSecrets,
  restoreTargetBlockReason,
  runBackup,
  sha256Buffer,
  uploadVerifiedDump,
  verifyRemoteObject,
  versionsCompatible,
  type BackupStore,
} from "./postgresBackup";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function dumpBody(text = "ok"): Buffer {
  return Buffer.concat([Buffer.from("PGDMP"), Buffer.from(text)]);
}

describe("postgresBackup", () => {
  it("fica inativo sem credenciais e não fala com a loja", async () => {
    const result = await runBackup({ env: {}, store: createMemoryBackupStore() });
    assert.equal(result.status, "inactive");
    assert.equal(result.alert, "skipped");
  });

  it("recusa o bucket de media", () => {
    assert.throws(
      () =>
        readBackupConfig({
          DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:5432/clickora",
          BACKUP_R2_BUCKET: "media",
          BACKUP_R2_ACCOUNT_ID: "a",
          BACKUP_R2_ACCESS_KEY_ID: "b",
          BACKUP_R2_SECRET_ACCESS_KEY: "c",
          R2_BUCKET: "media",
        }),
      /bucket_igual_ao_de_media/,
    );
  });

  it("o nome leva a base, a hora UTC e a execução", () => {
    const key = backupObjectKey("clickora", new Date("2026-10-13T11:11:00.000Z"), "run-1");
    assert.equal(key, "postgres/clickora/20261013T111100Z-run1.dump");
    assert.throws(() => assertBackupKey("presell-mirror/a.png"), /chave_de_media/);
    assert.throws(() => assertBackupKey("branding/favicon.png"), /chave/);
  });

  it("confirma tamanho e checksum e rejeita um ficheiro que não é dump", async () => {
    const store = createMemoryBackupStore();
    const body = dumpBody("pagina");
    const sha = await uploadVerifiedDump(store, "postgres/clickora/a.dump", body);
    assert.equal(sha, sha256Buffer(body));
    assert.equal(verifyRemoteObject(body.length, sha, { size: body.length - 1, metadata: { sha256: sha } }), "tamanho");
    assert.equal(verifyRemoteObject(body.length, sha, { size: body.length, metadata: { sha256: "00" } }), "checksum");
    await assert.rejects(() => uploadVerifiedDump(store, "postgres/clickora/b.dump", Buffer.from("nao")), /formato_invalido/);
    assert.throws(() => assertCustomDump(Buffer.from("XXXX")), /formato_invalido/);
  });

  it("a retenção não apaga a última cópia válida", () => {
    const old = new Date("2026-01-01T00:00:00.000Z");
    const objects = [
      { key: "postgres/clickora/old.dump", size: 10, lastModified: old, sha256: "aa" },
      { key: "postgres/clickora/old.dump.sha256", size: 3, lastModified: old },
    ];
    const decision = planRetention(objects, new Date("2026-10-13T00:00:00.000Z"), 14);
    assert.deepEqual(decision.keep, ["postgres/clickora/old.dump"]);
    assert.deepEqual(decision.deleteKeys, []);
  });

  it("a retenção apaga cópias antigas quando sobra uma válida", () => {
    const now = new Date("2026-10-13T00:00:00.000Z");
    const fresh = new Date("2026-10-12T00:00:00.000Z");
    const old = new Date("2026-01-01T00:00:00.000Z");
    const decision = planRetention(
      [
        { key: "postgres/clickora/new.dump", size: 10, lastModified: fresh },
        { key: "postgres/clickora/new.dump.sha256", size: 3, lastModified: fresh },
        { key: "postgres/clickora/old.dump", size: 10, lastModified: old },
        { key: "postgres/clickora/old.dump.sha256", size: 3, lastModified: old },
        { key: "presell-mirror/a.png", size: 10, lastModified: old },
      ],
      now,
      14,
    );
    assert.deepEqual(decision.keep, ["postgres/clickora/new.dump"]);
    assert.deepEqual(decision.deleteKeys, ["postgres/clickora/old.dump", "postgres/clickora/old.dump.sha256"]);
  });

  it("não deixa duas execuções seguirem com o mesmo cadeado", async () => {
    const store = createMemoryBackupStore();
    await store.put({
      key: "postgres/_lock",
      body: Buffer.from(JSON.stringify({ runId: "other", expiresAt: new Date(Date.now() + 60_000).toISOString() })),
      contentType: "application/json",
    });
    const second = await runBackup({
      env: baseEnv(),
      store,
      runId: "bbbb",
      dump: async () => undefined,
    });
    assert.equal(second.status, "skipped_concurrent");
    assert.equal(lockIsActive({ runId: "aaaa", expiresAt: new Date(Date.now() + 60_000).toISOString() }, new Date(), "bbbb"), true);
  });

  it("um upload interrompido e credenciais inválidas ficam como falha sem segredos", async () => {
    const store = createMemoryBackupStore();
    const broken: BackupStore = {
      ...store,
      async put(args) {
        if (args.key.endsWith(".dump")) throw new Error("ECONNRESET");
        return store.put(args);
      },
    };
    const failed = await runBackup({
      env: { ...baseEnv(), BACKUP_ALERT_WEBHOOK_URL: "" },
      store: broken,
      dump: async (outPath) => {
        fs.writeFileSync(outPath, dumpBody("x"));
      },
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.error_code, "rede");
    assert.equal(classifyBackupError(new Error("InvalidAccessKeyId")), "credenciais");
    const logged = redactSecrets("postgresql://postgres:supersecret@host/db password=supersecret", ["supersecret"]);
    assert.equal(logged.includes("supersecret"), false);
  });

  it("checksum errado depois do upload falha e não conta como cópia válida", async () => {
    const store = createMemoryBackupStore();
    const original = store.head.bind(store);
    store.head = async (key) => {
      const found = await original(key);
      if (!found || !key.endsWith(".dump")) return found;
      return { size: found.size, metadata: { sha256: "ff" } };
    };
    const result = await runBackup({
      env: baseEnv(),
      store,
      dump: async (outPath) => {
        fs.writeFileSync(outPath, dumpBody("y"));
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.error_code, "checksum");
    assert.equal(store.keys().some((key) => key.endsWith(".dump.sha256")), false);
  });

  it("a falha do backup não é um arranque da API", () => {
    const server = fs.readFileSync(path.join(root, "src/server.ts"), "utf8");
    const start = fs.readFileSync(path.join(root, "scripts/start-production.sh"), "utf8");
    assert.equal(server.includes("postgres-backup"), false);
    assert.equal(server.includes("postgresBackup"), false);
    assert.equal(start.includes("postgres-backup"), false);
  });

  it("o restauro recusa a Railway e uma URL igual à origem", () => {
    assert.equal(restoreTargetBlockReason("postgresql://u:p@gondola.proxy.rlwy.net:28682/railway"), "destino_de_producao");
    assert.equal(
      restoreTargetBlockReason("postgresql://u:p@127.0.0.1:5432/a", "postgresql://u:p@127.0.0.1:5432/a"),
      "igual_a_origem",
    );
    assert.equal(restoreTargetBlockReason("postgresql://u:p@127.0.0.1:5432/isolada"), null);
    assert.equal(pgDumpMajor("pg_dump (PostgreSQL) 14.22"), 14);
    assert.equal(versionsCompatible(14, 16), false);
    assert.equal(versionsCompatible(16, 16), true);
  });
});

function baseEnv(): NodeJS.ProcessEnv {
  return {
    BACKUP_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:5432/clickora",
    BACKUP_R2_BUCKET: "backups",
    BACKUP_R2_ACCOUNT_ID: "account",
    BACKUP_R2_ACCESS_KEY_ID: "key",
    BACKUP_R2_SECRET_ACCESS_KEY: "secret-value",
    R2_BUCKET: "media",
    BACKUP_MIN_FREE_BYTES: "1",
  };
}
