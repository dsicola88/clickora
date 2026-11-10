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
import {
  mapSiteSupportContacts,
  normalizeSupportEmail,
  normalizeSupportPhone,
} from "../lib/siteSupportContacts";

async function loadSiteBranding() {
  return systemPrisma.siteBranding.findUnique({ where: { id: "default" } });
}

export const brandingController = {
  async getMeta(_req: Request, res: Response) {
    const row = await loadSiteBranding();
    const support = mapSiteSupportContacts(row);
    if (!row?.faviconExt) {
      return res.json({
        has_favicon: false,
        ...support,
      });
    }
    return res.json({
      has_favicon: true,
      updated_at: row.updatedAt.toISOString(),
      ...support,
    });
  },

  async getFavicon(_req: Request, res: Response) {
    const row = await loadSiteBranding();
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
        ...mapSiteSupportContacts(row),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      return res.status(500).json({ error: msg });
    }
  },

  /** Remove só o favicon — preserva contactos de suporte. */
  async clearFavicon(_req: Request, res: Response) {
    removeExistingFavicons();
    const row = await prismaAdmin.siteBranding.upsert({
      where: { id: "default" },
      create: { id: "default", faviconExt: null, faviconMime: null },
      update: { faviconExt: null, faviconMime: null },
    });
    return res.json({
      message: "Favicon removido; a app volta ao ícone padrão.",
      has_favicon: false,
      ...mapSiteSupportContacts(row),
    });
  },

  /** Contactos oficiais — só super_admin (rota). */
  async patchSupportContacts(req: Request, res: Response) {
    let email: string | null | undefined;
    let phone: string | null | undefined;
    try {
      email =
        req.body?.support_email === undefined
          ? undefined
          : normalizeSupportEmail(req.body.support_email);
      phone =
        req.body?.support_phone === undefined
          ? undefined
          : normalizeSupportPhone(req.body.support_phone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dados inválidos.";
      return res.status(400).json({ error: msg });
    }

    if (email === undefined && phone === undefined) {
      return res.status(400).json({ error: "Indique support_email e/ou support_phone." });
    }

    const row = await prismaAdmin.siteBranding.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        supportEmail: email === undefined ? null : email,
        supportPhone: phone === undefined ? null : phone,
      },
      update: {
        ...(email !== undefined ? { supportEmail: email } : {}),
        ...(phone !== undefined ? { supportPhone: phone } : {}),
      },
    });

    return res.json({
      message: "Contactos de suporte actualizados.",
      has_favicon: Boolean(row.faviconExt),
      ...mapSiteSupportContacts(row),
    });
  },
};
