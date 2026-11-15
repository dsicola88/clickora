import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { analyzeDemandRadar, buildDemandRadarOverview } from "../lib/demandRadar/service";
import type { GoogleAdsUserSettings } from "../modules/googleAds/googleAds.service";

const analyzeSchema = z.object({
  product: z.string().trim().min(2).max(200),
  market: z.string().trim().min(2).max(8).default("US"),
  language: z.string().trim().min(2).max(16).default("en"),
  /**
   * Janelas alinhadas ao Planejador Google Ads.
   * `default` e `last_12` = últimos 12 meses; `all_available` ≈ 4 anos.
   */
  timeframe: z
    .enum(["default", "last_1", "last_12", "last_24", "last_36", "all_available"])
    .default("last_12"),
});

async function loadGoogleUser(userId: string): Promise<GoogleAdsUserSettings | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
    },
  });
}

export const demandRadarController = {
  async overview(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await loadGoogleUser(userId);
    if (!user) {
      res.status(404).json({ error: "Utilizador não encontrado." });
      return;
    }
    const data = await buildDemandRadarOverview(userId, user);
    res.json(data);
  },

  async analyze(req: Request, res: Response) {
    const parsed = analyzeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Indique um produto ou termo (mín. 2 caracteres), mercado e idioma.",
        details: parsed.error.flatten(),
      });
      return;
    }
    const userId = billingUserId(req);
    const user = await loadGoogleUser(userId);
    if (!user) {
      res.status(404).json({ error: "Utilizador não encontrado." });
      return;
    }
    const data = await analyzeDemandRadar({
      userId,
      user,
      product: parsed.data.product,
      market: parsed.data.market,
      language: parsed.data.language,
      timeframe: parsed.data.timeframe,
    });
    res.json(data);
  },
};
