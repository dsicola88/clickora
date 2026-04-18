import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import type { Request } from "express";

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

export const presellBuilderMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req: Request, _file, cb) => {
      const userId = req.user?.userId;
      if (!userId) {
        (cb as (e: Error) => void)(new Error("Não autenticado"));
        return;
      }
      cb(null, ensureUserBuilderMediaDir(userId));
    },
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype];
      if (!ext) {
        (cb as (e: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 3 MB)."));
        return;
      }
      cb(null, `${crypto.randomBytes(12).toString("hex")}.${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) cb(null, true);
    else (cb as (e: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 3 MB)."));
  },
});
