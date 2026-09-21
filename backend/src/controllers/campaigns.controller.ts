import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  traffic_source: z.string().min(1).max(64),
  country: z.string().max(8).optional().nullable(),
  language: z.string().max(16).optional().nullable(),
  offer_url: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  platform: z.string().max(64).optional().nullable(),
  presell_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

const updateSchema = createSchema.partial();

function mapCampaign(c: {
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
  createdAt: Date;
  updatedAt: Date;
  presell?: { id: string; title: string; status: string; slug: string } | null;
}) {
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
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    presell: c.presell
      ? { id: c.presell.id, title: c.presell.title, status: c.presell.status, slug: c.presell.slug }
      : null,
  };
}

export const campaignsController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const rows = await prisma.affiliateCampaign.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    res.json(rows.map(mapCampaign));
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    const row = await prisma.affiliateCampaign.findFirst({
      where: { id: req.params.id, userId },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    if (!row) return res.status(404).json({ error: "Campanha não encontrada" });
    res.json(mapCampaign(row));
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
      },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    res.status(201).json(mapCampaign(created));
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

    const updated = await prisma.affiliateCampaign.update({
      where: { id: existing.id },
      data,
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    res.json(mapCampaign(updated));
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
