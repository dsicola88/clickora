import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { prismaAdmin, systemPrisma } from "../lib/prisma";
import {
  brandingFaviconPublicUrl,
  getBrandingUploadDir,
  persistFavicon,
  removeExistingFavicons,
} from "../lib/brandingUpload";
import { isR2Configured } from "../lib/r2Storage";

export const brandingController = {
  async getMeta(_req: Request, res: Response) {
    const row = await systemPrisma.siteBranding.findUnique({ where: { id: "default" } });
    if (!row?.faviconExt) {
      return res.json({ has_favicon: false });
    }
    return res.json({
      has_favicon: true,
      updated_at: row.updatedAt.toISOString(),
    });
  },

  async getFavicon(_req: Request, res: Response) {
    const row = await systemPrisma.siteBranding.findUnique({ where: { id: "default" } });
    if (!row?.faviconExt) {
      return res.status(404).end();
    }
    if (isR2Configured()) {
      return res.redirect(302, brandingFaviconPublicUrl(row.faviconExt));
    }
    const filePath = path.join(getBrandingUploadDir(), `favicon.${row.faviconExt}`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    res.setHeader("Content-Type", row.faviconMime || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(path.resolve(filePath));
  },

  async uploadFavicon(req: Request, res: Response) {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Envie um ficheiro no campo favicon." });
    }

    try {
      const saved = await persistFavicon({ buffer: file.buffer, mimetype: file.mimetype });
      const row = await prismaAdmin.siteBranding.upsert({
        where: { id: "default" },
        create: { id: "default", faviconExt: saved.ext, faviconMime: saved.mime },
        update: { faviconExt: saved.ext, faviconMime: saved.mime },
      });

      return res.json({
        message: "Favicon atualizado",
        has_favicon: true,
        storage: saved.storage,
        updated_at: row.updatedAt.toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      return res.status(500).json({ error: msg });
    }
  },

  async clearFavicon(_req: Request, res: Response) {
    removeExistingFavicons();
    await prismaAdmin.siteBranding.deleteMany({ where: { id: "default" } });
    return res.json({ message: "Favicon removido; a app volta ao ícone padrão." });
  },
};
