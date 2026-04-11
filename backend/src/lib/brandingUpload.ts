import fs from "fs";
import path from "path";
import multer from "multer";

export const FAVICON_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export function getBrandingUploadDir(): string {
  return path.join(process.cwd(), "uploads", "branding");
}

export function ensureBrandingDir(): void {
  fs.mkdirSync(getBrandingUploadDir(), { recursive: true });
}

export function removeExistingFavicons(): void {
  const dir = getBrandingUploadDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith("favicon.")) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

export const faviconUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureBrandingDir();
      removeExistingFavicons();
      cb(null, getBrandingUploadDir());
    },
    filename: (_req, file, cb) => {
      const ext = FAVICON_MIME_TO_EXT[file.mimetype];
      if (!ext) {
        (cb as (err: Error) => void)(new Error("Tipo de ficheiro não suportado"));
        return;
      }
      cb(null, `favicon.${ext}`);
    },
  }),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (FAVICON_MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use PNG, ICO, SVG ou WebP (máx. 512 KB)."));
    }
  },
});
