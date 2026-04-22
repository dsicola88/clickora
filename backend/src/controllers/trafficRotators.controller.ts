import { Request, Response } from "express";
import { z } from "zod";
import { Prisma, RotatorDeviceRule, TrafficRotatorMode } from "@prisma/client";
import { systemPrisma } from "../lib/prisma";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import { getRotatorAbStats, promoteRotatorWinner } from "../lib/rotatorAbStats.service";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const armSchema = z.object({
  destination_url: z.string().url().max(8000),
  label: z.string().max(120).optional().nullable(),
  order_index: z.number().int().min(0).max(99),
  weight: z.number().int().min(0).max(100000).optional(),
  max_clicks: z.number().int().min(1).max(1_000_000_000).optional().nullable(),
  countries_allow: z.array(z.string().length(2)).max(200).optional().nullable(),
  countries_deny: z.array(z.string().length(2)).max(200).optional().nullable(),
  device_rule: z.enum(["all", "mobile", "desktop"]).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(64).regex(slugRegex),
  mode: z.enum(["random", "weighted", "sequential", "fill_order"]),
  backup_url: z.string().url().max(8000).optional().nullable(),
  context_presell_id: z.string().uuid(),
  access_code: z.string().max(256).optional().nullable(),
  is_active: z.boolean().optional(),
  arms: z.array(armSchema).min(1).max(25),
});

const updateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  slug: z.string().min(1).max(64).regex(slugRegex).optional(),
  mode: z.enum(["random", "weighted", "sequential", "fill_order"]).optional(),
  backup_url: z.string().url().max(8000).optional().nullable(),
  context_presell_id: z.string().uuid().optional(),
  access_code: z.union([z.string().max(256), z.literal("")]).optional(),
  is_active: z.boolean().optional(),
  arms: z.array(armSchema).min(1).max(25).optional(),
});

function toMode(m: string): TrafficRotatorMode {
  return m as TrafficRotatorMode;
}

function toDeviceRule(r: string | undefined): RotatorDeviceRule {
  if (r === "mobile" || r === "desktop") return r;
  return "all";
}

function mapArmJson(
  allow: string[] | null | undefined,
  deny: string[] | null | undefined,
): { countriesAllow: Prisma.InputJsonValue | typeof Prisma.JsonNull; countriesDeny: Prisma.InputJsonValue | typeof Prisma.JsonNull } {
  return {
    countriesAllow:
      allow && allow.length > 0
        ? (allow.map((c) => c.toUpperCase()) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    countriesDeny:
      deny && deny.length > 0 ? (deny.map((c) => c.toUpperCase()) as Prisma.InputJsonValue) : Prisma.JsonNull,
  };
}

function mapRotatorRow(r: {
  id: string;
  name: string;
  slug: string;
  mode: TrafficRotatorMode;
  backupUrl: string | null;
  contextPresellId: string;
  sequenceCursor: number;
  accessCode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  arms?: Array<{
    id: string;
    destinationUrl: string;
    label: string | null;
    orderIndex: number;
    weight: number;
    maxClicks: number | null;
    clicksDelivered: number;
    countriesAllow: Prisma.JsonValue | null;
    countriesDeny: Prisma.JsonValue | null;
    deviceRule: RotatorDeviceRule;
  }>;
}) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    mode: r.mode,
    backup_url: r.backupUrl,
    context_presell_id: r.contextPresellId,
    sequence_cursor: r.sequenceCursor,
    access_code_set: Boolean(r.accessCode && r.accessCode.length > 0),
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    arms: r.arms
      ? r.arms.map((a) => ({
          id: a.id,
          destination_url: a.destinationUrl,
          label: a.label,
          order_index: a.orderIndex,
          weight: a.weight,
          max_clicks: a.maxClicks,
          clicks_delivered: a.clicksDelivered,
          countries_allow: parseCountriesForApi(a.countriesAllow),
          countries_deny: parseCountriesForApi(a.countriesDeny),
          device_rule: a.deviceRule,
        }))
      : undefined,
  };
}

function parseCountriesForApi(j: Prisma.JsonValue | null): string[] | null {
  if (!j || !Array.isArray(j)) return null;
  const arr = j.filter((x): x is string => typeof x === "string").map((s) => s.toUpperCase());
  return arr.length ? arr : null;
}

export const trafficRotatorsController = {
  async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const rows = await systemPrisma.trafficRotator.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        arms: { orderBy: { orderIndex: "asc" } },
      },
    });
    const apiBase = publicApiBaseFromRequest(req);
    res.json(
      rows.map((r) => ({
        ...mapRotatorRow(r),
        public_click_url: `${apiBase}/track/rot/${r.id}`,
      })),
    );
  },

  async getOne(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const r = await systemPrisma.trafficRotator.findFirst({
      where: { id, userId },
      include: { arms: { orderBy: { orderIndex: "asc" } } },
    });
    if (!r) return res.status(404).json({ error: "Rotador não encontrado." });
    const apiBase = publicApiBaseFromRequest(req);
    res.json({
      ...mapRotatorRow(r),
      public_click_url: `${apiBase}/track/rot/${r.id}`,
    });
  },

  async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const b = parsed.data;

    const presell = await systemPrisma.presellPage.findFirst({
      where: { id: b.context_presell_id, userId, status: "published" },
      select: { id: true },
    });
    if (!presell) {
      return res.status(400).json({
        error: "Escolha uma presell publicada da sua conta como contexto de conversões.",
      });
    }

    const dup = await systemPrisma.trafficRotator.findFirst({
      where: { userId, slug: b.slug },
    });
    if (dup) return res.status(409).json({ error: "Já existe um rotador com este slug." });

    const created = await systemPrisma.trafficRotator.create({
      data: {
        userId,
        name: b.name.trim(),
        slug: b.slug.trim().toLowerCase(),
        mode: toMode(b.mode),
        backupUrl: b.backup_url?.trim() || null,
        contextPresellId: b.context_presell_id,
        accessCode: b.access_code?.trim() || null,
        isActive: b.is_active ?? true,
        arms: {
          create: b.arms.map((a) => {
            const j = mapArmJson(a.countries_allow ?? null, a.countries_deny ?? null);
            return {
              destinationUrl: a.destination_url.trim(),
              label: a.label?.trim() || null,
              orderIndex: a.order_index,
              weight: typeof a.weight === "number" ? a.weight : 100,
              maxClicks: a.max_clicks ?? null,
              countriesAllow: j.countriesAllow,
              countriesDeny: j.countriesDeny,
              deviceRule: toDeviceRule(a.device_rule),
            };
          }),
        },
      },
      include: { arms: { orderBy: { orderIndex: "asc" } } },
    });

    const apiBase = publicApiBaseFromRequest(req);
    res.status(201).json({
      ...mapRotatorRow(created),
      public_click_url: `${apiBase}/track/rot/${created.id}`,
    });
  },

  async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const b = parsed.data;

    const existing = await systemPrisma.trafficRotator.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Rotador não encontrado." });

    if (b.context_presell_id) {
      const presell = await systemPrisma.presellPage.findFirst({
        where: { id: b.context_presell_id, userId, status: "published" },
        select: { id: true },
      });
      if (!presell) {
        return res.status(400).json({ error: "Presell de contexto inválida ou não publicada." });
      }
    }

    if (b.slug && b.slug !== existing.slug) {
      const dup = await systemPrisma.trafficRotator.findFirst({
        where: { userId, slug: b.slug, NOT: { id } },
      });
      if (dup) return res.status(409).json({ error: "Já existe um rotador com este slug." });
    }

    let accessCode: string | null | undefined = undefined;
    if (b.access_code !== undefined) {
      accessCode = b.access_code === "" ? null : b.access_code.trim();
    }

    await systemPrisma.$transaction(async (tx) => {
      if (b.arms) {
        await tx.trafficRotatorArm.deleteMany({ where: { rotatorId: id } });
      }
      await tx.trafficRotator.update({
        where: { id },
        data: {
          ...(b.name != null ? { name: b.name.trim() } : {}),
          ...(b.slug != null ? { slug: b.slug.trim().toLowerCase() } : {}),
          ...(b.mode != null ? { mode: toMode(b.mode) } : {}),
          ...(b.backup_url !== undefined ? { backupUrl: b.backup_url?.trim() || null } : {}),
          ...(b.context_presell_id != null ? { contextPresellId: b.context_presell_id } : {}),
          ...(accessCode !== undefined ? { accessCode } : {}),
          ...(b.is_active != null ? { isActive: b.is_active } : {}),
          ...(b.arms
            ? {
                arms: {
                  create: b.arms.map((a) => {
                    const j = mapArmJson(a.countries_allow ?? null, a.countries_deny ?? null);
                    return {
                      destinationUrl: a.destination_url.trim(),
                      label: a.label?.trim() || null,
                      orderIndex: a.order_index,
                      weight: typeof a.weight === "number" ? a.weight : 100,
                      maxClicks: a.max_clicks ?? null,
                      clicksDelivered: 0,
                      countriesAllow: j.countriesAllow,
                      countriesDeny: j.countriesDeny,
                      deviceRule: toDeviceRule(a.device_rule),
                    };
                  }),
                },
              }
            : {}),
        },
      });
    });

    const r = await systemPrisma.trafficRotator.findFirst({
      where: { id, userId },
      include: { arms: { orderBy: { orderIndex: "asc" } } },
    });
    const apiBase = publicApiBaseFromRequest(req);
    res.json({
      ...mapRotatorRow(r!),
      public_click_url: `${apiBase}/track/rot/${id}`,
    });
  },

  async remove(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const del = await systemPrisma.trafficRotator.deleteMany({ where: { id, userId } });
    if (del.count === 0) return res.status(404).json({ error: "Rotador não encontrado." });
    res.status(204).end();
  },

  async abStats(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta." });
    const lookbackQ = z.coerce.number().int().min(1).max(730).optional().safeParse(req.query.lookback_days);
    const lookbackDays = lookbackQ.success && lookbackQ.data != null ? lookbackQ.data : 30;
    const stats = await getRotatorAbStats({ userId, rotatorId: id, lookbackDays });
    if (!stats) return res.status(404).json({ error: "Rotador não encontrado." });
    res.json(stats);
  },

  async promoteWinner(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta." });
    const bodySchema = z.object({
      metric: z.enum(["conversion_rate", "revenue"]).default("conversion_rate"),
      lookback_days: z.coerce.number().int().min(1).max(730).optional().default(30),
      min_clicks_per_arm: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
    });
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const { metric, lookback_days, min_clicks_per_arm } = parsed.data;
    const result = await promoteRotatorWinner({
      userId,
      rotatorId: id,
      metric,
      lookbackDays: lookback_days,
      minClicksPerArm: min_clicks_per_arm,
    });
    if (!result.ok) {
      if (result.error === "not_found") return res.status(404).json({ error: "Rotador não encontrado." });
      return res.status(400).json({ error: result.message ?? "Sem dados para promover um vencedor." });
    }
    res.json(result);
  },
};
