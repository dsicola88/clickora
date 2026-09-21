/**
 * Migra ficheiros locais `uploads/presell-builder/` para Cloudflare R2.
 * Uso (com R2_* no env): `cd backend && npx tsx scripts/migrate-presell-builder-to-r2.ts`
 * URLs antigas `/api/public/presell-builder/…` passam a redireccionar para R2 se o ficheiro
 * local já não existir (ver getBuilderMediaFile).
 */
import fs from "fs";
import path from "path";
import { getPresellBuilderMediaDir, isSafeBuilderMediaFilename, builderMediaObjectKey } from "../src/lib/presellBuilderMediaUpload";
import { isR2Configured, putR2Object } from "../src/lib/r2Storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function main() {
  if (!isR2Configured()) {
    console.error("Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL");
    process.exit(1);
  }
  const root = getPresellBuilderMediaDir();
  if (!fs.existsSync(root)) {
    console.log("Nada a migrar — pasta inexistente:", root);
    return;
  }
  let ok = 0;
  let skip = 0;
  for (const userId of fs.readdirSync(root)) {
    const userDir = path.join(root, userId);
    if (!fs.statSync(userDir).isDirectory()) continue;
    for (const name of fs.readdirSync(userDir)) {
      if (!isSafeBuilderMediaFilename(name)) {
        skip += 1;
        continue;
      }
      const ext = path.extname(name).slice(1).toLowerCase();
      const contentType = MIME[ext] ?? "application/octet-stream";
      const body = fs.readFileSync(path.join(userDir, name));
      const { url } = await putR2Object({
        key: builderMediaObjectKey(userId, name),
        body,
        contentType,
      });
      console.log("OK", url);
      ok += 1;
    }
  }
  console.log(`Migrados: ${ok}; ignorados: ${skip}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
