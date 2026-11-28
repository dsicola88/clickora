import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { CONTINUITY_SCHEMA_PENDING, continuityService } from "@/services/continuityService";
import { formatUptime, GOOGLE_ADS_UI_URL, presellsAtRisk, uptimeTone } from "@/lib/continuityDisplay";
import type { ContinuityOverviewDto } from "@/types/api";

class ContinuityLoadError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

const HEALTH_CLS: Record<string, string> = {
  healthy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  degraded: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  down: "bg-destructive/15 text-destructive",
  unknown: "bg-muted/70 text-muted-foreground",
};

const UPTIME_CLS: Record<string, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-300",
  bad: "text-destructive",
  none: "text-muted-foreground",
};

const SEVERITY_CLS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

export function DomainContinuityPanel() {
  const { m } = useAppLocale();
  const cp = m.pages.continuity.panel;
  const cd = m.pages.continuity.domains;
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["continuity-overview", tenantKey],
    queryFn: async (): Promise<ContinuityOverviewDto> => {
      const res = await continuityService.getOverview();
      if (res.error || !res.data) throw new ContinuityLoadError(res.error || cp.loadError, res.errorCode ?? null);
      return res.data;
    },
    enabled: !!tenantKey,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: (count, err) => !(err instanceof ContinuityLoadError && err.code === CONTINUITY_SCHEMA_PENDING) && count < 2,
  });

  useEffect(() => {
    if (window.location.hash !== "#continuidade") return;
    document.getElementById("continuidade")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const roleLabel: Record<string, string> = {
    primary: cd.rolePrimary,
    backup: cd.roleBackup,
    standby: cd.roleStandby,
  };
  const healthLabel: Record<string, string> = {
    healthy: cd.statusHealthy,
    degraded: cd.statusDegraded,
    down: cd.statusDown,
    unknown: cd.statusUnknown,
  };
  const riskLabel: Record<string, string> = {
    no_domain: cp.risk_no_domain,
    primary_down: cp.risk_primary_down,
    primary_paused: cp.risk_primary_paused,
    on_backup: cp.risk_on_backup,
  };
  const issueLabel: Record<string, string> = {
    domain_down: cp.issue_domain_down,
    domain_paused: cp.issue_domain_paused,
    domain_unverified: cp.issue_domain_unverified,
    unknown_host: cp.issue_unknown_host,
    presell_unpublished: cp.issue_presell_unpublished,
    not_canonical: cp.issue_not_canonical,
  };
  const severityLabel: Record<string, string> = {
    critical: cp.severity_critical,
    warning: cp.severity_warning,
    info: cp.severity_info,
  };
  const eventLabel: Record<string, string> = {
    auto_failover: cp.event_auto_failover,
    auto_recovery: cp.event_auto_recovery,
    manual_swap: cp.event_manual_swap,
    manual_rollback: cp.event_manual_rollback,
    health_check_failed: cp.event_health_check_failed,
    role_changed: cp.event_role_changed,
    domain_disabled: cp.event_domain_disabled,
    domain_enabled: cp.event_domain_enabled,
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(cp.copied);
    } catch {
      toast.error(url);
    }
  };

  const schemaPending = error instanceof ContinuityLoadError && error.code === CONTINUITY_SCHEMA_PENDING;
  const risky = data ? presellsAtRisk(data.presells) : [];

  return (
    <div id="continuidade" className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-5 scroll-mt-20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-card-foreground">{cp.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{cp.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs shrink-0"
          disabled={isFetching || schemaPending}
          onClick={() => void refetch()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {cp.refresh}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {cp.loading}
        </div>
      ) : schemaPending ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-border/50 bg-muted/20 p-3">{cp.schemaPending}</p>
      ) : error || !data ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : cp.loadError}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`px-2 py-1 rounded-full font-medium ${
                data.monitor.enabled ? HEALTH_CLS.healthy : HEALTH_CLS.unknown
              }`}
              title={fill(cp.monitorDetail, {
                interval: data.monitor.check_interval_min,
                recheck: data.monitor.recheck_interval_min,
                threshold: data.monitor.fail_threshold,
              })}
            >
              <Activity className="inline h-3 w-3 mr-1 -mt-0.5" />
              {data.monitor.enabled ? cp.monitorOn : cp.monitorOff}
            </span>
            <span
              className={`px-2 py-1 rounded-full font-medium ${
                data.monitor.auto_failover_enabled ? HEALTH_CLS.healthy : HEALTH_CLS.unknown
              }`}
              title={fill(cp.recoveryDetail, { hold: data.monitor.auto_recovery_hold_min })}
            >
              {data.monitor.auto_failover_enabled ? cp.failoverOn : cp.failoverOff}
            </span>
            <span
              className={`px-2 py-1 rounded-full font-medium ${
                data.monitor.alerts_enabled ? HEALTH_CLS.healthy : HEALTH_CLS.unknown
              }`}
            >
              {data.monitor.alerts_enabled ? cp.alertsOn : cp.alertsOff}
            </span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {fill(cp.monitorDetail, {
              interval: data.monitor.check_interval_min,
              recheck: data.monitor.recheck_interval_min,
              threshold: data.monitor.fail_threshold,
            })}
            {" · "}
            {fill(cp.recoveryDetail, { hold: data.monitor.auto_recovery_hold_min })}
          </p>

          <section className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">{cp.domainsTitle}</h4>
            {data.domains.length === 0 ? (
              <p className="text-xs text-muted-foreground">{cp.noDomains}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">{cp.colDomain}</th>
                      <th className="px-3 py-2 font-medium">{cp.colRole}</th>
                      <th className="px-3 py-2 font-medium">{cp.colHealth}</th>
                      <th className="px-3 py-2 font-medium text-right">{cp.colUptime24}</th>
                      <th className="px-3 py-2 font-medium text-right">{cp.colUptime7}</th>
                      <th className="px-3 py-2 font-medium">{cp.colLastCheck}</th>
                      <th className="px-3 py-2 font-medium text-right">{cp.colPresells}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.domains.map((d) => (
                      <tr key={d.id} className="border-t border-border/40">
                        <td className="px-3 py-2 font-mono">{d.hostname}</td>
                        <td className="px-3 py-2">{d.purpose === "tracking" ? "—" : roleLabel[d.routing_role] ?? d.routing_role}</td>
                        <td className="px-3 py-2">
                          <span
                            title={d.last_health_error || undefined}
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              !d.is_active ? HEALTH_CLS.unknown : HEALTH_CLS[d.health_status] ?? HEALTH_CLS.unknown
                            }`}
                          >
                            {!d.is_active ? cd.statusPaused : healthLabel[d.health_status] ?? d.health_status}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${UPTIME_CLS[uptimeTone(d.uptime_24h)]}`}>
                          {formatUptime(d.uptime_24h)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${UPTIME_CLS[uptimeTone(d.uptime_7d)]}`}>
                          {formatUptime(d.uptime_7d)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          {d.last_health_check_at ? new Date(d.last_health_check_at).toLocaleString() : cp.never}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.presell_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">{cp.presellsTitle}</h4>
            {risky.length === 0 ? (
              <p className="text-xs text-muted-foreground">{cp.noRisk}</p>
            ) : (
              <ul className="space-y-1.5">
                {risky.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-background/70 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-foreground">{p.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {p.canonical_hostname ? (
                        <span className="text-muted-foreground font-mono">
                          {fill(cp.presellCanonical, { host: p.canonical_hostname })}
                        </span>
                      ) : null}
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          p.risk === "on_backup" ? SEVERITY_CLS.warning : SEVERITY_CLS.critical
                        }`}
                      >
                        {riskLabel[p.risk] ?? p.risk}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">{cp.adsTitle}</h4>
            <p className="text-xs text-muted-foreground">{cp.adsDescription}</p>
            {!data.ads.available ? (
              <p className="text-xs text-muted-foreground">{cp.adsUnavailable}</p>
            ) : data.ads.suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{cp.adsNone}</p>
            ) : (
              <ul className="space-y-2">
                {data.ads.suggestions.map((s) => (
                  <li key={s.rsaId} className="rounded-lg border border-border/50 bg-background/70 p-3 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {fill(cp.campaignLine, { campaign: s.campaignName, adGroup: s.adGroupName })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${SEVERITY_CLS[s.severity] ?? SEVERITY_CLS.info}`}>
                          {severityLabel[s.severity] ?? s.severity}
                        </span>
                        <span className="text-foreground/90">{issueLabel[s.issue] ?? s.issue}</span>
                      </span>
                    </div>
                    <p className="font-mono break-all">
                      <span className="text-muted-foreground mr-1.5">{cp.currentUrl}:</span>
                      {s.currentUrl}
                    </p>
                    {s.suggestedUrl ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono break-all text-emerald-700 dark:text-emerald-400 min-w-0 flex-1">
                          <span className="text-muted-foreground mr-1.5">{cp.suggestedUrl}:</span>
                          {s.suggestedUrl}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => void copyUrl(s.suggestedUrl!)}
                        >
                          <Copy className="h-3 w-3" /> {cp.copy}
                        </Button>
                        <a
                          href={GOOGLE_ADS_UI_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-input px-2 text-[11px] hover:bg-muted"
                        >
                          <ExternalLink className="h-3 w-3" /> {cp.openAds}
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{cp.noSuggestion}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">{cp.eventsTitle}</h4>
            {data.recent_events.length === 0 ? (
              <p className="text-xs text-muted-foreground">{cp.noEvents}</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {data.recent_events.slice(0, 12).map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/30 pb-1 last:border-b-0 last:pb-0"
                  >
                    <span className="text-foreground/90">
                      <span className="font-medium mr-1.5">{eventLabel[ev.event_type] ?? ev.event_type}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">
                        {ev.automatic ? cp.automatic : cp.manual}
                      </span>
                      {ev.previous_hostname && ev.target_hostname
                        ? `${ev.previous_hostname} → ${ev.target_hostname}`
                        : ev.domain_hostname || ev.reason || ""}
                    </span>
                    <span className="text-[11px] tabular-nums shrink-0">{new Date(ev.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium text-card-foreground">{cp.metricsTitle}</h4>
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {[
                [cp.metricsChecks, String(data.metrics.checks_total)],
                [cp.metricsFailures, String(data.metrics.checks_failed)],
                [cp.metricsFailovers, String(data.metrics.failovers)],
                [cp.metricsRecoveries, String(data.metrics.recoveries)],
                [
                  cp.metricsFailoverLatency,
                  data.metrics.failover_latency.p95_ms != null
                    ? `${Math.round(data.metrics.failover_latency.p95_ms / 1000)}s`
                    : "—",
                ],
                [
                  cp.metricsLastTick,
                  data.metrics.last_tick ? fill(cp.secondsAgo, { n: data.metrics.last_tick.age_s }) : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
