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
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getPaidTiktokAssetsRoot(): string {
  return path.join(process.cwd(), "uploads", "paid-tiktok-assets");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export const paidTiktokAssetUpload = multer({
  storage: multer.diskStorage({
    destination: (req: Request, _file, cb) => {
      const projectId = req.params["projectId"];
      if (typeof projectId !== "string" || !UUID.test(projectId)) {
        (cb as (e: Error) => void)(new Error("projectId inválido"));
        return;
      }
      const dir = path.join(getPaidTiktokAssetsRoot(), projectId);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype];
      if (!ext) {
        (cb as (e: Error) => void)(new Error("Formato não suportado."));
        return;
      }
      cb(null, `${crypto.randomBytes(12).toString("hex")}.${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) cb(null, true);
    else
      (cb as (e: Error) => void)(new Error("Use JPEG, PNG, WebP, MP4 ou MOV (máx. 25 MB)."));
  },
});
