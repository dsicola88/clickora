/**
 * Uma execução. Não é importado pela API.
 * Sai 0 quando está inativo ou quando outro backup ainda corre.
 * Sai 1 só quando um backup configurado falha.
 */
import { createR2BackupStore } from "../src/lib/postgresBackupR2";
import { readBackupConfig, runBackup } from "../src/lib/postgresBackup";

async function main() {
  let config: ReturnType<typeof readBackupConfig> = null;
  try {
    config = readBackupConfig();
  } catch {
    config = null;
    const result = await runBackup({ env: process.env });
    process.exit(result.status === "failed" ? 1 : 0);
  }
  const result = await runBackup({
    env: process.env,
    store: config ? createR2BackupStore(config) : undefined,
  });
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch(() => {
  process.exit(1);
});
