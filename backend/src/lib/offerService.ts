import type { DomainRoutingRole, OfferValidationStatus, Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { probeDestinationUrl } from "../compliance/destinationProbe";
import { validateOfferSafety } from "./offerValidation";
import { recordDomainRoutingEvent } from "./domainRoutingService";
import { invalidateTrackEdgeDest } from "./trackEdgeDestCache";
import { appendWorkspaceAuditLog } from "./workspaceAudit";

/**
 * Propaga hoplink atual da Offer para presells ligadas (content.affiliateLink + tracking.offerUrl)
 * preservando compatibilidade com renderer SPA, lite HTML e compliance audit, sem mexer em Final URLs.
 */
export async function syncOfferHoplinkToLinkedPresells(args: {
  userId: string;
  offerId: string;
  hoplinkUrl: string;
}): Promise<string[]> {
  const pages = await systemPrisma.presellPage.findMany({
    where: { userId: args.userId, offerId: args.offerId },
    select: { id: true, content: true, tracking: true },
  });

  const updatedIds: string[] = [];
  for (const page of pages) {
    const prevContent =
      page.content && typeof page.content === "object" && !Array.isArray(page.content)
        ? { ...(page.content as Record<string, unknown>) }
        : {};
    const prevTracking =
      page.tracking && typeof page.tracking === "object" && !Array.isArray(page.tracking)
        ? { ...(page.tracking as Record<string, unknown>) }
        : {};

    prevContent.affiliateLink = args.hoplinkUrl;
    prevContent.affiliate_link = args.hoplinkUrl;
    prevTracking.offerUrl = args.hoplinkUrl;
    prevTracking.offer_url = args.hoplinkUrl;

    await systemPrisma.presellPage.update({
      where: { id: page.id },
      data: {
        content: prevContent as Prisma.InputJsonValue,
        tracking: prevTracking as Prisma.InputJsonValue,
      },
    });
    void invalidateTrackEdgeDest(page.id);
    updatedIds.push(page.id);
  }

  await systemPrisma.affiliateCampaign.updateMany({
    where: { userId: args.userId, offerId: args.offerId },
    data: { offerUrl: args.hoplinkUrl },
  });

  return updatedIds;
}

/**
 * Executa validação estática + probe HTTP SSRF-safe da Offer e persiste resultado + evento.
 */
export async function validateAndPersistOffer(args: {
  offerId: string;
  userId: string;
  actorUserId?: string | null;
  skipNetworkProbe?: boolean;
}) {
  const offer = await systemPrisma.offer.findFirst({
    where: { id: args.offerId, userId: args.userId },
  });
  if (!offer) {
    throw new Error("Oferta não encontrada.");
  }

  const safety = validateOfferSafety({
    hoplinkUrl: offer.hoplinkUrl,
    backupHoplinkUrl: offer.backupHoplinkUrl,
    network: offer.network,
  });

  let validationStatus: OfferValidationStatus = safety.status;
  let compliancePassed = safety.ok;
  let lastValidationError: string | null = safety.issues[0]?.message ?? null;
  let resolvedFinalHost: string | null = null;
  let probeDetail: Record<string, unknown> | null = null;

  if (safety.ok && !args.skipNetworkProbe) {
    const probe = await probeDestinationUrl(offer.hoplinkUrl);
    resolvedFinalHost = probe.finalHost ?? probe.initialHost ?? null;
    probeDetail = {
      ok: probe.ok,
      status_code: probe.statusCode,
      redirect_count: probe.redirectCount,
      redirect_cycle: probe.redirectCycle,
      open_redirect_suspect: probe.openRedirectSuspect,
      crawler_blocked: probe.crawlerBlocked,
      final_host: resolvedFinalHost,
      error_code: probe.errorCode ?? null,
    };

    if (probe.errorCode === "ssrf_blocked") {
      validationStatus = "blocked";
      compliancePassed = false;
      lastValidationError = probe.errorMessage || "Destino bloqueado por segurança.";
    } else if (probe.redirectCycle || probe.openRedirectSuspect) {
      /** Heurísticas (sonda sem cookies, regex de redirect) não bloqueiam: um falso positivo cortaria tráfego pago. */
      validationStatus = "warning";
      compliancePassed = true;
      lastValidationError = probe.redirectCycle
        ? "Possível loop de redirecionamentos na verificação (sem cookies). Confirme o hoplink no browser."
        : "O destino tem um parâmetro de redirecionamento para outro site. Confirme que é o da rede de afiliados.";
    } else if (!probe.ok && !probe.crawlerBlocked) {
      validationStatus = "warning";
      compliancePassed = true;
      lastValidationError = probe.statusCode
        ? `Destino respondeu HTTP ${probe.statusCode} na verificação.`
        : probe.errorMessage || "Não foi possível confirmar HTTP 2xx/3xx no destino.";
    } else {
      validationStatus = "valid";
      compliancePassed = true;
      lastValidationError = null;
    }
  } else if (safety.ok) {
    try {
      resolvedFinalHost = new URL(offer.hoplinkUrl).hostname.toLowerCase();
    } catch {
      resolvedFinalHost = null;
    }
  }

  const updated = await systemPrisma.offer.update({
    where: { id: offer.id },
    data: {
      network: offer.network || safety.detectedNetwork,
      validationStatus,
      compliancePassed,
      lastValidatedAt: new Date(),
      lastValidationError: lastValidationError ? lastValidationError.slice(0, 500) : null,
      resolvedFinalHost,
      metadata: probeDetail ? (probeDetail as Prisma.InputJsonValue) : undefined,
    },
  });

  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: validationStatus === "blocked" ? "offer_blocked" : "offer_validated",
    scope: "offer",
    offerId: offer.id,
    actorUserId: args.actorUserId ?? null,
    reason: lastValidationError || `Oferta validada (${validationStatus}).`,
    metadata: {
      validation_status: validationStatus,
      resolved_final_host: resolvedFinalHost,
      ...(probeDetail ?? {}),
    },
  });

  // Invalida cache edge das presells ligadas (se oferta foi bloqueada, deixa de redirecionar).
  const linkedPages = await systemPrisma.presellPage.findMany({
    where: { userId: args.userId, offerId: offer.id },
    select: { id: true },
  });
  for (const p of linkedPages) {
    void invalidateTrackEdgeDest(p.id);
  }

  return updated;
}

export async function syncOfferDomainBindings(args: {
  userId: string;
  offerId: string;
  bindings: Array<{
    customDomainId: string;
    role: DomainRoutingRole;
    priority?: number;
    isActive?: boolean;
  }>;
  actorUserId?: string | null;
  workspaceId?: string | null;
}) {
  const offer = await systemPrisma.offer.findFirst({
    where: { id: args.offerId, userId: args.userId },
    select: { id: true },
  });
  if (!offer) throw new Error("Oferta não encontrada.");

  const domainIds = [...new Set(args.bindings.map((b) => b.customDomainId))];
  const ownedDomains = domainIds.length
    ? await systemPrisma.customDomain.findMany({
        where: { id: { in: domainIds }, userId: args.userId, status: "verified" },
      })
    : [];
  if (ownedDomains.length !== domainIds.length) {
    throw new Error("Um ou mais domínios são inválidos ou não estão verificados.");
  }

  let seenPrimary = false;
  const normalized = args.bindings.map((b, idx) => {
    const active = b.isActive !== false;
    let role = b.role;
    if (role === "primary" && active) {
      if (seenPrimary) role = "backup";
      else seenPrimary = true;
    }
    return {
      customDomainId: b.customDomainId,
      role,
      priority: typeof b.priority === "number" ? b.priority : role === "primary" ? 10 : 100 + idx * 10,
      isActive: active,
    };
  });

  await systemPrisma.$transaction(async (tx) => {
    await tx.offerDomainBinding.deleteMany({
      where: { offerId: args.offerId, userId: args.userId },
    });
    if (normalized.length > 0) {
      await tx.offerDomainBinding.createMany({
        data: normalized.map((b) => ({
          userId: args.userId,
          offerId: args.offerId,
          customDomainId: b.customDomainId,
          role: b.role,
          priority: b.priority,
          isActive: b.isActive,
        })),
      });
    }
  });

  await recordDomainRoutingEvent({
    userId: args.userId,
    eventType: "binding_updated",
    scope: "offer",
    offerId: args.offerId,
    actorUserId: args.actorUserId ?? null,
    reason: `Atualizados ${normalized.length} domínio(s) autorizados para a oferta.`,
    metadata: { bindings: normalized },
  });

  if (args.workspaceId && args.actorUserId) {
    await appendWorkspaceAuditLog({
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      action: "offer.domains_updated",
      resourceType: "offer",
      resourceId: args.offerId,
      metadata: { count: normalized.length },
    });
  }
}
