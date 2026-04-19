import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { systemPrisma } from "../lib/prisma";
import {
  dnsTxtContainsVerification,
  normalizeHostname,
  newVerificationToken,
  validateHostnameOrThrow,
} from "../lib/customDomainDns";
import { buildPendingDnsPayload } from "../lib/customDomainDnsPayload";
import { refreshCustomDomainCache } from "../lib/customDomainCache";
import {
  isVercelConfigured,
  vercelAddProjectDomain,
  vercelCnameHint,
  vercelRemoveProjectDomain,
  vercelVerifyProjectDomain,
  type VercelVerificationChallenge,
} from "../lib/vercelProjectDomains";
import { resolveCustomDomainQuotaForUser } from "../lib/customDomainLimits";

function mapRow(d: {
  id: string;
  hostname: string;
  verificationToken: string;
  status: string;
  verifiedAt: Date | null;
  isDefault: boolean;
  rootPresellId: string | null;
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
    root_presell_id: d.rootPresellId ?? null,
    vercel_domain_registered: d.vercelDomainRegistered,
    vercel_verification: (d.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
  if (d.status === "pending") {
    const vj = (d.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [];
    base.pending_dns = buildPendingDnsPayload(d.hostname, d.verificationToken, {
      vercel: d.vercelDomainRegistered,
      vercelVerification: vj,
      vercelVerifiedImmediately: false,
    });
  }
  /** Com domínio já verificado, o cliente não recebe `pending_dns`; devolvemos só o CNAME/A do site para referência na Hostinger. */
  if (d.status === "verified" && d.vercelDomainRegistered) {
    base.hosting_dns_hint = vercelCnameHint(d.hostname);
  }
  return base;
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

  async quota(req: Request, res: Response) {
    const userId = req.user!.userId;
    const q = await resolveCustomDomainQuotaForUser(userId);
    return res.json({
      max_custom_domains: q.maxCustomDomains,
      used: q.used,
      can_add: q.canAdd,
    });
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
      return res.status(409).json({
        error:
          "Este hostname já está na sua lista (veja abaixo). Para voltar a tentar a verificação, use «Verificar agora» no cartão desse domínio. Só pode remover e adicionar de novo se quiser recomeçar o DNS.",
      });
    }

    const quota = await resolveCustomDomainQuotaForUser(userId);
    if (!quota.canAdd) {
      const max = quota.maxCustomDomains;
      if (max === 0) {
        return res.status(403).json({
          error:
            "O seu plano não inclui domínios personalizados. O plano Premium permite até 2 domínios; no Pro use exportação HTML para WordPress (bloco HTML personalizado) no domínio dclickora.",
        });
      }
      return res.status(403).json({
        error: `Limite de domínios atingido (${max}). Remova um domínio abaixo antes de adicionar outro.`,
      });
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
        // `prisma.customDomain.update` com where `{ id }` rebenta no tenant client (WhereUniqueInput vs AND+userId).
        let out = await systemPrisma.customDomain.update({
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
          out = await systemPrisma.customDomain.update({
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
          dns: buildPendingDnsPayload(row.hostname, row.verificationToken, {
            vercel: true,
            vercelVerification: (row.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [],
            vercelVerifiedImmediately: false,
          }),
        });
      }

      return res.status(400).json({
        error: "Ainda a verificar na Vercel. Confirme os registos DNS e tente de novo.",
        dns: buildPendingDnsPayload(row.hostname, row.verificationToken, {
          vercel: true,
          vercelVerification: (row.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [],
          vercelVerifiedImmediately: false,
        }),
      });
    }

    const dnsResult = await dnsTxtContainsVerification(row.hostname, row.verificationToken);
    const dnsPayload = buildPendingDnsPayload(row.hostname, row.verificationToken, {
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

    let out = await systemPrisma.customDomain.update({
      where: { id: row.id },
      data: { status: "verified", verifiedAt: new Date() },
    });

    const hasVerifiedDefault = await prisma.customDomain.findFirst({
      where: { userId, status: "verified", isDefault: true },
    });
    if (!hasVerifiedDefault) {
      await prisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
      out = await systemPrisma.customDomain.update({
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

    await systemPrisma.$transaction([
      systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } }),
      systemPrisma.customDomain.update({ where: { id: row.id }, data: { isDefault: true } }),
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

    await systemPrisma.customDomain.delete({ where: { id: existing.id } });
    await ensureDefaultDomainForUser(userId);
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json({ ok: true, domains: list.map(mapRow) });
  },

  async setRootPresell(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = req.params.id;
    const raw = req.body?.presell_id;
    const presellId =
      raw === null || raw === undefined || raw === "" ? null : String(raw).trim() || null;

    const domain = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!domain) return res.status(404).json({ error: "Domínio não encontrado." });
    if (domain.status !== "verified") {
      return res.status(400).json({ error: "Só é possível após o domínio estar verificado." });
    }

    if (presellId === null) {
      await systemPrisma.customDomain.update({
        where: { id: domain.id },
        data: { rootPresellId: null },
      });
      await refreshCustomDomainCache();
      const list = await prisma.customDomain.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
      });
      return res.json(list.map(mapRow));
    }

    const page = await prisma.presellPage.findFirst({
      where: { id: presellId, userId, customDomainId: domain.id },
    });
    if (!page) {
      return res.status(400).json({
        error: "Presell não encontrada ou não está associada a este domínio (Domínio nos links públicos).",
      });
    }

    await systemPrisma.customDomain.update({
      where: { id: domain.id },
      data: { rootPresellId: page.id },
    });
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map(mapRow));
  },
};
