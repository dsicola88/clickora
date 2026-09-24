import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** URL pública do bucket (custom domain ou `https://pub-….r2.dev`), sem barra final. */
  publicBaseUrl: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null | undefined;

function trimEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

/** Lê config R2. Devolve null se incompleta (dev local sem cloud). */
export function getR2Config(): R2Config | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const accountId = trimEnv("R2_ACCOUNT_ID");
  /** Aliases curtos aceites (painéis tipo Railway). */
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID") || trimEnv("R2_ACCESS_KEY");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY") || trimEnv("R2_SECRET");
  const bucket = trimEnv("R2_BUCKET");
  const publicBaseUrl = trimEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    cachedConfig = null;
    return null;
  }
  cachedConfig = { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
  return cachedConfig;
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/** Log de arranque — deixa claro se media vai para R2 ou disco. Em produção R2 é obrigatório. */
export function logR2EnvStatus(): void {
  if (isR2Configured()) {
    const cfg = getR2Config()!;
    console.info(
      `[r2] Media (presell, branding, landing, avatars) → bucket «${cfg.bucket}» · público ${cfg.publicBaseUrl}`,
    );
    return;
  }
  const isProd =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RENDER) ||
    process.env.FORCE_R2_REQUIRED === "1";
  if (isProd) {
    if (process.env.ALLOW_DISK_MEDIA === "1") {
      console.error(
        "[r2] R2 incompleto mas ALLOW_DISK_MEDIA=1 — a arrancar com disco local (não recomendado).",
      );
    } else {
      console.error(
        "[r2] FATAL: R2 incompleto em produção. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL. Media em disco local perde-se no redeploy. (escape: ALLOW_DISK_MEDIA=1)",
      );
      process.exit(1);
    }
  } else {
    console.warn(
      "[r2] R2 incompleto ou ausente — media fica em disco local (uploads/). Em produção define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.",
    );
  }
}

function getR2Client(): S3Client {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error("Cloudflare R2 não está configurado (R2_*).");
  }
  if (cachedClient) return cachedClient;
  /**
   * R2 ainda não implementa CRC32 flexível do AWS SDK ≥3.729 — sem WHEN_REQUIRED o PutObject falha com 501.
   * @see https://community.cloudflare.com/t/aws-sdk-client-s3-v3-729-0-breaks-uploadpart-and-putobject-r2-s3-api-compatibility/758637
   */
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

export function r2PublicUrl(objectKey: string): string {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error("Cloudflare R2 não está configurado (R2_*).");
  }
  const key = objectKey.replace(/^\/+/, "");
  return `${cfg.publicBaseUrl}/${key}`;
}

export async function putR2Object(args: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error("Cloudflare R2 não está configurado (R2_*).");
  }
  const key = args.key.replace(/^\/+/, "");
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: args.body,
      ContentType: args.contentType,
      CacheControl: args.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return { key, url: r2PublicUrl(key) };
}
