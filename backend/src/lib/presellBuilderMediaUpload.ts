import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import type { Request } from "express";
import { isR2Configured, putR2Object } from "./r2Storage";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getPresellBuilderMediaDir(): string {
  return path.join(process.cwd(), "uploads", "presell-builder");
}

export function ensureUserBuilderMediaDir(userId: string): string {
  const dir = path.join(getPresellBuilderMediaDir(), userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Nome seguro para servir em rota pública (sem path traversal). */
export function isSafeBuilderMediaFilename(name: string): boolean {
  return /^[a-f0-9]{24}\.(jpg|png|webp)$/i.test(name);
}

export function builderMediaObjectKey(userId: string, filename: string): string {
  return `presell-builder/${userId}/${filename}`;
}

function newBuilderMediaFilename(mimetype: string): string {
  const ext = MIME_TO_EXT[mimetype];
  if (!ext) {
    throw new Error("Use JPG, PNG ou WebP (máx. 3 MB).");
  }
  return `${crypto.randomBytes(12).toString("hex")}.${ext}`;
}

/**
 * Guarda imagem do editor: Cloudflare R2 se `R2_*` estiver definido;
 * senão disco local (`uploads/presell-builder/…`) para desenvolvimento.
 */
export async function persistPresellBuilderMedia(args: {
  userId: string;
  buffer: Buffer;
  mimetype: string;
  /** Host da API (só usado no fallback local). */
  apiOrigin: string;
}): Promise<{ url: string; filename: string; storage: "r2" | "local" }> {
  const filename = newBuilderMediaFilename(args.mimetype);
  if (isR2Configured()) {
    const { url } = await putR2Object({
      key: builderMediaObjectKey(args.userId, filename),
      body: args.buffer,
      contentType: args.mimetype,
    });
    return { url, filename, storage: "r2" };
  }
  const dir = ensureUserBuilderMediaDir(args.userId);
  fs.writeFileSync(path.join(dir, filename), args.buffer);
  const url = `${args.apiOrigin}/api/public/presell-builder/${encodeURIComponent(args.userId)}/${encodeURIComponent(filename)}`;
  return { url, filename, storage: "local" };
}

/** Memória: o controller envia o buffer para R2 ou disco. */
export const presellBuilderMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req: Request, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) cb(null, true);
    else (cb as (e: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 3 MB)."));
  },
});
