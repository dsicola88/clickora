/**
 * Healthcheck R2 (não imprime secrets).
 * Uso: `cd backend && npx tsx scripts/r2-healthcheck.ts`
 * Com Railway: exportar R2_* ou `DATABASE_URL=…` não é preciso — só R2_*.
 */
import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function env(k: string) {
  return (process.env[k] ?? "").trim();
}

async function main() {
  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID") || env("R2_ACCESS_KEY");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY") || env("R2_SECRET");
  const bucket = env("R2_BUCKET");
  const publicBaseUrl = env("R2_PUBLIC_URL").replace(/\/+$/, "");

  const missing = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
    !bucket && "R2_BUCKET",
    !publicBaseUrl && "R2_PUBLIC_URL",
  ].filter(Boolean);
  if (missing.length) {
    console.error("Faltam:", missing.join(", "));
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  console.log(`bucket=${bucket}`);
  console.log(`public=${publicBaseUrl}`);

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("HeadBucket: OK");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("HeadBucket FAIL:", msg.slice(0, 240));
    console.error("Confirma que R2_BUCKET é exactamente o nome do bucket na Cloudflare (ex. dclickora).");
    process.exit(2);
  }

  const key = `healthcheck/clickora-r2-probe.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(`ok ${new Date().toISOString()}\n`),
      ContentType: "text/plain",
      CacheControl: "no-store",
    }),
  );
  console.log("PutObject: OK");
  console.log(`probe_url=${publicBaseUrl}/${key}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
