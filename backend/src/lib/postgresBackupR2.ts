import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BackupConfig, BackupStore } from "./postgresBackup";
import { assertBackupKey } from "./postgresBackup";

export function createR2BackupStore(config: Pick<BackupConfig, "accountId" | "accessKeyId" | "secretAccessKey" | "bucket">): BackupStore {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async put(args) {
      assertBackupKey(args.key);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: args.key,
            Body: args.body,
            ContentType: args.contentType,
            Metadata: args.metadata,
            ...(args.ifNoneMatch ? { IfNoneMatch: "*" } : {}),
          }),
        );
        return "created";
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 412) return "exists";
        throw error;
      }
    },
    async head(key) {
      assertBackupKey(key);
      try {
        const found = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return { size: Number(found.ContentLength ?? 0), metadata: found.Metadata ?? {} };
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },
    async get(key) {
      assertBackupKey(key);
      try {
        const found = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        const bytes = await found.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },
    async list(prefix) {
      if (!prefix.startsWith("postgres/")) throw new Error("chave_recusada");
      const out: { key: string; size: number; lastModified?: Date; sha256?: string }[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const item of page.Contents ?? []) {
          if (!item.Key) continue;
          out.push({ key: item.Key, size: Number(item.Size ?? 0), lastModified: item.LastModified });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return out;
    },
    async delete(key) {
      assertBackupKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
