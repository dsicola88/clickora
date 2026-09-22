import fs from "fs";
import path from "path";
import multer from "multer";
import { isR2Configured, putR2Object, r2PublicUrl } from "./r2Storage";

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

export function brandingFaviconKey(ext: string): string {
  return `branding/favicon.${ext}`;
}

export function brandingFaviconPublicUrl(ext: string): string {
  return r2PublicUrl(brandingFaviconKey(ext));
}

export async function persistFavicon(args: {
  buffer: Buffer;
  mimetype: string;
}): Promise<{ ext: string; mime: string; storage: "r2" | "local" }> {
  const ext = FAVICON_MIME_TO_EXT[args.mimetype];
  if (!ext) throw new Error("Use PNG, ICO, SVG ou WebP (máx. 512 KB).");
  if (isR2Configured()) {
    await putR2Object({
      key: brandingFaviconKey(ext),
      body: args.buffer,
      contentType: args.mimetype,
      cacheControl: "public, max-age=3600",
    });
    return { ext, mime: args.mimetype, storage: "r2" };
  }
  ensureBrandingDir();
  removeExistingFavicons();
  fs.writeFileSync(path.join(getBrandingUploadDir(), `favicon.${ext}`), args.buffer);
  return { ext, mime: args.mimetype, storage: "local" };
}

export const faviconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (FAVICON_MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use PNG, ICO, SVG ou WebP (máx. 512 KB)."));
    }
  },
});
