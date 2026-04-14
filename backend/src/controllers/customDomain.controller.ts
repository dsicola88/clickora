import { Prisma } from "@prisma/client";
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
import {
  isVercelConfigured,
  vercelAddProjectDomain,
  vercelCnameHint,
  vercelRemoveProjectDomain,
  vercelVerifyProjectDomain,
  type VercelVerificationChallenge,
} from "../lib/vercelProjectDomains";

function mapRow(d: {
  id: string;
  hostname: string;
  verificationToken: string;
  status: string;
  verifiedAt: Date | null;
  isDefault: boolean;
  vercelDomainRegistered: boolean;
  vercelVerificationJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const base: Record<string, unknown> = {
    id: d.id,
    hostname: d.hostname,
    verification_token: d.verificationToken,
    status: d.status,
    verified_at: d.verifiedAt?.toISOString() ?? null,
    is_default: d.isDefault,
    vercel_domain_registered: d.vercelDomainRegistered,
    vercel_verification: (d.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
  if (d.status === "pending") {
    const vj = (d.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [];
    base.pending_dns = buildDnsPayload(d.hostname, d.verificationToken, {
      vercel: d.vercelDomainRegistered,
      vercelVerification: vj,
      vercelVerifiedImmediately: false,
    });
  }
  return base;
}

function buildDnsPayload(
  hostname: string,
  token: string,
  opts: {
    vercel: boolean;
    vercelVerification: VercelVerificationChallenge[];
    vercelVerifiedImmediately: boolean;
  },
) {
  const cname = vercelCnameHint(hostname);

  if (opts.vercel) {
    return {
      mode: "vercel" as const,
      cname,
      vercel_txt: opts.vercelVerification.map((v) => ({
        type: v.type,
        name: v.domain,
        value: v.value,
        reason: v.reason,
      })),
      vercel_verified_immediately: opts.vercelVerifiedImmediately,
      note:
        "O domínio foi registado automaticamente no projeto do site. Configure o CNAME (ou A no apex) e o(s) TXT abaixo; depois use «Verificar».",
    };
  }

  return {
    mode: "dclickora" as const,
    txt_name: verificationTxtRecordName(hostname),
    txt_value: verificationTxtValue(token),
    note:
      "Crie um único registo TXT: primeira linha = Nome/Host do registo; segunda linha = Valor/Conteúdo. Depois use «Verificar».",
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

    let vercelRegistered = false;
    let vercelVerification: VercelVerificationChallenge[] = [];
    let vercelVerifiedImmediately = false;

    if (isVercelConfigured()) {
      const vr = await vercelAddProjectDomain(hostname);
      if (!vr.ok) {
        return res.status(502).json({
          error: `Não foi possível registar o domínio no alojamento: ${vr.error}. Confirme VERCEL_TOKEN e VERCEL_PROJECT_ID na API.`,
        });
      }
      vercelRegistered = true;
      vercelVerification = vr.verification;
      vercelVerifiedImmediately = vr.verified;
    }

    const row = await prisma.customDomain.create({
      data: {
        userId,
        hostname,
        verificationToken: token,
        status: vercelVerifiedImmediately ? "verified" : "pending",
        verifiedAt: vercelVerifiedImmediately ? new Date() : null,
        isDefault: isFirst,
        vercelDomainRegistered: vercelRegistered,
        vercelVerificationJson: vercelVerification.length
          ? (vercelVerification as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    if (vercelVerifiedImmediately) {
      await ensureDefaultDomainForUser(userId);
    }

    await refreshCustomDomainCache();

    return res.status(201).json(mapRow(row));
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

    if (row.vercelDomainRegistered) {
      const vr = await vercelVerifyProjectDomain(row.hostname);
      if (vr.ok && vr.verified) {
        let out = await prisma.customDomain.update({
          where: { id: row.id },
          data: {
            status: "verified",
            verifiedAt: new Date(),
            vercelVerificationJson: Prisma.JsonNull,
          },
        });

        const hasVerifiedDefault = await prisma.customDomain.findFirst({
          where: { userId, status: "verified", isDefault: true },
        });
        if (!hasVerifiedDefault) {
          await prisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
          out = await prisma.customDomain.update({
            where: { id: out.id },
            data: { isDefault: true },
          });
        }

        await refreshCustomDomainCache();
        return res.json({ verified: true, ...mapRow(out) });
      }

      if (!vr.ok) {
        return res.status(400).json({
          error: vr.error || "A Vercel ainda não validou o DNS. Confirme CNAME e TXT e aguarde a propagação.",
          dns: buildDnsPayload(row.hostname, row.verificationToken, {
            vercel: true,
            vercelVerification: (row.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [],
            vercelVerifiedImmediately: false,
          }),
        });
      }

      return res.status(400).json({
        error: "Ainda a verificar na Vercel. Confirme os registos DNS e tente de novo.",
        dns: buildDnsPayload(row.hostname, row.verificationToken, {
          vercel: true,
          vercelVerification: (row.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [],
          vercelVerifiedImmediately: false,
        }),
      });
    }

    const dnsResult = await dnsTxtContainsVerification(row.hostname, row.verificationToken);
    const dnsPayload = buildDnsPayload(row.hostname, row.verificationToken, {
      vercel: false,
      vercelVerification: [],
      vercelVerifiedImmediately: false,
    });
    if (dnsResult === "timeout") {
      return res.status(503).json({
        error:
          "A consulta DNS demorou demasiado (timeout do servidor). Tente «Verificar» de novo dentro de alguns segundos.",
        dns: dnsPayload,
      });
    }
    if (dnsResult !== "match") {
      return res.status(400).json({
        error: "Ainda não detetámos o registo TXT correto. Confirme o DNS e aguarde a propagação (pode demorar).",
        dns: dnsPayload,
      });
    }

    let out = await prisma.customDomain.update({
      where: { id: row.id },
      data: { status: "verified", verifiedAt: new Date() },
    });

    const hasVerifiedDefault = await prisma.customDomain.findFirst({
      where: { userId, status: "verified", isDefault: true },
    });
    if (!hasVerifiedDefault) {
      await prisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
      out = await prisma.customDomain.update({
        where: { id: out.id },
        data: { isDefault: true },
      });
    }

    await refreshCustomDomainCache();

    return res.json({ verified: true, ...mapRow(out) });
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

    if (existing.vercelDomainRegistered) {
      const rm = await vercelRemoveProjectDomain(existing.hostname);
      if (!rm.ok) {
        return res.status(502).json({
          error: rm.error || "Não foi possível remover o domínio na Vercel. Tente de novo ou contacte o suporte.",
        });
      }
    }

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
