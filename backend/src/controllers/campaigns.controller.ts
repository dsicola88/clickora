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

function isMissingColumnError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022";
}

function isMissingTableError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021";
}

const presellInclude = {
  presell: { select: { id: true, title: true, status: true, slug: true } },
} as const;

/** Lista campanhas; se a migração spend_* ainda não correu em produção, não derruba a página. */
async function findCampaignsForUser(userId: string): Promise<CampaignRow[]> {
  try {
    const rows = await prisma.affiliateCampaign.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: presellInclude,
    });
    return rows as CampaignRow[];
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    console.warn("[campaigns] spend_* em falta — lista sem gasto (correr migrate deploy)");
    const rows = await prisma.affiliateCampaign.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        name: true,
        trafficSource: true,
        country: true,
        language: true,
        offerUrl: true,
        platform: true,
        presellId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    return rows.map((r) => ({ ...r, spendAmount: null, spendCurrency: null }));
  }
}

async function findCampaignById(userId: string, id: string): Promise<CampaignRow | null> {
  try {
    const row = await prisma.affiliateCampaign.findFirst({
      where: { id, userId },
      include: presellInclude,
    });
    return row as CampaignRow | null;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    console.warn("[campaigns] spend_* em falta — getById sem gasto");
    const row = await prisma.affiliateCampaign.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        name: true,
        trafficSource: true,
        country: true,
        language: true,
        offerUrl: true,
        platform: true,
        presellId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    if (!row) return null;
    return { ...row, spendAmount: null, spendCurrency: null };
  }
}

export const campaignsController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const withStats = req.query.with_stats === "1" || req.query.with_stats === "true";
    const range = parseRange(req);

    let rows: CampaignRow[];
    try {
      rows = await findCampaignsForUser(userId);
    } catch (e) {
      console.error("[campaigns.list]", e);
      if (isMissingTableError(e)) {
        return res.status(503).json({
          error: "Tabela de campanhas ainda não está disponível. Aguarde o deploy da migração.",
          code: "campaigns_migration_pending",
        });
      }
      return res.status(503).json({
        error: "Não foi possível carregar campanhas. Tente novamente dentro de momentos.",
        code: "campaigns_unavailable",
      });
    }

    if (!withStats) {
      return res.json(rows.map((r) => mapCampaign(r)));
    }

    try {
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
          return mapCampaign(r, stats);
        }),
      );
      return res.json(mapped);
    } catch (e) {
      console.warn("[campaigns.list] with_stats falhou — devolve lista sem stats", e);
      return res.json(rows.map((r) => mapCampaign(r)));
    }
  },

  async getById(req: Request, res: Response) {
    const userId = billingUserId(req);
    const range = parseRange(req);
    let row: CampaignRow | null;
    try {
      row = await findCampaignById(userId, req.params.id);
    } catch (e) {
      console.error("[campaigns.getById]", e);
      return res.status(503).json({ error: "Campanha indisponível de momento." });
    }
    if (!row) return res.status(404).json({ error: "Campanha não encontrada" });

    try {
      const spend = spendNumber(row.spendAmount);
      const stats = await loadCampaignPerf({
        userId,
        campaignName: row.name,
        spend,
        from: range.from,
        to: range.to,
      });
      return res.json(mapCampaign(row, stats));
    } catch (e) {
      console.warn("[campaigns.getById] stats falhou", e);
      return res.json(mapCampaign(row));
    }
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
        ...(d.spend_amount !== undefined
          ? {
              spendAmount: d.spend_amount,
              spendCurrency: d.spend_currency?.trim()?.toUpperCase() || "EUR",
            }
          : {}),
      },
      include: {
        presell: { select: { id: true, title: true, status: true, slug: true } },
      },
    });
    res.status(201).json(mapCampaign({ ...created, spendAmount: created.spendAmount ?? null, spendCurrency: created.spendCurrency ?? null } as CampaignRow));
  },

  async update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const existing = await findCampaignById(userId, req.params.id);
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

    try {
      const updated = await prisma.affiliateCampaign.update({
        where: { id: existing.id },
        data,
        include: {
          presell: { select: { id: true, title: true, status: true, slug: true } },
        },
      });

      const range = parseRange(req);
      const spend = spendNumber(updated.spendAmount);
      try {
        const stats = await loadCampaignPerf({
          userId,
          campaignName: updated.name,
          spend,
          from: range.from,
          to: range.to,
        });
        return res.json(mapCampaign(updated as CampaignRow, stats));
      } catch {
        return res.json(mapCampaign(updated as CampaignRow));
      }
    } catch (e) {
      if (isMissingColumnError(e) && (d.spend_amount !== undefined || d.spend_currency !== undefined)) {
        return res.status(503).json({
          error: "Gasto de campanha ainda não disponível neste ambiente. Aguarde o deploy da migração.",
          code: "spend_migration_pending",
        });
      }
      throw e;
    }
  },

  async remove(req: Request, res: Response) {
    const userId = billingUserId(req);
    const existing = await findCampaignById(userId, req.params.id);
    if (!existing) return res.status(404).json({ error: "Campanha não encontrada" });
    await prisma.affiliateCampaign.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  },
};
