import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { systemPrisma } from "../lib/prisma";
import { AVATAR_LOCAL_MARKER, findUserAvatarFile } from "../lib/avatarUpload";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const publicAvatarController = {
  async getByUserId(req: Request, res: Response) {
    const userId = req.params.userId;
    if (!userId || userId.length < 10) return res.status(404).end();

    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user) return res.status(404).end();
    if (user.avatarUrl?.startsWith("http")) {
      return res.redirect(302, user.avatarUrl);
    }
    if (user.avatarUrl !== AVATAR_LOCAL_MARKER) return res.status(404).end();
    const filePath = findUserAvatarFile(userId);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).end();
    const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
    const mime = MIME_BY_EXT[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(path.resolve(filePath));
  },
};
