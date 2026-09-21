import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { loadCampaignPerf, type CampaignPerf } from "../lib/campaignPerf";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  traffic_source: z.string().min(1).max(64),
  country: z.string().max(8).optional().nullable(),
  language: z.string().max(16).optional().nullable(),
  offer_url: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  platform: z.string().max(64).optional().nullable(),
  presell_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "paused"]).optional(),
  /** Gasto de ads no período que o media buyer está a analisar (manual). */
  spend_amount: z.union([z.number().nonnegative(), z.null()]).optional(),
  spend_currency: z.string().max(8).optional().nullable(),
});

const updateSchema = createSchema.partial();

type CampaignRow = {
  id: string;
  userId: string;
  name: string;
  trafficSource: string;
  country: string | null;
  language: string | null;
  offerUrl: string | null;
  platform: string | null;
  presellId: string | null;
  status: string;
  spendAmount: Prisma.Decimal | null;
  spendCurrency: string | null;
  createdAt: Date;
  updatedAt: Date;
  presell?: { id: string; title: string; status: string; slug: string } | null;
};

function spendNumber(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapCampaign(c: CampaignRow, stats?: CampaignPerf | null) {
  const spend = spendNumber(c.spendAmount);
  return {
    id: c.id,
    name: c.name,
    traffic_source: c.trafficSource,
    country: c.country,
    language: c.language,
    offer_url: c.offerUrl,
    platform: c.platform,
    presell_id: c.presellId,
    status: c.status,
    spend_amount: spend,
    spend_currency: c.spendCurrency || "EUR",
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    presell: c.presell
      ? { id: c.presell.id, title: c.presell.title, status: c.presell.status, slug: c.presell.slug }
      : null,
    ...(stats
      ? {
          stats: {
            ...stats,
            /** Gasto manual não é faturado por dia — trate como o gasto do período que está a analisar. */
            spend_note: "manual_period_estimate" as const,
          },
        }
      : {}),
  };
}

function parseRange(req: Request): { from?: Date; to?: Date } {
  const fromQ = req.query.from?.toString();
  const toQ = req.query.to?.toString();
  if (!fromQ || !toQ) {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - 14);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  const from = new Date(fromQ);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toQ);
  to.setHours(23, 59, 59, 999);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return { from: undefined, to: undefined };
  }
  return { from, to };
}

export const campaignsController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const withStats = req.query.with_stats === "1" || req.query.with_stats === "true";
    const range = parseRange(req);

    const rows = await prisma.affiliateCampaign.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });

    if (!withStats) {
      return res.json(rows.map((r) => mapCampaign(r as CampaignRow)));
    }

    const mapped = await Promise.all(
      rows.map(async (r) => {
        const spend = spendNumber(r.spendAmount);
        const stats = await loadCampaignPerf({
          userId,
          campaignName: r.name,
          spend,
          from: range.from,
          to: range.to,
        });
        return mapCampaign(r as CampaignRow, stats);
      }),
    );
    res.json(mapped);
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    const range = parseRange(req);
    const row = await prisma.affiliateCampaign.findFirst({
      where: { id: req.params.id, userId },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    if (!row) return res.status(404).json({ error: "Campanha não encontrada" });

    const spend = spendNumber(row.spendAmount);
    const stats = await loadCampaignPerf({
      userId,
      campaignName: row.name,
      spend,
      from: range.from,
      to: range.to,
    });
    res.json(mapCampaign(row as CampaignRow, stats));
  },

  async create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const d = parsed.data;

    if (d.presell_id) {
      const p = await prisma.presellPage.findFirst({ where: { id: d.presell_id, userId } });
      if (!p) return res.status(400).json({ error: "Presell inválida" });
    }

    const created = await prisma.affiliateCampaign.create({
      data: {
        userId,
        name: d.name.trim(),
        trafficSource: d.traffic_source.trim(),
        country: d.country?.trim() || null,
        language: d.language?.trim() || null,
        offerUrl: d.offer_url?.trim() || null,
        platform: d.platform?.trim() || null,
        presellId: d.presell_id || null,
        status: d.status || "draft",
        spendAmount: d.spend_amount === undefined ? undefined : d.spend_amount,
        spendCurrency: d.spend_currency?.trim()?.toUpperCase() || "EUR",
      },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    res.status(201).json(mapCampaign(created as CampaignRow));
  },

  async update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const existing = await prisma.affiliateCampaign.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ error: "Campanha não encontrada" });

    const d = parsed.data;
    if (d.presell_id) {
      const p = await prisma.presellPage.findFirst({ where: { id: d.presell_id, userId } });
      if (!p) return res.status(400).json({ error: "Presell inválida" });
    }

    const data: Prisma.AffiliateCampaignUpdateInput = {};
    if (d.name !== undefined) data.name = d.name.trim();
    if (d.traffic_source !== undefined) data.trafficSource = d.traffic_source.trim();
    if (d.country !== undefined) data.country = d.country?.trim() || null;
    if (d.language !== undefined) data.language = d.language?.trim() || null;
    if (d.offer_url !== undefined) data.offerUrl = d.offer_url?.trim() || null;
    if (d.platform !== undefined) data.platform = d.platform?.trim() || null;
    if (d.presell_id !== undefined) {
      data.presell = d.presell_id
        ? { connect: { id: d.presell_id } }
        : { disconnect: true };
    }
    if (d.status !== undefined) data.status = d.status;
    if (d.spend_amount !== undefined) {
      data.spendAmount = d.spend_amount === null ? null : d.spend_amount;
    }
    if (d.spend_currency !== undefined) {
      data.spendCurrency = d.spend_currency?.trim()?.toUpperCase() || null;
    }

    const updated = await prisma.affiliateCampaign.update({
      where: { id: existing.id },
      data,
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });

    const range = parseRange(req);
    const spend = spendNumber(updated.spendAmount);
    const stats = await loadCampaignPerf({
      userId,
      campaignName: updated.name,
      spend,
      from: range.from,
      to: range.to,
    });
    res.json(mapCampaign(updated as CampaignRow, stats));
  },

  async remove(req: Request, res: Response) {
    const userId = billingUserId(req);
    const existing = await prisma.affiliateCampaign.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ error: "Campanha não encontrada" });
    await prisma.affiliateCampaign.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  },
};
