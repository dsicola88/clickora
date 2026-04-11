import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prismaAdmin, systemPrisma } from "../lib/prisma";
import { getPlansLandingUploadDir, removeExistingPlansHero } from "../lib/plansLandingUpload";

const fontEnum = z.enum(["sans", "serif", "mono"]);
const alignEnum = z.enum(["left", "center", "right"]);
const heroTitleSizeEnum = z.enum(["sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"]);
const weightEnum = z.enum(["normal", "medium", "semibold", "bold", "extrabold"]);
const bodySizeEnum = z.enum(["xs", "sm", "base", "lg", "xl"]);

const patchSchema = z.object({
  badge_text: z.string().max(80).nullable().optional(),
  hero_title: z.string().min(1).max(200).optional(),
  hero_subtitle: z.string().max(2000).nullable().optional(),
  intro_text: z.string().max(8000).nullable().optional(),
  footer_text: z.string().max(8000).nullable().optional(),
  hero_font: fontEnum.optional(),
  hero_text_align: alignEnum.optional(),
  hero_title_size: heroTitleSizeEnum.optional(),
  hero_title_weight: weightEnum.optional(),
  hero_subtitle_size: bodySizeEnum.optional(),
  intro_font: fontEnum.optional(),
  intro_text_align: alignEnum.optional(),
  intro_text_size: bodySizeEnum.optional(),
  footer_font: fontEnum.optional(),
  footer_text_align: alignEnum.optional(),
  footer_text_size: bodySizeEnum.optional(),
});

type Row = {
  id: string;
  badgeText: string | null;
  heroTitle: string;
  heroSubtitle: string | null;
  heroImageExt: string | null;
  heroImageMime: string | null;
  introText: string | null;
  footerText: string | null;
  heroFont: string;
  heroTextAlign: string;
  heroTitleSize: string;
  heroTitleWeight: string;
  heroSubtitleSize: string;
  introFont: string;
  introTextAlign: string;
  introTextSize: string;
  footerFont: string;
  footerTextAlign: string;
  footerTextSize: string;
  updatedAt: Date;
};

function mapRow(row: Row) {
  return {
    badge_text: row.badgeText,
    hero_title: row.heroTitle,
    hero_subtitle: row.heroSubtitle,
    has_hero_image: Boolean(row.heroImageExt),
    intro_text: row.introText,
    footer_text: row.footerText,
    hero_font: row.heroFont,
    hero_text_align: row.heroTextAlign,
    hero_title_size: row.heroTitleSize,
    hero_title_weight: row.heroTitleWeight,
    hero_subtitle_size: row.heroSubtitleSize,
    intro_font: row.introFont,
    intro_text_align: row.introTextAlign,
    intro_text_size: row.introTextSize,
    footer_font: row.footerFont,
    footer_text_align: row.footerTextAlign,
    footer_text_size: row.footerTextSize,
    updated_at: row.updatedAt.toISOString(),
  };
}

const DEFAULT_JSON = {
  badge_text: null as string | null,
  hero_title: "Escolha seu plano",
  hero_subtitle: null as string | null,
  has_hero_image: false,
  intro_text: null as string | null,
  footer_text: null as string | null,
  hero_font: "sans",
  hero_text_align: "left",
  hero_title_size: "3xl",
  hero_title_weight: "bold",
  hero_subtitle_size: "base",
  intro_font: "sans",
  intro_text_align: "left",
  intro_text_size: "base",
  footer_font: "sans",
  footer_text_align: "center",
  footer_text_size: "sm",
  updated_at: new Date().toISOString(),
};

export const plansLandingController = {
  async getPublic(_req: Request, res: Response) {
    const row = await systemPrisma.plansLandingConfig.findUnique({ where: { id: "default" } });
    if (!row) {
      return res.json(DEFAULT_JSON);
    }
    return res.json(mapRow(row as Row));
  },

  async getHeroImage(_req: Request, res: Response) {
    const row = await systemPrisma.plansLandingConfig.findUnique({ where: { id: "default" } });
    if (!row?.heroImageExt) return res.status(404).end();
    const filePath = path.join(getPlansLandingUploadDir(), `plans-hero.${row.heroImageExt}`);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.setHeader("Content-Type", row.heroImageMime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(path.resolve(filePath));
  },

  async getAdmin(_req: Request, res: Response) {
    const row = await prismaAdmin.plansLandingConfig.findUnique({ where: { id: "default" } });
    if (!row) {
      return res.json(DEFAULT_JSON);
    }
    return res.json(mapRow(row as Row));
  },

  async patchAdmin(req: Request, res: Response) {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const d = parsed.data;
    const row = await prismaAdmin.plansLandingConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        badgeText: d.badge_text ?? null,
        heroTitle: d.hero_title ?? "Escolha seu plano",
        heroSubtitle: d.hero_subtitle ?? null,
        introText: d.intro_text ?? null,
        footerText: d.footer_text ?? null,
        heroFont: d.hero_font ?? "sans",
        heroTextAlign: d.hero_text_align ?? "left",
        heroTitleSize: d.hero_title_size ?? "3xl",
        heroTitleWeight: d.hero_title_weight ?? "bold",
        heroSubtitleSize: d.hero_subtitle_size ?? "base",
        introFont: d.intro_font ?? "sans",
        introTextAlign: d.intro_text_align ?? "left",
        introTextSize: d.intro_text_size ?? "base",
        footerFont: d.footer_font ?? "sans",
        footerTextAlign: d.footer_text_align ?? "center",
        footerTextSize: d.footer_text_size ?? "sm",
      },
      update: {
        ...(d.badge_text !== undefined && { badgeText: d.badge_text }),
        ...(d.hero_title !== undefined && { heroTitle: d.hero_title }),
        ...(d.hero_subtitle !== undefined && { heroSubtitle: d.hero_subtitle }),
        ...(d.intro_text !== undefined && { introText: d.intro_text }),
        ...(d.footer_text !== undefined && { footerText: d.footer_text }),
        ...(d.hero_font !== undefined && { heroFont: d.hero_font }),
        ...(d.hero_text_align !== undefined && { heroTextAlign: d.hero_text_align }),
        ...(d.hero_title_size !== undefined && { heroTitleSize: d.hero_title_size }),
        ...(d.hero_title_weight !== undefined && { heroTitleWeight: d.hero_title_weight }),
        ...(d.hero_subtitle_size !== undefined && { heroSubtitleSize: d.hero_subtitle_size }),
        ...(d.intro_font !== undefined && { introFont: d.intro_font }),
        ...(d.intro_text_align !== undefined && { introTextAlign: d.intro_text_align }),
        ...(d.intro_text_size !== undefined && { introTextSize: d.intro_text_size }),
        ...(d.footer_font !== undefined && { footerFont: d.footer_font }),
        ...(d.footer_text_align !== undefined && { footerTextAlign: d.footer_text_align }),
        ...(d.footer_text_size !== undefined && { footerTextSize: d.footer_text_size }),
      },
    });

    return res.json({ ok: true, ...mapRow(row as Row) });
  },

  async uploadHero(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Envie um ficheiro no campo hero_image." });
    }

    const ext = path.extname(file.filename).replace(/^\./, "") || null;
    const mime = file.mimetype;

    const row = await prismaAdmin.plansLandingConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        heroTitle: "Escolha seu plano",
        heroImageExt: ext,
        heroImageMime: mime,
      },
      update: {
        heroImageExt: ext,
        heroImageMime: mime,
      },
    });

    return res.json({
      message: "Imagem do hero atualizada",
      has_hero_image: true,
      updated_at: row.updatedAt.toISOString(),
    });
  },

  async clearHero(_req: Request, res: Response) {
    removeExistingPlansHero();
    await prismaAdmin.plansLandingConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        heroTitle: "Escolha seu plano",
        heroImageExt: null,
        heroImageMime: null,
      },
      update: { heroImageExt: null, heroImageMime: null },
    });
    return res.json({ message: "Imagem do hero removida." });
  },
};
