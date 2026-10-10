import { Request, Response } from "express";
import { z } from "zod";
import { systemPrisma } from "../lib/prisma";
import { lessonEmbedUrl, parseLessonVideoUrl, type LessonProvider } from "../lib/academyLesson";

const lessonBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  source_url: z.string().trim().min(8).max(2000),
  module_name: z.string().trim().min(1).max(80).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  published: z.boolean().optional(),
});

const lessonPatchSchema = lessonBodySchema.partial();

type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  provider: string;
  sourceUrl: string;
  videoId: string;
  bunnyLibraryId: string | null;
  moduleName: string;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function present(row: LessonRow, admin: boolean) {
  const embedUrl = lessonEmbedUrl({
    provider: row.provider === "bunny" ? "bunny" : "youtube",
    videoId: row.videoId,
    bunnyLibraryId: row.bunnyLibraryId,
  });
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    provider: row.provider as LessonProvider,
    module: row.moduleName,
    sort_order: row.sortOrder,
    embed_url: embedUrl,
  };
  if (!admin) return base;
  return {
    ...base,
    source_url: row.sourceUrl,
    published: row.published,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const orderBy = [{ moduleName: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }];

export const academyLessonController = {
  async listPublished(_req: Request, res: Response) {
    const rows = await systemPrisma.academyLesson.findMany({
      where: { published: true },
      orderBy,
    });
    const lessons = rows.map((row) => present(row, false)).filter((row) => row.embed_url);
    res.json({ lessons });
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await systemPrisma.academyLesson.findMany({ orderBy });
    res.json({ lessons: rows.map((row) => present(row, true)) });
  },

  async create(req: Request, res: Response) {
    const parsed = lessonBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    }
    const video = parseLessonVideoUrl(parsed.data.source_url);
    if (!video) {
      return res.status(400).json({
        error: "Use um link do YouTube ou o embed do Bunny Stream (iframe.mediadelivery.net).",
      });
    }
    const row = await systemPrisma.academyLesson.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
        provider: video.provider,
        sourceUrl: parsed.data.source_url.trim(),
        videoId: video.videoId,
        bunnyLibraryId: video.bunnyLibraryId,
        moduleName: parsed.data.module_name?.trim() || "Começar",
        sortOrder: parsed.data.sort_order ?? 0,
        published: parsed.data.published ?? false,
      },
    });
    res.status(201).json({ lesson: present(row, true) });
  },

  async update(req: Request, res: Response) {
    const parsed = lessonPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    }
    const existing = await systemPrisma.academyLesson.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Aula não encontrada." });

    const data: {
      title?: string;
      description?: string | null;
      provider?: string;
      sourceUrl?: string;
      videoId?: string;
      bunnyLibraryId?: string | null;
      moduleName?: string;
      sortOrder?: number;
      published?: boolean;
    } = {};

    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description?.trim() ? parsed.data.description.trim() : null;
    }
    if (parsed.data.module_name !== undefined) data.moduleName = parsed.data.module_name.trim() || "Começar";
    if (parsed.data.sort_order !== undefined) data.sortOrder = parsed.data.sort_order;
    if (parsed.data.published !== undefined) data.published = parsed.data.published;
    if (parsed.data.source_url !== undefined) {
      const video = parseLessonVideoUrl(parsed.data.source_url);
      if (!video) {
        return res.status(400).json({
          error: "Use um link do YouTube ou o embed do Bunny Stream (iframe.mediadelivery.net).",
        });
      }
      data.sourceUrl = parsed.data.source_url.trim();
      data.provider = video.provider;
      data.videoId = video.videoId;
      data.bunnyLibraryId = video.bunnyLibraryId;
    }

    const row = await systemPrisma.academyLesson.update({ where: { id: existing.id }, data });
    res.json({ lesson: present(row, true) });
  },

  async remove(req: Request, res: Response) {
    const existing = await systemPrisma.academyLesson.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Aula não encontrada." });
    await systemPrisma.academyLesson.delete({ where: { id: existing.id } });
    res.json({ message: "Aula removida." });
  },
};
