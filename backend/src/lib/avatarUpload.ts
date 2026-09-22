import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request } from "express";
import { isR2Configured, putR2Object } from "./r2Storage";

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

export function avatarObjectKey(userId: string, ext: string): string {
  return `avatars/${userId}.${ext}`;
}

/**
 * Guarda avatar: R2 (URL pública) ou disco local (`__local__` + ficheiro).
 */
export async function persistUserAvatar(args: {
  userId: string;
  buffer: Buffer;
  mimetype: string;
}): Promise<{ avatarUrl: string; storage: "r2" | "local" }> {
  const ext = MIME_TO_EXT[args.mimetype];
  if (!ext) throw new Error("Use JPG, PNG ou WebP (máx. 2 MB).");
  if (isR2Configured()) {
    const { url } = await putR2Object({
      key: avatarObjectKey(args.userId, ext),
      body: args.buffer,
      contentType: args.mimetype,
      cacheControl: "public, max-age=3600",
    });
    return { avatarUrl: url, storage: "r2" };
  }
  ensureAvatarDir();
  removeUserAvatarFiles(args.userId);
  fs.writeFileSync(path.join(getAvatarUploadDir(), `${args.userId}.${ext}`), args.buffer);
  return { avatarUrl: AVATAR_LOCAL_MARKER, storage: "local" };
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: Request, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
    }
  },
});
