import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request } from "express";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const AVATAR_LOCAL_MARKER = "__local__";

export function getAvatarUploadDir(): string {
  return path.join(process.cwd(), "uploads", "avatars");
}

export function ensureAvatarDir(): void {
  fs.mkdirSync(getAvatarUploadDir(), { recursive: true });
}

export function removeUserAvatarFiles(userId: string): void {
  const dir = getAvatarUploadDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(`${userId}.`)) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

/** Primeiro ficheiro encontrado `userId.*` ou null. */
export function findUserAvatarFile(userId: string): string | null {
  const dir = getAvatarUploadDir();
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(`${userId}.`)) {
      return path.join(dir, name);
    }
  }
  return null;
}

export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file, cb) => {
      ensureAvatarDir();
      cb(null, getAvatarUploadDir());
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.userId;
      if (!userId) {
        (cb as (err: Error) => void)(new Error("Não autenticado"));
        return;
      }
      removeUserAvatarFiles(userId);
      const ext = MIME_TO_EXT[file.mimetype];
      if (!ext) {
        (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
        return;
      }
      cb(null, `${userId}.${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
    }
  },
});
