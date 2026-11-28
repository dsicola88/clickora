import type { Request, Response } from "express";
import prisma from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import {
  selectAuthorizedDomainForPresell,
  domainFailThresholdFromEnv,
  type RoutingDomainCandidate,
} from "../lib/domainRoutingService";
import {
  classifyPresellRisk,
  computeUptimeFromTransitions,
  planFinalUrlContinuitySuggestion,
  type ContinuityDomain,
  type ContinuityPresellInfo,
  type FinalUrlSuggestion,
} from "../lib/domainContinuityPlanner";
import { domainMonitorConfigFromEnv } from "../lib/domainHealthMonitor";
import { autoFailoverEnabled, autoRecoveryHoldMs } from "../lib/domainFailover";
import { domainAlertsEnabled } from "../lib/domainContinuityAlerts";
import { getDomainContinuitySnapshot } from "../lib/domainContinuityMetrics";
import { isPlatformMainHostname } from "../lib/publicPresellHost";

const DAY_MS = 24 * 60 * 60_000;

function isMissingTableError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

function asStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export const continuityController = {
  /**
   * Painel de continuidade (Etapa 4): saúde/uptime dos domínios, presells em risco e assistente de
   * Final URL. Só leitura — nenhuma rota aqui altera anúncios na Google Ads.
   */
  async overview(req: Request, res: Response) {
    const userId = billingUserId(req);
    const now = new Date();

    let domains: Array<
      RoutingDomainCandidate & {
        lastHealthCheckAt: Date | null;
        lastHealthError: string | null;
        lastHttpStatus: number | null;
        rootPresellId: string | null;
        disabledReason: string | null;
      }
    >;
    try {
      domains = await prisma.customDomain.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { routingPriority: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          userId: true,
          hostname: true,
          status: true,
          purpose: true,
          isDefault: true,
          isDefaultTracking: true,
          routingRole: true,
          healthStatus: true,
          consecutiveFailures: true,
          autoRecover: true,
          isActive: true,
          routingPriority: true,
          lastHealthCheckAt: true,
          lastHealthError: true,
          lastHttpStatus: true,
          rootPresellId: true,
          disabledReason: true,
        },
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ error: "Migração de continuidade ainda não aplicada.", code: "CONTINUITY_SCHEMA_PENDING" });
      }
      throw e;
    }

    const [healthEvents, presells, recentEvents] = await Promise.all([
      prisma.domainRoutingEvent.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
          eventType: { in: ["health_check_passed", "health_check_degraded", "health_check_failed"] },
        },
        select: { customDomainId: true, createdAt: true, eventType: true, metadata: true },
        orderBy: { createdAt: "asc" },
        take: 10_000,
      }),
      prisma.presellPage.findMany({
        where: { userId, status: { not: "archived" } },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          customDomainId: true,
          domainBindings: { select: { customDomainId: true, role: true, priority: true, isActive: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1_000,
      }),
      prisma.domainRoutingEvent.findMany({
        where: {
          userId,
          eventType: {
            in: ["auto_failover", "auto_recovery", "manual_swap", "manual_rollback", "health_check_failed", "role_changed", "domain_disabled", "domain_enabled"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          eventType: true,
          scope: true,
          presellId: true,
          customDomainId: true,
          previousDomainId: true,
          targetDomainId: true,
          reason: true,
          createdAt: true,
          actorUserId: true,
        },
      }),
    ]);

    const byId = new Map(domains.map((d) => [d.id, d]));
    const eventsByDomain = new Map<string, typeof healthEvents>();
    for (const ev of healthEvents) {
      if (!ev.customDomainId) continue;
      const arr = eventsByDomain.get(ev.customDomainId) ?? [];
      arr.push(ev);
      eventsByDomain.set(ev.customDomainId, arr);
    }

    const accountSelection = selectAuthorizedDomainForPresell({ domains, bindings: [] });
    const accountCanonicalDomainId = accountSelection.domain?.id ?? null;
    const configuredAccountDefaultId =
      domains.find((d) => d.isDefault && String(d.purpose) !== "tracking")?.id ?? null;

    const presellInfoById = new Map<string, ContinuityPresellInfo & { slug: string | null }>();
    const presellIdBySlug = new Map<string, string>();
    const presellRows = presells.map((p) => {
      const selection = selectAuthorizedDomainForPresell({
        domains,
        bindings: p.domainBindings,
        legacyCustomDomainId: p.customDomainId,
      });
      // Sem binding/domínio explícito a presell segue o domínio padrão *configurado* da conta — não o canónico já
      // escolhido (que pode ser um backup e esconderia o risco de o padrão estar em baixo).
      const primaryId =
        p.domainBindings.find((b) => b.role === "primary" && b.isActive)?.customDomainId ??
        p.customDomainId ??
        configuredAccountDefaultId ??
        accountCanonicalDomainId;
      const primary = primaryId ? byId.get(primaryId) : null;
      const risk = classifyPresellRisk({
        hasSelectedDomain: Boolean(selection.domain),
        primary: primary ? { healthStatus: primary.healthStatus, isActive: primary.isActive } : null,
        usedFailover: Boolean(selection.usedFailover),
      });

      presellInfoById.set(p.id, {
        id: p.id,
        title: p.title,
        status: p.status,
        canonicalDomainId: selection.domain?.id ?? null,
        slug: p.slug,
      });
      if (p.slug) presellIdBySlug.set(p.slug.toLowerCase(), p.id);
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        canonical_domain_id: selection.domain?.id ?? null,
        canonical_hostname: selection.domain?.hostname ?? null,
        primary_domain_id: primaryId ?? null,
        primary_hostname: primary?.hostname ?? null,
        backup_count: p.domainBindings.filter((b) => b.role === "backup" && b.isActive).length,
        selection_reason: selection.reason,
        risk,
      };
    });

    const continuityDomains: ContinuityDomain[] = domains.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      status: d.status,
      purpose: String(d.purpose),
      isActive: d.isActive,
      healthStatus: d.healthStatus,
    }));

    type AdRow = {
      rsaId: string;
      externalAdId: string | null;
      campaignName: string;
      adGroupName: string;
      currentUrl: string;
    } & FinalUrlSuggestion;
    const adsSuggestions: AdRow[] = [];
    let adsAvailable = true;
    try {
      const rsas = await prisma.paidAdsRsa.findMany({
        where: {
          status: { not: "archived" },
          adGroup: { campaign: { userId, platform: "google_ads", status: { not: "archived" } } },
        },
        select: {
          id: true,
          externalAdId: true,
          finalUrls: true,
          adGroup: { select: { name: true, campaign: { select: { name: true } } } },
        },
        take: 1_000,
      });
      for (const rsa of rsas) {
        const first = asStringArray(rsa.finalUrls)[0];
        if (!first) continue;
        const plan = planFinalUrlContinuitySuggestion({
          finalUrl: first,
          domains: continuityDomains,
          accountCanonicalDomainId,
          isPlatformHost: (h) => isPlatformMainHostname(h),
          resolvePresell: (ref, domain) => {
            if (ref.kind === "id") return presellInfoById.get(ref.value) ?? null;
            if (ref.kind === "slug") {
              const id = presellIdBySlug.get(ref.value.toLowerCase());
              return id ? presellInfoById.get(id) ?? null : null;
            }
            const rootId = domain ? byId.get(domain.id)?.rootPresellId : null;
            return rootId ? presellInfoById.get(rootId) ?? null : null;
          },
        });
        if (!plan) continue;
        adsSuggestions.push({
          rsaId: rsa.id,
          externalAdId: rsa.externalAdId,
          campaignName: rsa.adGroup.campaign.name,
          adGroupName: rsa.adGroup.name,
          currentUrl: first,
          ...plan,
        });
      }
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
      adsAvailable = false;
    }
    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    adsSuggestions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    const monitorCfg = domainMonitorConfigFromEnv();
    return res.json({
      generated_at: now.toISOString(),
      monitor: {
        enabled: monitorCfg.enabled,
        check_interval_min: Math.round(monitorCfg.healthyIntervalMs / 60_000),
        recheck_interval_min: Math.round(monitorCfg.recheckIntervalMs / 60_000),
        fail_threshold: domainFailThresholdFromEnv(),
        auto_failover_enabled: autoFailoverEnabled(),
        auto_recovery_hold_min: Math.round(autoRecoveryHoldMs() / 60_000),
        alerts_enabled: domainAlertsEnabled(),
      },
      account_canonical_domain_id: accountCanonicalDomainId,
      domains: domains.map((d) => {
        const evs = eventsByDomain.get(d.id) ?? [];
        return {
          id: d.id,
          hostname: d.hostname,
          status: d.status,
          purpose: d.purpose,
          is_default: d.isDefault,
          is_default_tracking: d.isDefaultTracking,
          is_active: d.isActive,
          routing_role: d.routingRole,
          routing_priority: d.routingPriority,
          health_status: d.healthStatus,
          consecutive_failures: d.consecutiveFailures,
          auto_recover: d.autoRecover,
          last_health_check_at: d.lastHealthCheckAt?.toISOString() ?? null,
          last_health_error: d.lastHealthError,
          last_http_status: d.lastHttpStatus,
          disabled_reason: d.disabledReason,
          uptime_24h: computeUptimeFromTransitions({
            events: evs,
            windowStart: new Date(now.getTime() - DAY_MS),
            now,
            currentStatus: d.healthStatus,
          }),
          uptime_7d: computeUptimeFromTransitions({
            events: evs,
            windowStart: new Date(now.getTime() - 7 * DAY_MS),
            now,
            currentStatus: d.healthStatus,
          }),
          presell_count: presellRows.filter((p) => p.canonical_domain_id === d.id).length,
        };
      }),
      presells: presellRows,
      ads: {
        available: adsAvailable,
        suggestions: adsSuggestions,
      },
      recent_events: recentEvents.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        scope: e.scope,
        presell_id: e.presellId,
        custom_domain_id: e.customDomainId,
        previous_domain_id: e.previousDomainId,
        target_domain_id: e.targetDomainId,
        previous_hostname: e.previousDomainId ? byId.get(e.previousDomainId)?.hostname ?? null : null,
        target_hostname: e.targetDomainId ? byId.get(e.targetDomainId)?.hostname ?? null : null,
        domain_hostname: e.customDomainId ? byId.get(e.customDomainId)?.hostname ?? null : null,
        reason: e.reason,
        automatic: !e.actorUserId,
        created_at: e.createdAt.toISOString(),
      })),
      metrics: getDomainContinuitySnapshot(),
    });
  },
};
