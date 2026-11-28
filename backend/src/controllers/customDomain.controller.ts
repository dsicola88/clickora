import { presellBelongsToDomain } from "../lib/customDomainRoot";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { systemPrisma } from "../lib/prisma";
import {
  dnsTxtContainsVerification,
  normalizeHostname,
  newVerificationToken,
  validateHostnameOrThrow,
} from "../lib/customDomainDns";
import { buildPendingDnsPayload } from "../lib/customDomainDnsPayload";
import { refreshCustomDomainCache } from "../lib/customDomainCache";
import { probeCustomDomainLiveSsl } from "../lib/customDomainLiveSsl";
import {
  isVercelConfigured,
  vercelAddProjectDomain,
  vercelCnameHint,
  vercelRemoveProjectDomain,
  vercelVerifyProjectDomain,
  type VercelVerificationChallenge,
} from "../lib/vercelProjectDomains";
import {
  resolveCustomDomainSslState,
  sslStateLabelPt,
  type CustomDomainSslLive,
} from "../lib/customDomainSslState";
import { resolveCustomDomainQuotaForUser } from "../lib/customDomainLimits";
import {
  hostingCapablePurposeFilter,
  isHostingCapablePurpose,
  trackingCapablePurposeFilter,
} from "../lib/customDomainPurpose";
import {
  DomainRoutingRefusedError,
  planPrimaryDomainSwap,
  planRollbackTarget,
  promotePrimaryDomainForUser,
  recordDomainRoutingEvent,
  runDomainHealthProbeAndUpdate,
  type RoutingDomainCandidate,
} from "../lib/domainRoutingService";
import { appendWorkspaceAuditLog } from "../lib/workspaceAudit";

function mapRow(
  d: {
    id: string;
    hostname: string;
    verificationToken: string;
    status: string;
    verifiedAt: Date | null;
    isDefault: boolean;
    purpose?: string;
    isDefaultTracking?: boolean;
    rootPresellId: string | null;
    vercelDomainRegistered: boolean;
    vercelVerificationJson: Prisma.JsonValue | null;
    httpsReachableCached?: boolean | null;
    httpsReadyCheckedAt?: Date | null;
    routingRole?: string;
    healthStatus?: string;
    lastHealthCheckAt?: Date | null;
    lastHealthError?: string | null;
    lastHttpStatus?: number | null;
    consecutiveFailures?: number;
    autoRecover?: boolean;
    isActive?: boolean;
    disabledReason?: string | null;
    routingPriority?: number;
    createdAt: Date;
    updatedAt: Date;
  },
  live?: CustomDomainSslLive | null,
) {
  const ssl = resolveCustomDomainSslState({
    status: d.status,
    vercelDomainRegistered: d.vercelDomainRegistered,
    live: live ?? null,
    cachedHttpsReachable: live ? undefined : d.httpsReachableCached,
  });
  const base: Record<string, unknown> = {
    id: d.id,
    hostname: d.hostname,
    verification_token: d.verificationToken,
    status: d.status,
    verified_at: d.verifiedAt?.toISOString() ?? null,
    is_default: d.isDefault,
    purpose: d.purpose ?? "both",
    is_default_tracking: d.isDefaultTracking ?? false,
    root_presell_id: d.rootPresellId ?? null,
    vercel_domain_registered: d.vercelDomainRegistered,
    vercel_verification: (d.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? null,
    ssl_state: ssl.ssl_state,
    https_ready: ssl.https_ready,
    ssl_label: sslStateLabelPt(ssl.ssl_state),
    routing_role: d.routingRole ?? (d.isDefault ? "primary" : "standby"),
    health_status: d.healthStatus ?? (d.httpsReachableCached ? "healthy" : "unknown"),
    last_health_check_at: d.lastHealthCheckAt?.toISOString() ?? null,
    last_health_error: d.lastHealthError ?? null,
    last_http_status: d.lastHttpStatus ?? null,
    consecutive_failures: d.consecutiveFailures ?? 0,
    auto_recover: d.autoRecover ?? true,
    is_active: d.isActive ?? true,
    disabled_reason: d.disabledReason ?? null,
    routing_priority: d.routingPriority ?? 100,
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

async function liveSslForDomain(row: {
  status: string;
  hostname: string;
  vercelDomainRegistered: boolean;
}): Promise<CustomDomainSslLive | null> {
  return probeCustomDomainLiveSsl(row);
}

async function persistSslProbeCache(
  domainId: string,
  live: CustomDomainSslLive | null,
): Promise<void> {
  if (!live || typeof live.httpsReachable !== "boolean") return;
  await systemPrisma.customDomain.update({
    where: { id: domainId },
    data: {
      httpsReachableCached: live.httpsReachable,
      httpsReadyCheckedAt: new Date(),
    },
  });
}

/** Garante no máximo um `is_default` lander (nunca purpose=tracking). */
async function ensureDefaultDomainForUser(userId: string): Promise<void> {
  await systemPrisma.customDomain.updateMany({
    where: { userId, purpose: "tracking", isDefault: true },
    data: { isDefault: false },
  });
  const hasDefault = await systemPrisma.customDomain.findFirst({
    where: { userId, isDefault: true, ...hostingCapablePurposeFilter },
  });
  if (hasDefault) return;
  const first = await systemPrisma.customDomain.findFirst({
    where: { userId, ...hostingCapablePurposeFilter },
    orderBy: { createdAt: "asc" },
  });
  if (!first) return;
  await systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } });
  await systemPrisma.customDomain.update({
    where: { id: first.id },
    data: { isDefault: true, routingRole: "primary" },
  });
}

/** Garante um `is_default_tracking` quando ainda há domínios tracking/both. */
async function ensureDefaultTrackingForUser(userId: string): Promise<void> {
  await systemPrisma.customDomain.updateMany({
    where: { userId, purpose: "hosting", isDefaultTracking: true },
    data: { isDefaultTracking: false },
  });
  const hasDefault = await systemPrisma.customDomain.findFirst({
    where: { userId, isDefaultTracking: true, ...trackingCapablePurposeFilter },
  });
  if (hasDefault) return;
  const first =
    (await systemPrisma.customDomain.findFirst({
      where: { userId, status: "verified", purpose: "tracking" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await systemPrisma.customDomain.findFirst({
      where: { userId, status: "verified", purpose: "both" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await systemPrisma.customDomain.findFirst({
      where: { userId, ...trackingCapablePurposeFilter },
      orderBy: { createdAt: "asc" },
    }));
  if (!first) return;
  await systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefaultTracking: false } });
  await systemPrisma.customDomain.update({
    where: { id: first.id },
    data: { isDefaultTracking: true },
  });
}

export const customDomainController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const rows = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    // Lista sem probe live (rápido); ssl_state sintético. Use GET …/go-live para HTTPS pronto.
    return res.json(rows.map((r) => mapRow(r)));
  },

  /**
   * Go-live / SSL: consulta Vercel + probe HTTPS.
   * A UI deve fazer poll enquanto `ssl_state === ssl_provisioning`.
   */
  async goLive(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "id em falta" });
    const row = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!row) return res.status(404).json({ error: "Domínio não encontrado" });
    const live = await liveSslForDomain(row);
    await persistSslProbeCache(row.id, live);
    const persisted =
      (await prisma.customDomain.findFirst({ where: { id: row.id, userId } })) ?? row;
    return res.json(mapRow(persisted, live));
  },

  async quota(req: Request, res: Response) {
    const userId = billingUserId(req);
    const q = await resolveCustomDomainQuotaForUser(userId);
    return res.json({
      max_custom_domains: q.maxCustomDomains,
      used: q.used,
      can_add: q.canAdd,
    });
  },

  async create(req: Request, res: Response) {
    const userId = billingUserId(req);
    const hostnameRaw = typeof req.body?.hostname === "string" ? req.body.hostname : "";
    const purposeRaw = typeof req.body?.purpose === "string" ? req.body.purpose.trim() : "both";
    if (purposeRaw !== "hosting" && purposeRaw !== "tracking" && purposeRaw !== "both") {
      return res.status(400).json({ error: "purpose inválido (hosting | tracking | both)." });
    }
    const purpose = purposeRaw;
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
            "O seu plano não inclui domínio próprio.",
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

    if (isVercelConfigured()) {
      const vr = await vercelAddProjectDomain(hostname);
      if (!vr.ok) {
        return res.status(502).json({
          error: `Não foi possível registar o domínio no alojamento: ${vr.error}. Confirme VERCEL_TOKEN e VERCEL_PROJECT_ID na API.`,
        });
      }
      vercelRegistered = true;
      vercelVerification = vr.verification;
    }

    const trackingCount = await prisma.customDomain.count({
      where: { userId, ...trackingCapablePurposeFilter, isDefaultTracking: true },
    });
    const hostingDefaultExists = await prisma.customDomain.findFirst({
      where: { userId, isDefault: true, ...hostingCapablePurposeFilter },
      select: { id: true },
    });
    const row = await prisma.customDomain.create({
      data: {
        userId,
        hostname,
        verificationToken: token,
        // Nunca "verified" no create: mesmo que a Vercel já valide o DNS, falta a prova de posse (TXT).
        status: "pending",
        verifiedAt: null,
        isDefault: purpose !== "tracking" && !hostingDefaultExists,
        purpose,
        isDefaultTracking:
          (purpose === "tracking" || purpose === "both") && trackingCount === 0,
        vercelDomainRegistered: vercelRegistered,
        vercelVerificationJson: vercelVerification.length
          ? (vercelVerification as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    if (isFirst) {
      await ensureDefaultDomainForUser(userId);
    }

    await refreshCustomDomainCache();

    return res.status(201).json(mapRow(row));
  },

  async verify(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID em falta." });

    const row = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!row) return res.status(404).json({ error: "Domínio não encontrado." });
    if (row.status === "verified") {
      await refreshCustomDomainCache();
      const live = await liveSslForDomain(row);
      await persistSslProbeCache(row.id, live);
      const persisted =
        (await prisma.customDomain.findFirst({ where: { id: row.id, userId } })) ?? row;
      return res.json({ verified: true, ...mapRow(persisted, live) });
    }

    const vercelChallenges = (row.vercelVerificationJson as VercelVerificationChallenge[] | null) ?? [];
    const dnsPayload = buildPendingDnsPayload(row.hostname, row.verificationToken, {
      vercel: row.vercelDomainRegistered,
      vercelVerification: vercelChallenges,
      vercelVerifiedImmediately: false,
    });

    // Prova de posse obrigatória em qualquer modo: o TXT `_dclickora-verify` tem de estar no DNS.
    const dnsResult = await dnsTxtContainsVerification(row.hostname, row.verificationToken);
    if (dnsResult === "timeout") {
      return res.status(503).json({
        error:
          "A consulta DNS demorou demasiado (timeout do servidor). Tente «Verificar» de novo dentro de alguns segundos.",
        dns: dnsPayload,
      });
    }
    if (dnsResult !== "match") {
      return res.status(400).json({
        error:
          "Falta o registo TXT de posse (_dclickora-verify). Adicione-o no DNS do domínio, aguarde a propagação e clique em Verificar.",
        dns: dnsPayload,
      });
    }

    if (row.vercelDomainRegistered) {
      const vr = await vercelVerifyProjectDomain(row.hostname);
      if (!vr.ok) {
        return res.status(400).json({
          error: vr.error || "A Vercel ainda não validou o DNS. Confirme CNAME e aguarde a propagação.",
          dns: dnsPayload,
        });
      }
      if (!vr.verified) {
        return res.status(400).json({
          error: "Ainda a verificar na Vercel. Confirme os registos DNS e tente de novo.",
          dns: dnsPayload,
        });
      }
    }

    // `prisma.customDomain.update` com where `{ id }` rebenta no tenant client (WhereUniqueInput vs AND+userId).
    let out = await systemPrisma.customDomain.update({
      where: { id: row.id },
      data: {
        status: "verified",
        verifiedAt: new Date(),
        vercelVerificationJson: Prisma.JsonNull,
        ...(row.isDefault ? { routingRole: "primary" as const } : {}),
      },
    });

    await ensureDefaultDomainForUser(userId);
    await ensureDefaultTrackingForUser(userId);
    out =
      (await prisma.customDomain.findFirst({ where: { id: out.id, userId } })) ?? out;

    await refreshCustomDomainCache();
    const live = await liveSslForDomain(out);
    await persistSslProbeCache(out.id, live);
    const persisted =
      (await prisma.customDomain.findFirst({ where: { id: out.id, userId } })) ?? out;
    return res.json({ verified: true, ...mapRow(persisted, live) });
  },

  async setDefault(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id;
    const row = await prisma.customDomain.findFirst({ where: { id, userId, status: "verified" } });
    if (!row) return res.status(404).json({ error: "Domínio verificado não encontrado." });
    if (!isHostingCapablePurpose(row.purpose)) {
      return res.status(400).json({
        error: "Domínio só de tracking não pode ser o padrão da lander. Use purpose hosting ou both.",
      });
    }
    if (!row.isDefault) {
      const gate = planPrimaryDomainSwap({
        currentPrimary: null,
        target: row as unknown as RoutingDomainCandidate,
        scope: "hosting",
      });
      if (!gate.ok) return res.status(409).json({ error: gate.error });
    }
    const previousDefault = await prisma.customDomain.findFirst({
      where: { userId, isDefault: true, purpose: { not: "tracking" } },
      select: { id: true },
    });

    await systemPrisma.$transaction([
      systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefault: false } }),
      systemPrisma.customDomain.updateMany({
        where: { userId, routingRole: "primary", purpose: { not: "tracking" } },
        data: { routingRole: "backup", routingPriority: 50 },
      }),
      systemPrisma.customDomain.update({
        where: { id: row.id },
        data: { isDefault: true, routingRole: "primary", routingPriority: 10 },
      }),
    ]);
    await refreshCustomDomainCache();
    const swapped = previousDefault && previousDefault.id !== row.id;
    await recordDomainRoutingEvent({
      userId,
      eventType: swapped ? "manual_swap" : "role_changed",
      scope: "domain",
      customDomainId: row.id,
      previousDomainId: swapped ? previousDefault.id : null,
      targetDomainId: row.id,
      actorUserId: req.user?.userId ?? userId,
      reason: `Domínio ${row.hostname} definido como primário (padrão).`,
    });

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map((r) => mapRow(r)));
  },

  async remove(req: Request, res: Response) {
    const userId = billingUserId(req);
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
    await ensureDefaultTrackingForUser(userId);
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json({ ok: true, domains: list.map((r) => mapRow(r)) });
  },

  async setPurpose(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id;
    const purposeRaw = typeof req.body?.purpose === "string" ? req.body.purpose.trim() : "";
    if (purposeRaw !== "hosting" && purposeRaw !== "tracking" && purposeRaw !== "both") {
      return res.status(400).json({ error: "purpose inválido (hosting | tracking | both)." });
    }
    const domain = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!domain) return res.status(404).json({ error: "Domínio não encontrado." });

    const data: { purpose: "hosting" | "tracking" | "both"; isDefaultTracking?: boolean; isDefault?: boolean } = {
      purpose: purposeRaw,
    };
    if (purposeRaw === "tracking") {
      data.isDefault = false;
    }
    if (purposeRaw === "hosting") {
      data.isDefaultTracking = false;
    }

    await systemPrisma.customDomain.update({
      where: { id: domain.id },
      data: purposeRaw === "tracking" ? { ...data, rootPresellId: null } : data,
    });
    if (purposeRaw === "tracking") {
      /** Domínio só-tracking deixa de ser lander: limpa ligações de páginas. */
      await systemPrisma.presellPage.updateMany({
        where: { userId, customDomainId: domain.id },
        data: { customDomainId: null },
      });
      await ensureDefaultDomainForUser(userId);
    }
    if (purposeRaw === "hosting" || purposeRaw === "tracking" || purposeRaw === "both") {
      await ensureDefaultTrackingForUser(userId);
    }
    await refreshCustomDomainCache();
    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map((r) => mapRow(r)));
  },

  async setDefaultTracking(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id;
    const row = await prisma.customDomain.findFirst({
      where: {
        id,
        userId,
        status: "verified",
        ...trackingCapablePurposeFilter,
      },
    });
    if (!row) {
      return res.status(404).json({
        error: "Domínio verificado com finalidade tracking/both não encontrado.",
      });
    }

    await systemPrisma.$transaction([
      systemPrisma.customDomain.updateMany({ where: { userId }, data: { isDefaultTracking: false } }),
      systemPrisma.customDomain.update({ where: { id: row.id }, data: { isDefaultTracking: true } }),
    ]);
    await refreshCustomDomainCache();

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map((r) => mapRow(r)));
  },

  async setRootPresell(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id;
    const raw = req.body?.presell_id;
    const presellId =
      raw === null || raw === undefined || raw === "" ? null : String(raw).trim() || null;

    const domain = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!domain) return res.status(404).json({ error: "Domínio não encontrado." });
    if (domain.status !== "verified") {
      return res.status(400).json({ error: "Só é possível após o domínio estar verificado." });
    }
    if (domain.purpose === "tracking") {
      return res.status(400).json({
        error: "Domínio só de tracking não abre presell na raiz — use purpose hosting ou both.",
      });
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
      return res.json(list.map((r) => mapRow(r)));
    }

    const page = await prisma.presellPage.findFirst({
      where: { id: presellId, userId },
      select: { id: true, userId: true, customDomainId: true },
    });
    if (!page || !presellBelongsToDomain(page, domain)) {
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
    return res.json(list.map((r) => mapRow(r)));
  },

  /** Sondagem de saúde SSL/HTTP sob demanda (atualiza health_status + DomainRoutingEvent). */
  async healthCheck(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "id em falta" });
    try {
      const check = await runDomainHealthProbeAndUpdate({
        domainId: id,
        userId,
        actorUserId: req.user?.userId ?? userId,
      });
      const updated = await prisma.customDomain.findFirst({ where: { id, userId } });
      if (!updated) return res.status(404).json({ error: "Domínio não encontrado." });
      return res.json({ check, domain: mapRow(updated) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na sondagem.";
      return res.status(msg.includes("não encontrado") ? 404 : 400).json({ error: msg });
    }
  },

  /** Ativa ou desativa temporariamente um domínio sem perder DNS/Vercel. */
  async setActive(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    const isActive = typeof req.body?.is_active === "boolean" ? req.body.is_active : undefined;
    if (isActive === undefined) {
      return res.status(400).json({ error: "Campo is_active (boolean) é obrigatório." });
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 240) : null;
    const row = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!row) return res.status(404).json({ error: "Domínio não encontrado." });

    await systemPrisma.customDomain.update({
      where: { id: row.id },
      data: {
        isActive,
        disabledReason: isActive ? null : reason || "Desativado manualmente pelo operador.",
      },
    });
    await refreshCustomDomainCache();
    await recordDomainRoutingEvent({
      userId,
      eventType: isActive ? "domain_enabled" : "domain_disabled",
      scope: "domain",
      customDomainId: row.id,
      actorUserId: req.user?.userId ?? userId,
      reason: isActive
        ? `Domínio ${row.hostname} reativado.`
        : reason || `Domínio ${row.hostname} desativado manualmente.`,
    });
    if (req.user?.workspaceId) {
      await appendWorkspaceAuditLog({
        workspaceId: req.user.workspaceId,
        actorUserId: req.user.userId,
        action: isActive ? "custom_domain.enable" : "custom_domain.disable",
        resourceType: "custom_domain",
        resourceId: row.id,
        metadata: { hostname: row.hostname, reason },
      });
    }

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map((r) => mapRow(r)));
  },

  /** Atualiza papel de roteamento (primary/backup/standby), prioridade e auto_recover. */
  async setRouting(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    const row = await prisma.customDomain.findFirst({ where: { id, userId } });
    if (!row) return res.status(404).json({ error: "Domínio não encontrado." });

    const roleRaw = typeof req.body?.routing_role === "string" ? req.body.routing_role.trim() : undefined;
    if (roleRaw !== undefined && roleRaw !== "primary" && roleRaw !== "backup" && roleRaw !== "standby") {
      return res.status(400).json({ error: "routing_role inválido (primary | backup | standby)." });
    }
    const autoRecover = typeof req.body?.auto_recover === "boolean" ? req.body.auto_recover : undefined;
    const priority =
      typeof req.body?.routing_priority === "number" && Number.isInteger(req.body.routing_priority)
        ? Math.max(1, Math.min(10_000, req.body.routing_priority))
        : undefined;

    if (roleRaw === "primary") {
      if (row.status !== "verified" || !isHostingCapablePurpose(row.purpose)) {
        return res.status(400).json({ error: "Só um domínio verificado de hosting pode ser primário." });
      }
      if (!row.isDefault) {
        try {
          await promotePrimaryDomainForUser({
            userId,
            targetDomainId: row.id,
            actorUserId: req.user?.userId ?? userId,
            workspaceId: req.user?.workspaceId,
            reason: `Papel de ${row.hostname} alterado para primário.`,
          });
        } catch (err) {
          return res.status(err instanceof DomainRoutingRefusedError ? 409 : 400).json({
            error: err instanceof Error ? err.message : "Não foi possível promover o domínio.",
          });
        }
      }
    }

    if (roleRaw !== undefined || autoRecover !== undefined || priority !== undefined) {
      await systemPrisma.customDomain.update({
        where: { id: row.id },
        data: {
          ...(roleRaw !== undefined ? { routingRole: roleRaw } : {}),
          ...(autoRecover !== undefined ? { autoRecover } : {}),
          ...(priority !== undefined ? { routingPriority: priority } : {}),
        },
      });
      await recordDomainRoutingEvent({
        userId,
        eventType: "role_changed",
        scope: "domain",
        customDomainId: row.id,
        actorUserId: req.user?.userId ?? userId,
        reason: `Configuração de roteamento atualizada (${roleRaw ?? row.routingRole}).`,
      });
    }

    const list = await prisma.customDomain.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
    });
    return res.json(list.map((r) => mapRow(r)));
  },

  /** Promove domínio backup/standby verificado a primário da conta com registo para rollback. */
  async promotePrimary(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "id em falta" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : null;
    try {
      const result = await promotePrimaryDomainForUser({
        userId,
        targetDomainId: id,
        actorUserId: req.user?.userId ?? userId,
        workspaceId: req.user?.workspaceId,
        reason,
      });
      const list = await prisma.customDomain.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
      });
      return res.json({ ok: true, ...result, domains: list.map((r) => mapRow(r)) });
    } catch (err) {
      return res.status(err instanceof DomainRoutingRefusedError ? 409 : 400).json({
        error: err instanceof Error ? err.message : "Não foi possível trocar o domínio principal.",
      });
    }
  },

  /** Reverte o domínio primário da conta para o domínio anterior registado em DomainRoutingEvent. */
  async rollbackPrimary(req: Request, res: Response) {
    const userId = billingUserId(req);
    const [domains, events] = await Promise.all([
      prisma.customDomain.findMany({ where: { userId } }),
      prisma.domainRoutingEvent.findMany({
        /** Só trocas: eventos de sonda durante uma falha empurravam a última troca para fora da janela. */
        where: { userId, scope: "domain", eventType: { in: ["manual_swap", "auto_failover", "manual_rollback"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    const currentPrimary =
      domains.find((d) => d.isDefault && d.purpose !== "tracking") ??
      domains.find((d) => d.routingRole === "primary" && d.purpose !== "tracking") ??
      null;

    const plan = planRollbackTarget({
      currentPrimaryId: currentPrimary?.id ?? null,
      events,
      domains: domains as unknown as RoutingDomainCandidate[],
    });
    if (!plan.ok) {
      return res.status(409).json({ error: plan.error });
    }

    try {
      const result = await promotePrimaryDomainForUser({
        userId,
        targetDomainId: plan.targetDomainId,
        actorUserId: req.user?.userId ?? userId,
        workspaceId: req.user?.workspaceId,
        reason: typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined,
        isRollback: true,
      });
      const list = await prisma.customDomain.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { hostname: "asc" }],
      });
      return res.json({ ok: true, ...result, domains: list.map((r) => mapRow(r)) });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Não foi possível executar rollback.",
      });
    }
  },

  /** Histórico de eventos de saúde, troca, failover, rollback e validação de ofertas. */
  async routingEvents(req: Request, res: Response) {
    const userId = billingUserId(req);
    const domainId = typeof req.query.domain_id === "string" ? req.query.domain_id.trim() : undefined;
    const presellId = typeof req.query.presell_id === "string" ? req.query.presell_id.trim() : undefined;
    const offerId = typeof req.query.offer_id === "string" ? req.query.offer_id.trim() : undefined;
    const limitRaw = Number(req.query.limit ?? 50);
    const take = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

    const rows = await prisma.domainRoutingEvent.findMany({
      where: {
        userId,
        ...(domainId ? { OR: [{ customDomainId: domainId }, { previousDomainId: domainId }, { targetDomainId: domainId }] } : {}),
        ...(presellId ? { presellId } : {}),
        ...(offerId ? { offerId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        customDomain: { select: { id: true, hostname: true } },
        previousDomain: { select: { id: true, hostname: true } },
        targetDomain: { select: { id: true, hostname: true } },
        presell: { select: { id: true, title: true, slug: true } },
        offer: { select: { id: true, name: true } },
      },
    });

    return res.json(
      rows.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        scope: e.scope,
        custom_domain_id: e.customDomainId,
        previous_domain_id: e.previousDomainId,
        target_domain_id: e.targetDomainId,
        presell_id: e.presellId,
        offer_id: e.offerId,
        actor_user_id: e.actorUserId,
        reason: e.reason,
        metadata: e.metadata ?? null,
        custom_domain: e.customDomain ? { id: e.customDomain.id, hostname: e.customDomain.hostname } : null,
        previous_domain: e.previousDomain ? { id: e.previousDomain.id, hostname: e.previousDomain.hostname } : null,
        target_domain: e.targetDomain ? { id: e.targetDomain.id, hostname: e.targetDomain.hostname } : null,
        presell: e.presell ? { id: e.presell.id, title: e.presell.title, slug: e.presell.slug } : null,
        offer: e.offer ? { id: e.offer.id, name: e.offer.name } : null,
        created_at: e.createdAt.toISOString(),
      })),
    );
  },
};
