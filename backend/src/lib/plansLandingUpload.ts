import fs from "fs";
import path from "path";
import multer from "multer";

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

export const plansHeroUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensurePlansLandingDir();
      removeExistingPlansHero();
      cb(null, getPlansLandingUploadDir());
    },
    filename: (_req, file, cb) => {
      const ext = HERO_MIME[file.mimetype];
      if (!ext) {
        (cb as (err: Error) => void)(new Error("Tipo de ficheiro não suportado"));
        return;
      }
      cb(null, `plans-hero.${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (HERO_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      (cb as (err: Error) => void)(new Error("Use JPG, PNG ou WebP (máx. 2 MB)."));
    }
  },
});
