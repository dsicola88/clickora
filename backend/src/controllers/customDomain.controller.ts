import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { systemPrisma } from "../lib/prisma";
import {
  dnsTxtContainsVerification,
  normalizeHostname,
  newVerificationToken,
  validateHostnameOrThrow,
  verificationTxtRecordName,
  verificationTxtValue,
} from "../lib/customDomainDns";
import { refreshCustomDomainCache } from "../lib/customDomainCache";

function mapRow(d: {
  id: string;
  hostname: string;
  verificationToken: string;
  status: string;
  verifiedAt: Date | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    hostname: d.hostname,
    verification_token: d.verificationToken,
    status: d.status,
    verified_at: d.verifiedAt?.toISOString() ?? null,
    is_default: d.isDefault,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

/** Garante exatamente um `is_default` quando ainda há domínios após remoção ou estado inconsistente. */
async function ensureDefaultDomainForUser(userId: string): Promise<void> {
  const hasDefault = await systemPrisma.customDomain.findFirst({
    where: { userId, isDefault: true },
  });
  if (hasDefault) return;
  const first = await systemPrisma.customDomain.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!first) return;
  await systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
  await systemPrisma.customDomain.update({ where: { id: first.id }, data: { isDefault: true } });
}

export const customDomainController = {
  async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const rows = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(rows.map(mapRow));
  },

  async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const hostnameRaw = typeof req.body?.hostname === "string" ? req.body.hostname : "";
    let hostname: string;
    try {
      hostname = normalizeHostname(hostnameRaw);
      validateHostnameOrThrow(hostname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hostname inválido.";
      return res.status(400).json({ error: msg });
    }

    const taken = await systemPrisma.customDomain.findFirst({ where: { hostname } });
    if (taken && taken.userId !== userId) {
      return res.status(409).json({ error: "Este domínio já está associado a outra conta." });
    }
    if (taken && taken.userId === userId) {
      return res.status(409).json({ error: "Este domínio já está na sua lista." });
    }

    const count = await prisma.customDomain.count({ where: { userId } });
    const token = newVerificationToken();
    const isFirst = count === 0;

    const row = await prisma.customDomain.create({
      data: {
        userId,
        hostname,
        verificationToken: token,
        status: "pending",
        isDefault: isFirst,
      },
    });

    await refreshCustomDomainCache();

    return res.status(201).json({
      ...mapRow(row),
      dns: {
        txt_name: verificationTxtRecordName(hostname),
        txt_value: verificationTxtValue(token),
      },
    });
  },

  async verify(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID em falta." });

    const row = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!row) return res.status(404).json({ error: "Domínio não encontrado." });
    if (row.status === "verified") {
      await refreshCustomDomainCache();
      return res.json({ verified: true, ...mapRow(row) });
    }

    const ok = await dnsTxtContainsVerification(row.hostname, row.verificationToken);
    if (!ok) {
      return res.status(400).json({
        error: "Ainda não detetámos o registo TXT correto. Confirme o DNS e aguarde a propagação (pode demorar).",
        dns: {
          txt_name: verificationTxtRecordName(row.hostname),
          txt_value: verificationTxtValue(row.verificationToken),
        },
      });
    }

    const updated = await prisma.customDomain.update({
      where: { id: row.id },
      data: { status: "verified", verifiedAt: new Date() },
    });

    const hasVerifiedDefault = await prisma.customDomain.findFirst({
      where: { userId, status: "verified", isDefault: true },
    });
    if (!hasVerifiedDefault) {
      await prisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
      await prisma.customDomain.update({
        where: { id: updated.id },
        data: { isDefault: true },
      });
    }

    const final = await prisma.customDomain.findFirst({ where: { id: updated.id } });
    await refreshCustomDomainCache();

    return res.json({ verified: true, ...mapRow(final!) });
  },

  async setDefault(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const row = await prisma.customDomain.findFirst({ where: { id, userId, status: "verified" } });
    if (!row) return res.status(404).json({ error: "Domínio verificado não encontrado." });

    await prisma.$transaction([
      prisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.customDomain.update({ where: { id: row.id }, data: { isDefault: true } }),
    ]);
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map(mapRow));
  },

  async remove(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const existing = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Domínio não encontrado." });

    await prisma.customDomain.delete({ where: { id: existing.id } });
    await ensureDefaultDomainForUser(userId);
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json({ ok: true, domains: list.map(mapRow) });
  },
};
