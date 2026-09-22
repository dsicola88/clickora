import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { isR2Configured, putR2Object, r2PublicUrl } from "./r2Storage";

const HERO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getPlansLandingUploadDir(): string {
  return path.join(process.cwd(), "uploads", "branding");
}

export function ensurePlansLandingDir(): void {
  fs.mkdirSync(getPlansLandingUploadDir(), { recursive: true });
}

export function removeExistingPlansHero(): void {
  const dir = getPlansLandingUploadDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith("plans-hero.")) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

export function plansHeroObjectKey(ext: string): string {
  return `branding/plans-hero.${ext}`;
}

export function plansGalleryObjectKey(filename: string): string {
  return `branding/${filename}`;
}

export function plansHeroPublicUrl(ext: string): string {
  return r2PublicUrl(plansHeroObjectKey(ext));
}

export async function persistPlansHero(args: {
  buffer: Buffer;
  mimetype: string;
}): Promise<{ ext: string; mime: string; storage: "r2" | "local" }> {
  const ext = HERO_MIME[args.mimetype];
  if (!ext) throw new Error("Use JPG, PNG ou WebP (máx. 2 MB).");
  if (isR2Configured()) {
    await putR2Object({
      key: plansHeroObjectKey(ext),
      body: args.buffer,
      contentType: args.mimetype,
      cacheControl: "public, max-age=3600",
    });
    return { ext, mime: args.mimetype, storage: "r2" };
  }
  ensurePlansLandingDir();
  removeExistingPlansHero();
  fs.writeFileSync(path.join(getPlansLandingUploadDir(), `plans-hero.${ext}`), args.buffer);
  return { ext, mime: args.mimetype, storage: "local" };
}

export async function persistPlansGalleryImage(args: {
  buffer: Buffer;
  mimetype: string;
  apiPublicBase: string;
}): Promise<{ filename: string; imageUrl: string; storage: "r2" | "local" }> {
  const ext = HERO_MIME[args.mimetype];
  if (!ext) throw new Error("Use JPG, PNG ou WebP (máx. 2 MB).");
  const filename = `plans-gallery-${randomUUID()}.${ext}`;
  if (isR2Configured()) {
    const { url } = await putR2Object({
      key: plansGalleryObjectKey(filename),
      body: args.buffer,
      contentType: args.mimetype,
      cacheControl: "public, max-age=86400",
    });
    return { filename, imageUrl: url, storage: "r2" };
  }
  ensurePlansLandingDir();
  fs.writeFileSync(path.join(getPlansLandingUploadDir(), filename), args.buffer);
  const imageUrl = `${args.apiPublicBase}/public/plans-landing/gallery-image/${encodeURIComponent(filename)}`;
  return { filename, imageUrl, storage: "local" };
}

export const plansHeroUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (HERO_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
    }
  },
});

/** Imagens da galeria / carrossel da landing de planos — um ficheiro por upload, nome único. */
export const plansGalleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (HERO_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
    }
  },
});

/** Evita path traversal; só ficheiros criados por `plansGalleryUpload`. */
export function isSafePlansGalleryFilename(name: string): boolean {
  return /^plans-gallery-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
    name,
  );
}
