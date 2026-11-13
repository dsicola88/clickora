import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  countryDisplayLabel,
  countryFlagEmoji,
  normalizeIsoCountryCode,
} from "@/lib/countryDisplay";
import { downloadTextCsv, reportRowsToCsv } from "@/lib/reportRowsCsv";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor, type MessageKey } from "@/i18n";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";

type Props = {
  from: string;
  to: string;
};

type RowFilter = "all" | "suspects" | "bots" | "cloud";

/** Alinhado com `parseIpv4Blacklist` no backend — só IPv4 entra na blacklist. */
function isIpv4(ip: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return ip.split(".").every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

const REASON_KEYS: Record<string, MessageKey> = {
  paid_repeat_visits: "pages.reports.suspectReasonPaidVisits",
  paid_repeat_clicks: "pages.reports.suspectReasonPaidClicks",
  paid_missing_click_id: "pages.reports.suspectReasonNoClickId",
  cloud_on_paid: "pages.reports.suspectReasonCloudPaid",
  high_volume_no_sale: "pages.reports.suspectReasonHighVolume",
  competition_geo: "pages.reports.suspectReasonGeo",
};

function CountryCell({ code }: { code: string | null }) {
  const iso = normalizeIsoCountryCode(code || "");
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={countryDisplayLabel(iso)}>
      <span className="text-base leading-none" aria-hidden>
        {countryFlagEmoji(iso)}
      </span>
      <span className="font-mono text-xs">{iso}</span>
    </span>
  );
}

export function SuspiciousTrafficPanel({ from, to }: Props) {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const queryClient = useQueryClient();
  const [traffic, setTraffic] = useState<"all" | "paid" | "organic">("all");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [blockingAll, setBlockingAll] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["analytics-visitor-ips", from, to, traffic],
    queryFn: async () => {
      const { data: report, error } = await analyticsService.getVisitorIps({
        from,
        to,
        traffic,
        limit: 150,
      });
      if (error) throw new Error(error);
      if (!report) throw new Error(t("pages.reports.suspectError"));
      return report;
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      if (!isIpv4(ip)) {
        throw new Error(t("pages.reports.suspectIpv4Only"));
      }
      const { error } = await integrationsService.addBlacklist({
        ip,
        reason: t("pages.reports.suspectBlockReason"),
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success(t("pages.reports.ipBlocked"));
      void queryClient.invalidateQueries({ queryKey: ["analytics-visitor-ips"] });
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message || t("pages.reports.ipBlockFail")),
  });

  const displayRows = useMemo(() => {
    const rows = data?.rows ?? [];
    if (rowFilter === "suspects") return rows.filter((r) => r.is_suspect);
    if (rowFilter === "bots") return rows.filter((r) => r.is_bot);
    if (rowFilter === "cloud") return rows.filter((r) => r.is_cloud);
    return rows;
  }, [data?.rows, rowFilter]);

  const suspectsToBlock = useMemo(
    () => (data?.rows ?? []).filter((r) => r.is_suspect && !r.blacklisted && isIpv4(r.ip)),
    [data?.rows],
  );

  const reasonLabel = (code: string) => {
    const key = REASON_KEYS[code];
    return key ? t(key) : code;
  };

  const handleExport = () => {
    if (!displayRows.length) {
      toast.error(t("pages.reports.suspectEmpty"));
      return;
    }
    const yes = t("common.yes");
    const no = t("common.no");
    const cols = [
      { key: "last_seen", header: t("pages.reports.suspectColLast") },
      { key: "ip", header: "IP" },
      { key: "visits", header: t("pages.reports.suspectColVisits") },
      { key: "clicks", header: t("pages.reports.tabClicks") },
      { key: "suspect", header: t("pages.reports.suspectColSuspect") },
      { key: "reasons", header: t("pages.reports.suspectColReasons") },
      { key: "bot", header: t("pages.reports.suspectColBot") },
      { key: "cloud", header: "Cloud" },
      { key: "country", header: t("pages.reports.colCountry") },
      { key: "traffic", header: t("pages.reports.suspectColTraffic") },
      { key: "fuga", header: t("pages.reports.suspectFuga") },
      { key: "sale", header: t("pages.reports.suspectColSale") },
      { key: "blocked", header: t("pages.reports.suspectColBlocked") },
    ];
    const rows = displayRows.map((r) => ({
      last_seen: new Date(r.last_seen).toLocaleString(locale),
      ip: r.ip,
      visits: String(r.visits),
      clicks: String(r.clicks),
      suspect: r.is_suspect ? yes : no,
      reasons: (r.suspect_reasons || []).map(reasonLabel).join("; "),
      bot: r.is_bot ? (r.bot_label ? `${yes} (${r.bot_label})` : yes) : no,
      cloud: r.is_cloud ? (r.cloud_label ? `${yes} (${r.cloud_label})` : yes) : no,
      country: r.country || "",
      traffic:
        r.traffic_type === "organic"
          ? t("pages.funnel.labelOrganic")
          : r.traffic_type === "paid"
            ? t("pages.funnel.labelPaid")
            : t("pages.reports.noClickId"),
      fuga: r.fuga_pct == null ? "" : `${r.fuga_pct}%`,
      sale: r.has_sale ? yes : no,
      blocked: r.blacklisted ? yes : no,
    }));
    const csv = reportRowsToCsv(rows, cols);
    downloadTextCsv(`dclickora-ips-suspeitos_${from}_${to}.csv`, csv);
    toast.success(fill(t("pages.reports.exportedRows"), { n: String(rows.length) }));
  };

  const handleBlockSuspects = async () => {
    if (!suspectsToBlock.length) {
      toast.message(t("pages.reports.suspectNoSuspects"));
      return;
    }
    const ok = window.confirm(
      fill(t("pages.reports.suspectBlockSuspectsConfirm"), { n: String(suspectsToBlock.length) }),
    );
    if (!ok) return;
    setBlockingAll(true);
    let done = 0;
    let failed = 0;
    try {
      for (const row of suspectsToBlock) {
        const { error } = await integrationsService.addBlacklist({
          ip: row.ip,
          reason: t("pages.reports.suspectBlockReason"),
        });
        if (error) failed += 1;
        else done += 1;
      }
    } finally {
      setBlockingAll(false);
      void queryClient.invalidateQueries({ queryKey: ["analytics-visitor-ips"] });
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    }
    if (done) toast.success(fill(t("pages.reports.suspectBlockedN"), { n: String(done) }));
    if (failed) toast.error(fill(t("pages.reports.suspectBlockFailN"), { n: String(failed) }));
  };

  if (isLoading) return <LoadingState message={t("pages.reports.suspectLoading")} />;
  if (isError || !data) {
    return <ErrorState message={t("pages.reports.suspectError")} onRetry={() => void refetch()} />;
  }

  const s = data.summary;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        {t("pages.reports.suspectHint")}{" "}
        <Link to="/tracking/blacklist" className="underline underline-offset-2 text-foreground/90">
          {t("pages.reports.suspectGuardsLink")}
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("pages.reports.filterType")}:</span>
        {(["all", "paid", "organic"] as const).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={traffic === key ? "default" : "outline"}
            onClick={() => setTraffic(key)}
            disabled={isFetching}
          >
            {key === "all"
              ? t("common.all")
              : key === "paid"
                ? t("pages.funnel.labelPaid")
                : t("pages.funnel.labelOrganic")}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">{t("pages.reports.suspectRowFilter")}:</span>
        {(
          [
            ["all", "pages.reports.suspectFilterAll"],
            ["suspects", "pages.reports.suspectFilterSuspects"],
            ["bots", "pages.reports.suspectFilterBots"],
            ["cloud", "pages.reports.suspectFilterCloud"],
          ] as const
        ).map(([key, labelKey]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={rowFilter === key ? "secondary" : "outline"}
            onClick={() => setRowFilter(key)}
          >
            {t(labelKey)}
          </Button>
        ))}
        <div className="flex-1" />
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t("pages.reports.exportCsv")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="gap-1.5"
          disabled={blockingAll || !suspectsToBlock.length}
          onClick={() => void handleBlockSuspects()}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {t("pages.reports.suspectBlockSuspects")}
          {suspectsToBlock.length ? ` (${suspectsToBlock.length})` : ""}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-sky-500/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
            {t("pages.reports.suspectVisits")}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {s.visits.toLocaleString(numLocale)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-amber-500/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            {t("pages.reports.tabClicks")}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {s.clicks.toLocaleString(numLocale)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-emerald-500/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            {t("pages.reports.suspectFuga")}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {s.fuga_pct == null ? "—" : `${s.fuga_pct.toLocaleString(numLocale)}%`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden />
          {t("pages.reports.suspectLegendSuspect")} ({s.suspects})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
          {t("pages.reports.suspectLegendBot")} ({s.bots})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
          {t("pages.reports.suspectLegendSale")} ({s.with_sale})
        </span>
        <span className="text-muted-foreground">Cloud: {s.cloud}</span>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.suspectColLast")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">IP</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.suspectColVisits")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.suspectColSuspect")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.suspectColBot")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.colCountry")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground">{t("pages.reports.suspectColTraffic")}</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-right">{t("pages.blacklist.action")}</th>
              </tr>
            </thead>
            <tbody>
              {!displayRows.length ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    {t("pages.reports.suspectEmpty")}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const rowClass = row.has_sale
                    ? "bg-emerald-500/5"
                    : row.is_bot
                      ? "bg-amber-500/10"
                      : row.is_suspect
                        ? "bg-destructive/5"
                        : "";
                  const canBlock = isIpv4(row.ip);
                  const reasonsTitle = (row.suspect_reasons || []).map(reasonLabel).join(" · ");
                  return (
                    <tr key={row.ip} className={`border-b border-border/50 ${rowClass}`}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs tabular-nums">
                        {new Date(row.last_seen).toLocaleString(locale)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {row.ip}
                        {row.is_bot && row.bot_label ? (
                          <span className="ml-1 text-amber-800 dark:text-amber-300">[{row.bot_label}]</span>
                        ) : null}
                        {row.is_cloud && row.cloud_label ? (
                          <span className="ml-1 text-muted-foreground">[{row.cloud_label}]</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums">{row.visits.toLocaleString(numLocale)}</td>
                      <td className="py-2.5 px-3 font-medium" title={reasonsTitle || undefined}>
                        {row.is_suspect ? (
                          <span className="text-destructive">{t("common.yes")}</span>
                        ) : (
                          <span className="text-muted-foreground">{t("common.no")}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {row.is_bot ? (
                          <span className="text-amber-800 dark:text-amber-300">{t("common.yes")}</span>
                        ) : (
                          <span className="text-muted-foreground">{t("common.no")}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <CountryCell code={row.country} />
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        {row.traffic_type === "organic"
                          ? t("pages.funnel.labelOrganic")
                          : row.traffic_type === "paid"
                            ? t("pages.funnel.labelPaid")
                            : t("pages.reports.noClickId")}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {row.blacklisted ? (
                          <span className="text-xs text-muted-foreground">{t("pages.reports.suspectAlreadyBlocked")}</span>
                        ) : !canBlock ? (
                          <span className="text-xs text-muted-foreground" title={t("pages.reports.suspectIpv4Only")}>
                            {t("pages.reports.suspectIpv4OnlyShort")}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1"
                            title={t("pages.reports.blockIpTitle")}
                            disabled={blockIpMutation.isPending || blockingAll}
                            onClick={() => {
                              if (
                                window.confirm(
                                  fill(t("pages.reports.blockIpConfirm"), { ip: row.ip }),
                                )
                              ) {
                                blockIpMutation.mutate(row.ip);
                              }
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {t("pages.reports.suspectBlockOne")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
