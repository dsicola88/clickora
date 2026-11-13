import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, RotateCcw, Download, Ban, Copy } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { APP_PAGE_SHELL_PRO } from "@/lib/appPageLayout";
import { ProInlineLink, ProPageHeader } from "@/components/enterprise/ProShell";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { NextAccountActionBanner } from "@/components/NextAccountActionBanner";
import { analyticsService } from "@/services/analyticsService";
import type { TrackingEvent } from "@/types/api";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  countryDisplayLabel,
  countryFlagEmoji,
  normalizeIsoCountryCode,
} from "@/lib/countryDisplay";
import { GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL } from "@/lib/googleAdsOfflineImport";
import { explainTrafficTypeLabel, resolveTrafficType } from "@/lib/networkClickId";
import {
  resolveClickVisitorQuality,
  type ClickVisitorKind,
} from "@/lib/clickVisitorQuality";
import { rangeToday } from "@/lib/dateRangePresets";
import { AFFILIATE_PLATFORMS, EXTRA_OFFER_PLATFORMS } from "@/lib/marketingPlatforms";
import { ReportDimensionStrip } from "@/components/ReportDimensionStrip";
import { downloadTextCsv, reportRowsToCsv } from "@/lib/reportRowsCsv";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor, type MessageKey } from "@/i18n";
import {
  collectDatacenterIpsForGoogleAdsExclusion,
  formatGoogleAdsIpExclusionList,
} from "@/lib/googleAdsIpExclusion";

/** Redes no filtro de conversões (mesma lista que Integrações / Construtor de URL). */
const RELATORIO_PLATFORM_OPTIONS = [...new Set([...AFFILIATE_PLATFORMS, ...EXTRA_OFFER_PLATFORMS])].sort((a, b) =>
  a.localeCompare(b, "pt", { sensitivity: "base" }),
);

function platformFilterValue(label: string) {
  return label.toLowerCase().replace(/[\s_\-]+/g, "");
}

function visitorSituationClass(kind: ClickVisitorKind): string {
  if (kind === "real") return "bg-success/10 text-success";
  if (kind === "bot") return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  return "bg-destructive/10 text-destructive";
}

function CountryCell({ code }: { code: string }) {
  const iso = normalizeIsoCountryCode(code === "—" ? "" : code);
  if (!iso) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5" title={countryDisplayLabel(iso)}>
      <span className="text-base leading-none" aria-hidden>
        {countryFlagEmoji(iso)}
      </span>
      <span className="font-mono text-xs">{iso}</span>
    </span>
  );
}

function eventTypeLabel(
  kind: string | undefined,
  tr: (key: MessageKey) => string,
  meta?: Record<string, unknown>,
) {
  if (kind === "lead") {
    const step = typeof meta?.funnel_step === "string" ? meta.funnel_step : "";
    if (step === "checkout") return tr("pages.reports.eventCheckout");
    if (step === "lander") return tr("pages.reports.eventLander");
    return tr("pages.reports.eventLead");
  }
  switch (kind) {
    case "impression":
      return tr("pages.reports.eventImpression");
    case "click":
      return tr("pages.reports.eventClick");
    case "conversion":
    case "sale":
      return tr("pages.reports.eventConversion");
    case "pageview":
      return tr("pages.reports.eventPageview");
    default:
      return kind || "—";
  }
}

function dimCell(value: string | null | undefined, isMacro: boolean | undefined, macroTitle: string) {
  const v = (value || "").trim();
  if (!v) return "—";
  if (isMacro) {
    return (
      <span className="font-mono text-amber-700 dark:text-amber-400" title={macroTitle}>
        {v}
      </span>
    );
  }
  return v;
}

/** Ao abrir Relatórios: só o dia de hoje (hora local). */
function defaultDateRange() {
  return rangeToday();
}

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale);
}

function originFromEvent(e: TrackingEvent) {
  const meta = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>) : {};
  const src =
    (e.source && String(e.source).trim()) ||
    (e.utm_source && String(e.utm_source).trim()) ||
    (typeof meta.utm_source === "string" ? meta.utm_source.trim() : "");
  const med =
    (e.medium && String(e.medium).trim()) ||
    (typeof meta.utm_medium === "string" ? meta.utm_medium.trim() : "");
  const camp =
    (e.campaign && String(e.campaign).trim()) ||
    (e.utm_campaign && String(e.utm_campaign).trim()) ||
    (typeof meta.campaign === "string" ? meta.campaign.trim() : "");
  const parts = [src, med, camp].filter(Boolean);
  if (parts.length > 0) return parts.join(" / ");
  const refRaw = e.referrer || (typeof meta.referrer === "string" ? meta.referrer : "");
  const ref = String(refRaw).trim();
  if (ref) {
    try {
      return new URL(ref).hostname.replace(/^www\./i, "");
    } catch {
      return ref.length > 64 ? `${ref.slice(0, 61)}…` : ref;
    }
  }
  return "—";
}

function paidTrafficArgs(e: TrackingEvent) {
  const meta = e.metadata || {};
  return {
    source: e.source,
    medium: e.medium,
    utm_source: e.utm_source,
    gclid: typeof meta.gclid === "string" ? meta.gclid : e.gclid || "",
    msclkid: typeof meta.msclkid === "string" ? meta.msclkid : e.msclkid || "",
    fbclid: typeof meta.fbclid === "string" ? meta.fbclid : "",
    ttclid: typeof meta.ttclid === "string" ? meta.ttclid : "",
    gbraid: typeof meta.gbraid === "string" ? meta.gbraid : "",
    wbraid: typeof meta.wbraid === "string" ? meta.wbraid : "",
  };
}

function paidLabel(e: TrackingEvent, tr: (key: MessageKey) => string) {
  const resolved = e.traffic_type || resolveTrafficType(paidTrafficArgs(e));
  if (resolved === "paid") return tr("pages.funnel.labelPaid");
  if (resolved === "paid_untracked") return tr("pages.reports.noClickId");
  return tr("pages.funnel.labelOrganic");
}

function paidTypeTitle(e: TrackingEvent, visitorKind: ClickVisitorKind) {
  return explainTrafficTypeLabel({ ...paidTrafficArgs(e), visitorKind });
}

function CheckoutPageCell({ url, host }: { url?: string | null; host?: string | null }) {
  const href = (url || "").trim();
  if (!href) return <span className="text-muted-foreground">—</span>;
  let label = (host || "").trim();
  if (!label) {
    try {
      label = new URL(href).hostname.replace(/^www\./i, "");
    } catch {
      label = href.length > 40 ? `${href.slice(0, 37)}…` : href;
    }
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-primary hover:underline truncate max-w-[11rem] inline-block align-bottom"
      title={href}
    >
      {label}
    </a>
  );
}

function platformMatches(rowPlatform: string, selected: string) {
  if (!selected || selected === "all") return true;
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");
  const row = norm(rowPlatform);
  const sel = norm(selected);
  return row === sel || row.includes(sel) || sel.includes(row);
}

const RELATORIO_TABS = ["acessos", "cliques", "conversoes", "sem-gclid"] as const;
type RelatorioTab = (typeof RELATORIO_TABS)[number];

function isRelatorioTab(s: string | undefined): s is RelatorioTab {
  return !!s && (RELATORIO_TABS as readonly string[]).includes(s);
}

function triggerCsvDownload(blob: Blob, fallbackName: string, serverFilename: string | null) {
  const safe =
    (serverFilename && serverFilename.replace(/[/\\?%*:|"<>]/g, "_").trim()) || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const { tab: tabParam } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const tab: RelatorioTab = isRelatorioTab(tabParam) ? tabParam : "acessos";

  useEffect(() => {
    if (tabParam !== undefined && !isRelatorioTab(tabParam)) {
      navigate("/resultados/relatorios/acessos", { replace: true });
    }
  }, [tabParam, navigate]);

  const initial = defaultDateRange();
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [compareRange, setCompareRange] = useState<{ from: string; to: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [platform, setPlatform] = useState("all");
  const [gclidFilter, setGclidFilter] = useState("");
  /** all | real | bot | datacenter */
  const [situationFilter, setSituationFilter] = useState<string>("all");
  /** all | paid | paid_untracked | organic */
  const [trafficTypeFilter, setTrafficTypeFilter] = useState<string>("all");
  const [perPage, setPerPage] = useState("25");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const blockIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      const { error } = await integrationsService.addBlacklist({
        ip,
        reason: t("pages.reports.blockReason"),
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success(t("pages.reports.ipBlocked"));
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message || t("pages.reports.ipBlockFail")),
  });
  const [exporting, setExporting] = useState<
    null | "impression" | "click" | "conversions" | "no-gclid" | "google-ads"
  >(null);
  const [googleAdsConversionName, setGoogleAdsConversionName] = useState("");
  const [selectedConversionIds, setSelectedConversionIds] = useState<string[]>([]);

  const pageSize = Math.min(Number(perPage) || 25, 100);
  const exportBusy = exporting !== null;

  const handleExportCsv = async (kind: "impression" | "click" | "conversions" | "no-gclid") => {
    setExporting(kind);
    try {
      if (kind === "impression" || kind === "click") {
        /** Com filtro Situação / pesquisa: exporta o que está no ecrã (enterprise). */
        const filtered = kind === "impression" ? accessFiltered : clickFiltered;
        const useFilteredView =
          (situationFilter && situationFilter !== "all") ||
          (trafficTypeFilter && trafficTypeFilter !== "all") ||
          Boolean(searchTerm.trim());
        if (useFilteredView) {
          const cols = [
            { key: "ip", header: "IP" },
            { key: "eventLabel", header: t("pages.reports.colEvent") },
            { key: "keyword", header: t("common.keyword") },
            { key: "device", header: t("pages.results.thDevice") },
            { key: "country", header: t("pages.reports.colCountry") },
            { key: "type", header: t("pages.reports.typeLegend") },
            { key: "status", header: t("pages.reports.filterSituation") },
            { key: "origin", header: t("pages.results.thSource") },
            { key: "lastAccess", header: t("pages.automizer.when") },
          ];
          const csv = reportRowsToCsv(filtered as unknown as Record<string, unknown>[], cols);
          const sit = situationFilter !== "all" ? `_${situationFilter}` : "";
          downloadTextCsv(
            `tracking-events_${kind === "impression" ? "impressions" : "clicks"}_${applied.from}_${applied.to}${sit}_filtrado.csv`,
            csv,
          );
          toast.success(fill(t("pages.reports.exportedRows"), { n: filtered.length }));
          return;
        }
        const { data, filename, error } = await analyticsService.downloadEventsCsv({
          event_type: kind === "impression" ? "impression,lead" : "click",
          from: applied.from,
          to: applied.to,
          include_bots: true,
        });
        if (error || !data) {
          toast.error(error || t("pages.reports.exportFail"));
          return;
        }
        triggerCsvDownload(
          data,
          `tracking-events_${kind === "impression" ? "impressions" : "clicks"}_${applied.from}_${applied.to}.csv`,
          filename,
        );
        toast.success(t("pages.reports.fileDownloaded"));
        return;
      }
      const { data, filename, error } = await analyticsService.downloadConversionsCsv({
        from: applied.from,
        to: applied.to,
        missing_gclid: kind === "no-gclid",
      });
      if (error || !data) {
        toast.error(error || t("pages.reports.exportFail"));
        return;
      }
      triggerCsvDownload(
        data,
        kind === "no-gclid"
          ? `conversions_no-click-id_${applied.from}_${applied.to}.csv`
          : `conversions_${applied.from}_${applied.to}.csv`,
        filename,
      );
      toast.success(t("pages.reports.fileDownloaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.reports.exportFail"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportGoogleAds = async () => {
    const name = googleAdsConversionName.trim();
    if (!name) {
      toast.error(t("pages.reports.googleNameRequired"));
      return;
    }
    if (selectedConversionIds.length === 0) {
      toast.error(t("pages.reports.googleSelectSale"));
      return;
    }
    setExporting("google-ads");
    try {
      const { data, filename, error } = await analyticsService.downloadGoogleAdsOfflineImportCsv({
        from: applied.from,
        to: applied.to,
        conversion_name: name,
        conversion_ids: selectedConversionIds,
      });
      if (error || !data) {
        toast.error(error || t("pages.reports.exportFail"));
        return;
      }
      triggerCsvDownload(
        data,
        `google-ads-offline-gclid_${applied.from}_${applied.to}_selecao.csv`,
        filename,
      );
      toast.success(t("pages.reports.googleFileReady"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.reports.exportFail"));
    } finally {
      setExporting(null);
    }
  };

  const impressionsQuery = useQuery({
    queryKey: ["relatorios", "events", "impression-lead", applied.from, applied.to, "with-bots"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "impression,lead",
        from: applied.from,
        to: applied.to,
        limit: 500,
        include_bots: true,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "acessos",
  });

  const clicksQuery = useQuery({
    queryKey: ["relatorios", "events", "click", applied.from, applied.to, "with-bots"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "click",
        from: applied.from,
        to: applied.to,
        limit: 500,
        include_bots: true,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "cliques",
  });

  const compareClicksQuery = useQuery({
    queryKey: ["relatorios", "events", "click", "compare", compareRange?.from, compareRange?.to, "with-bots"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "click",
        from: compareRange!.from,
        to: compareRange!.to,
        limit: 500,
        include_bots: true,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(compareRange) && tab === "cliques",
  });

  const compareImpressionsQuery = useQuery({
    queryKey: [
      "relatorios",
      "events",
      "impression-lead",
      "compare",
      compareRange?.from,
      compareRange?.to,
      "with-bots",
    ],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "impression,lead",
        from: compareRange!.from,
        to: compareRange!.to,
        limit: 500,
        include_bots: true,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(compareRange) && tab === "acessos",
  });

  const conversionsQuery = useQuery({
    queryKey: ["relatorios", "conversions", applied.from, applied.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getConversions({
        from: applied.from,
        to: applied.to,
        limit: 500,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "conversoes",
  });

  const noGclidQuery = useQuery({
    queryKey: ["relatorios", "conversions", "no-gclid", applied.from, applied.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getConversions({
        from: applied.from,
        to: applied.to,
        missing_gclid: true,
        limit: 2000,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "sem-gclid",
  });

  /** Só permite descarregar quando a API já devolveu linhas no período (evita ficheiros vazios). */
  const canExportImpressions =
    impressionsQuery.isSuccess &&
    Array.isArray(impressionsQuery.data) &&
    impressionsQuery.data.length > 0;
  const canExportClicks =
    clicksQuery.isSuccess && Array.isArray(clicksQuery.data) && clicksQuery.data.length > 0;
  const canExportConversionsReport =
    conversionsQuery.isSuccess &&
    Array.isArray(conversionsQuery.data) &&
    conversionsQuery.data.length > 0;
  const canExportNoGclid =
    noGclidQuery.isSuccess && Array.isArray(noGclidQuery.data) && noGclidQuery.data.length > 0;
  const periodHasGclidConversions =
    conversionsQuery.isSuccess &&
    (conversionsQuery.data ?? []).some((r) => typeof r.gclid === "string" && r.gclid.trim().length > 0);

  const currentTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const applyDateRange = (from: string, to: string, compare?: { from: string; to: string }) => {
    if (!from || !to) {
      toast.error(t("pages.reports.dateRequired"));
      return;
    }
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
      toast.error(t("pages.reports.dateInvalid"));
      return;
    }
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    setApplied({ from, to });
    setCompareRange(compare ?? null);
  };

  const handleReset = () => {
    const { from, to } = defaultDateRange();
    setStartDate(from);
    setEndDate(to);
    setApplied({ from, to });
    setCompareRange(null);
    setSearchTerm("");
    setPlatform("all");
    setGclidFilter("");
    setPage(1);
    setSelectedConversionIds([]);
    setGoogleAdsConversionName("");
  };

  const filterBySearch = <T extends Record<string, unknown>>(rows: T[], fields: (keyof T)[]) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q)),
    );
  };

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (tab !== "conversoes") setSelectedConversionIds([]);
  }, [tab]);

  const impressionRows = useMemo(() => {
    const raw = Array.isArray(impressionsQuery.data) ? impressionsQuery.data : [];
    return raw.map((e) => {
      const meta = e.metadata || {};
      const keyword =
        e.utm_term ||
        (typeof meta.utm_term === "string" ? meta.utm_term : "") ||
        (typeof meta.keyword === "string" ? meta.keyword : "") ||
        "";
      const dt = formatDateTime(e.created_at, numLocale);
      const utmCamp = e.utm_campaign || e.campaign || "";
      const utmCont = e.utm_content || (typeof meta.utm_content === "string" ? meta.utm_content : "");
      const regionParts = [e.region, e.city].filter((x) => typeof x === "string" && x.trim());
      const checkoutFromMeta =
        e.checkout_page ||
        (typeof meta.redirect_to === "string" ? meta.redirect_to : "") ||
        "";
      const q = resolveClickVisitorQuality(e);
      return {
        id: e.id,
        ip: e.ip_address || "—",
        eventLabel: eventTypeLabel(e.event_type, t, meta),
        keyword: keyword.trim() || "—",
        keywordMacro: Boolean(e.utm_term_macro),
        utm_campaign: utmCamp?.trim() || "—",
        utm_content: utmCont?.trim() || "—",
        contentMacro: Boolean(e.utm_content_macro),
        lastAccess: dt,
        device: e.device_label || e.device || "—",
        browser: e.browser || "—",
        os: e.os || "—",
        origin: originFromEvent(e),
        type: paidLabel(e, t),
        typeKind: e.traffic_type || resolveTrafficType(paidTrafficArgs(e)),
        typeTitle: paidTypeTitle(e, q.kind),
        country: e.country || "—",
        region: regionParts.length ? regionParts.join(" · ") : "—",
        checkout_page: checkoutFromMeta,
        checkout_host: e.checkout_host || "",
        status: q.label,
        statusKind: q.kind,
        statusTitle: q.detail,
      };
    });
  }, [impressionsQuery.data]);

  const clickRows = useMemo(() => {
    const raw = Array.isArray(clicksQuery.data) ? clicksQuery.data : [];
    return raw.map((e) => {
      const meta = e.metadata || {};
      const keyword =
        e.utm_term ||
        (typeof meta.utm_term === "string" ? meta.utm_term : "") ||
        (typeof meta.keyword === "string" ? meta.keyword : "") ||
        "";
      const dt = formatDateTime(e.created_at, numLocale);
      const utmCamp = e.utm_campaign || e.campaign || "";
      const utmCont = e.utm_content || (typeof meta.utm_content === "string" ? meta.utm_content : "");
      const regionParts = [e.region, e.city].filter((x) => typeof x === "string" && x.trim());
      const checkoutFromMeta =
        e.checkout_page ||
        (typeof meta.redirect_to === "string" ? meta.redirect_to : "") ||
        "";
      const quality = resolveClickVisitorQuality(e);
      return {
        id: e.id,
        ip: e.ip_address || "—",
        eventLabel: eventTypeLabel(e.event_type, t),
        clickId: e.id,
        keyword: keyword.trim() || "—",
        keywordMacro: Boolean(e.utm_term_macro),
        utm_campaign: utmCamp?.trim() || "—",
        utm_content: utmCont?.trim() || "—",
        contentMacro: Boolean(e.utm_content_macro),
        lastAccess: dt,
        device: e.device_label || e.device || "—",
        browser: e.browser || "—",
        os: e.os || "—",
        origin: originFromEvent(e),
        type: paidLabel(e, t),
        typeKind: e.traffic_type || resolveTrafficType(paidTrafficArgs(e)),
        typeTitle: paidTypeTitle(e, quality.kind),
        country: e.country || "—",
        region: regionParts.length ? regionParts.join(" · ") : "—",
        checkout_page: checkoutFromMeta,
        checkout_host: e.checkout_host || "",
        status: quality.label,
        statusKind: quality.kind,
        statusTitle: quality.detail,
      };
    });
  }, [clicksQuery.data]);

  const datacenterIpsForAds = useMemo(
    () => collectDatacenterIpsForGoogleAdsExclusion(clickRows),
    [clickRows],
  );

  const copyDatacenterIpsForGoogleAds = async () => {
    if (datacenterIpsForAds.length === 0) {
      toast.message(t("pages.reports.emptyServerIps"), {
        description: t("pages.reports.emptyServerIpsHint"),
      });
      return;
    }
    const text = formatGoogleAdsIpExclusionList(datacenterIpsForAds);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(fill(t("pages.reports.ipsCopied"), { n: datacenterIpsForAds.length }), {
        description: t("pages.reports.ipsCopiedHint"),
      });
    } catch {
      toast.error(t("pages.reports.copyFail"));
    }
  };

  const conversionRowsFiltered = useMemo(() => {
    let rows = Array.isArray(conversionsQuery.data) ? conversionsQuery.data : [];
    rows = rows.filter((r) => platformMatches(r.platform, platform));
    const g = gclidFilter.trim().toLowerCase();
    if (g) {
      rows = rows.filter((r) => {
        const hay = [
          r.gclid,
          r.click_id,
          r.keyword,
          r.origin,
          r.utm_campaign,
          r.utm_content,
          r.utm_term,
          r.postback_campaign,
          r.utm_source,
          r.utm_medium,
          r.checkout_page,
          r.checkout_host,
          r.google_ads_sync,
          r.meta_capi_sync,
          r.tiktok_events_sync,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(g);
      });
    }
    return rows;
  }, [conversionsQuery.data, platform, gclidFilter]);

  useEffect(() => {
    const allowed = new Set(conversionRowsFiltered.map((r) => r.id));
    setSelectedConversionIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [conversionRowsFiltered]);

  const noGclidRowsFiltered = useMemo(() => {
    let rows = Array.isArray(noGclidQuery.data) ? noGclidQuery.data : [];
    rows = rows.filter((r) => platformMatches(r.platform, platform));
    const g = gclidFilter.trim().toLowerCase();
    if (g) {
      rows = rows.filter((r) => {
        const hay = [
          r.click_id,
          r.keyword,
          r.origin,
          r.utm_campaign,
          r.utm_content,
          r.utm_term,
          r.postback_campaign,
          r.utm_source,
          r.utm_medium,
          r.checkout_page,
          r.checkout_host,
          r.google_ads_sync,
          r.meta_capi_sync,
          r.tiktok_events_sync,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(g);
      });
    }
    return rows;
  }, [noGclidQuery.data, platform, gclidFilter]);

  const paginate = <T,>(rows: T[]) => {
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(page, pages);
    const slice = rows.slice((p - 1) * pageSize, p * pageSize);
    return { slice, total, pages, page: p };
  };

  const filterBySituation = <T extends { statusKind: ClickVisitorKind }>(rows: T[]) => {
    if (!situationFilter || situationFilter === "all") return rows;
    return rows.filter((r) => r.statusKind === situationFilter);
  };

  const filterByTrafficType = <T extends { typeKind: string }>(rows: T[]) => {
    if (!trafficTypeFilter || trafficTypeFilter === "all") return rows;
    return rows.filter((r) => r.typeKind === trafficTypeFilter);
  };

  const situationCounts = useMemo(() => {
    const rows = tab === "cliques" ? clickRows : impressionRows;
    const c = { real: 0, bot: 0, datacenter: 0 };
    for (const r of rows) {
      if (r.statusKind === "real") c.real += 1;
      else if (r.statusKind === "bot") c.bot += 1;
      else if (r.statusKind === "datacenter") c.datacenter += 1;
    }
    return c;
  }, [tab, clickRows, impressionRows]);

  const trafficTypeCounts = useMemo(() => {
    const rows = tab === "cliques" ? clickRows : impressionRows;
    const c = { paid: 0, paid_untracked: 0, organic: 0 };
    for (const r of rows) {
      if (r.typeKind === "paid") c.paid += 1;
      else if (r.typeKind === "paid_untracked") c.paid_untracked += 1;
      else c.organic += 1;
    }
    return c;
  }, [tab, clickRows, impressionRows]);

  const accessFiltered = filterByTrafficType(
    filterBySituation(
      filterBySearch(impressionRows, [
        "ip",
        "eventLabel",
        "keyword",
        "utm_campaign",
        "utm_content",
        "device",
        "country",
        "region",
        "origin",
        "type",
        "status",
        "checkout_page",
        "checkout_host",
      ]),
    ),
  );
  const accessDisplay = paginate(accessFiltered);
  const clickFiltered = filterByTrafficType(
    filterBySituation(
      filterBySearch(clickRows, [
        "ip",
        "clickId",
        "eventLabel",
        "keyword",
        "utm_campaign",
        "utm_content",
        "device",
        "country",
        "region",
        "origin",
        "type",
        "status",
        "checkout_page",
        "checkout_host",
      ]),
    ),
  );
  const clickDisplay = paginate(clickFiltered);
  const convDisplay = paginate(
    filterBySearch(
      conversionRowsFiltered.map((r) => ({
        ...r,
        commissionStr:
          r.commission != null && Number.isFinite(r.commission)
            ? `${r.commission} ${r.currency}`
            : "—",
      })),
      [
        "click_id",
        "keyword",
        "origin",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "postback_campaign",
        "platform",
        "commissionStr",
        "checkout_page",
        "checkout_host",
        "google_ads_sync",
        "meta_capi_sync",
        "tiktok_events_sync",
      ],
    ),
  );
  const convPageSelectableIds = convDisplay.slice
    .filter((r) => Boolean(r.gclid?.trim()))
    .map((r) => r.id);
  const allConvPageSelected =
    convPageSelectableIds.length > 0 &&
    convPageSelectableIds.every((id) => selectedConversionIds.includes(id));

  const toggleConvPageSelection = () => {
    if (allConvPageSelected) {
      setSelectedConversionIds((prev) => prev.filter((id) => !convPageSelectableIds.includes(id)));
    } else {
      setSelectedConversionIds((prev) => [...new Set([...prev, ...convPageSelectableIds])]);
    }
  };

  const noGclidDisplay = paginate(
    filterBySearch(
      noGclidRowsFiltered.map((r) => ({
        ...r,
        commissionStr:
          r.commission != null && Number.isFinite(r.commission)
            ? `${r.commission} ${r.currency}`
            : "—",
      })),
      [
        "click_id",
        "keyword",
        "origin",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "postback_campaign",
        "platform",
        "commissionStr",
        "checkout_page",
        "checkout_host",
        "google_ads_sync",
        "meta_capi_sync",
        "tiktok_events_sync",
      ],
    ),
  );

  /** Resumo por campanha (UTM ou postback) no intervalo filtrado. */
  const conversionByCampaign = useMemo(() => {
    const m = new Map<string, { count: number; revenue: number; currency: string }>();
    for (const r of conversionRowsFiltered) {
      const label =
        (r.utm_campaign && r.utm_campaign.trim()) ||
        (r.postback_campaign && r.postback_campaign.trim()) ||
        t("pages.reports.noCampaign");
      const cur = m.get(label) || { count: 0, revenue: 0, currency: r.currency || "USD" };
      cur.count += 1;
      if (r.commission != null && Number.isFinite(r.commission)) cur.revenue += r.commission;
      cur.currency = r.currency || cur.currency;
      m.set(label, cur);
    }
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
  }, [conversionRowsFiltered]);

  const syncLabel = (sync: string | null) => {
    if (sync === "sent") return { ok: true, text: t("pages.reports.syncSent") };
    if (sync === "restated") return { ok: true, text: t("pages.reports.syncRestated") };
    if (sync === "retracted") return { ok: true, text: t("pages.reports.syncRetracted") };
    if (!sync || sync === "skipped_pending") return { ok: false, text: t("pages.reports.syncPending") };
    if (sync === "skipped_no_fbclid") return { ok: false, text: t("pages.reports.noMetaId") };
    if (sync === "skipped_no_ttclid") return { ok: false, text: t("pages.reports.noTiktokId") };
    if (sync === "skipped_no_gclid") return { ok: false, text: t("pages.reports.noGoogleId") };
    if (sync === "skipped_disabled") return { ok: false, text: t("pages.reports.syncOff") };
    if (sync === "skipped_no_config") return { ok: false, text: t("pages.reports.syncNeedAccount") };
    if (sync === "skipped_direct_upload") return { ok: true, text: t("pages.reports.syncDirect") };
    if (sync === "skipped_ads_direct") return { ok: true, text: t("pages.reports.viaAds") };
    if (sync === "skipped_offline_csv_import") return { ok: true, text: t("pages.reports.syncCsv") };
    if (sync === "failed") return { ok: false, text: t("pages.reports.apiError") };
    return { ok: false, text: sync };
  };

  const dashQuery = useQuery({
    queryKey: ["relatorios", "dashboard", applied.from, applied.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({
        from: applied.from,
        to: applied.to,
      });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const UsageLimitBar = () => {
    const q = dashQuery.data?.click_quota ?? null;
    if (dashQuery.isLoading) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
          {t("pages.reports.loadingQuota")}
        </div>
      );
    }
    if (!q) return null;
    const maxLabel = q.max == null ? t("pages.reports.unlimited") : q.max.toLocaleString(numLocale);
    const pct = q.percent;
    const over = Boolean(q.over_limit);
    return (
      <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium text-foreground/90">
            {t("pages.reports.clicksThisMonth")}{" "}
            <span className="tabular-nums">{q.used.toLocaleString(numLocale)}</span>
            <span className="text-muted-foreground font-normal"> / {maxLabel}</span>
          </p>
          {pct != null ? (
            <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
          ) : null}
        </div>
        {pct != null ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${over || pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("pages.reports.noPlanCap")}</p>
        )}
        {over ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {t("pages.reports.softCap")}
          </p>
        ) : null}
      </div>
    );
  };

  const TimezoneAlert = () => (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
      {fill(t("pages.reports.hoursHint"), { time: currentTime })}{" "}
      <span className="text-foreground/80 font-medium">{t("pages.reports.typeLegend")}</span>
      {t("pages.reports.typeLegendBody")}{" "}
      <span className="text-foreground/80 font-medium">{t("pages.reports.situationLegend")}</span>
      {t("pages.reports.situationLegendBody")}
    </div>
  );

  const DateFilters = ({
    showPlatformGclid,
    showSituation,
  }: {
    showPlatformGclid?: boolean;
    showSituation?: boolean;
  }) => (
    <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
      <div className="flex flex-col lg:flex-row flex-wrap items-end gap-4">
        {showSituation ? (
          <>
          <div className="space-y-2 min-w-[180px]">
            <Label>{t("pages.reports.filterSituation")}</Label>
            <Select
              value={situationFilter}
              onValueChange={(v) => {
                setSituationFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("pages.reports.filterSituation")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("common.all")} ({situationCounts.real + situationCounts.bot + situationCounts.datacenter})
                </SelectItem>
                <SelectItem value="real">Real ({situationCounts.real})</SelectItem>
                <SelectItem value="bot">Robot ({situationCounts.bot})</SelectItem>
                <SelectItem value="datacenter">Cloud ({situationCounts.datacenter})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[180px]">
            <Label>{t("pages.reports.filterType")}</Label>
            <Select
              value={trafficTypeFilter}
              onValueChange={(v) => {
                setTrafficTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("pages.reports.filterType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("common.all")} ({trafficTypeCounts.paid + trafficTypeCounts.paid_untracked + trafficTypeCounts.organic})
                </SelectItem>
                <SelectItem value="paid">{t("pages.funnel.labelPaid")} ({trafficTypeCounts.paid})</SelectItem>
                <SelectItem value="paid_untracked">
                  {t("pages.reports.noClickId")} ({trafficTypeCounts.paid_untracked})
                </SelectItem>
                <SelectItem value="organic">{t("pages.funnel.labelOrganic")} ({trafficTypeCounts.organic})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </>
        ) : null}
        {showPlatformGclid ? (
          <>
            <div className="space-y-2 min-w-[180px]">
              <Label>{t("pages.reports.platform")}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pages.reports.platform")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {RELATORIO_PLATFORM_OPTIONS.map((label) => (
                    <SelectItem key={label} value={platformFilterValue(label)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[160px]">
              <Label>{t("pages.reports.filterText")}</Label>
              <Input
                placeholder={t("common.optional")}
                value={gclidFilter}
                onChange={(e) => setGclidFilter(e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="space-y-2 flex-1 min-w-[220px] max-w-sm">
          <Label>{t("common.period")}</Label>
          <DateRangeFilter
            from={startDate}
            to={endDate}
            onApply={(p) => applyDateRange(p.from, p.to, p.compare)}
            showCompare
          />
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" /> {t("pages.reports.reset")}
        </Button>
      </div>
    </div>
  );

  const noGclidAlertCount = dashQuery.data?.sync_health?.google_ads_skipped_no_gclid ?? 0;

  return (
    <div className={APP_PAGE_SHELL_PRO}>
      <ProPageHeader
        title={t("pages.reports.title")}
        subtitle={t("pages.reports.subtitle")}
        meta={
          <ProInlineLink to="/integracoes">{t("pages.reports.fixTrackingLink")}</ProInlineLink>
        }
      />
      <SyncHealthBanner className="mb-4" syncHealth={dashQuery.data?.sync_health} />
      <NextAccountActionBanner
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-3"
        checks={dashQuery.data?.account_health?.checks}
      />

      {(tab === "cliques" || tab === "acessos") && trafficTypeCounts.paid_untracked > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-foreground">
          <p className="font-medium text-amber-950 dark:text-amber-100">
            {fill(t("pages.reports.untrackedVisits"), { n: trafficTypeCounts.paid_untracked })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {t("pages.reports.untrackedBanner")}
          </p>
        </div>
      ) : null}

      {compareRange && (tab === "cliques" || tab === "acessos") ? (
        <div className="mb-4 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
          <span>
            {t("pages.reports.compare")}{" "}
            <span className="font-mono tabular-nums text-foreground/80">
              {compareRange.from} → {compareRange.to}
            </span>
          </span>
          {tab === "cliques" ? (
            <span className="tabular-nums">
              {fill(t("pages.reports.clicksSample"), { a: clickRows.length, b: compareClicksQuery.data?.length ?? "…" })}
              {compareClicksQuery.isError ? (
                <span className="ml-1 text-amber-800 dark:text-amber-300">{t("pages.reports.compareError")}</span>
              ) : compareClicksQuery.data ? (
                <span className="ml-1 text-foreground/90">
                  (
                  {clickRows.length - compareClicksQuery.data.length >= 0 ? "+" : ""}
                  {clickRows.length - compareClicksQuery.data.length})
                </span>
              ) : null}
            </span>
          ) : (
            <span className="tabular-nums">
              {fill(t("pages.reports.visitsSample"), { a: impressionRows.length, b: compareImpressionsQuery.data?.length ?? "…" })}
              {compareImpressionsQuery.isError ? (
                <span className="ml-1 text-amber-800 dark:text-amber-300">{t("pages.reports.compareError")}</span>
              ) : compareImpressionsQuery.data ? (
                <span className="ml-1 text-foreground/90">
                  (
                  {impressionRows.length - compareImpressionsQuery.data.length >= 0 ? "+" : ""}
                  {impressionRows.length - compareImpressionsQuery.data.length})
                </span>
              ) : null}
            </span>
          )}
          <span className="w-full text-[10px] opacity-80">
            {t("pages.reports.deltaHint")}
          </span>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => navigate(`/resultados/relatorios/${v}`)}>
        <TabsList className="bg-card border border-border flex flex-wrap h-auto gap-1 p-1 w-full justify-start sm:w-auto">
          <TabsTrigger value="acessos" className="shrink-0">
            {t("pages.reports.tabVisits")}
          </TabsTrigger>
          <TabsTrigger value="cliques" className="shrink-0">
            {t("pages.reports.tabClicks")}
          </TabsTrigger>
          <TabsTrigger value="conversoes" className="shrink-0">
            {t("pages.reports.tabSales")}
          </TabsTrigger>
          <TabsTrigger
            value="sem-gclid"
            title={t("pages.reports.noGoogleSales")}
            className="shrink-0 max-w-[200px] sm:max-w-none text-left leading-tight"
          >
            {t("pages.reports.tabNoGoogle")}
            {noGclidAlertCount > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                {noGclidAlertCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acessos" className="mt-6 space-y-4">
          <UsageLimitBar />
          <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <strong className="font-medium text-foreground/90">{t("pages.reports.colsLead")}</strong>{" "}
            {t("pages.reports.colsBody")}
          </p>
          <TimezoneAlert />
          <DateFilters showSituation />
          <ReportDimensionStrip className="mb-4" rows={impressionRows} />

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select
                  value={perPage}
                  onValueChange={(v) => {
                    setPerPage(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-16 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">{t("pages.reports.perPage")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0"
                  disabled={
                    exportBusy ||
                    impressionsQuery.isLoading ||
                    impressionsQuery.isError ||
                    !canExportImpressions
                  }
                  title={
                    impressionsQuery.isSuccess && !canExportImpressions
                      ? t("pages.reports.emptyVisits")
                      : undefined
                  }
                  onClick={() => void handleExportCsv("impression")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "impression" ? t("pages.reports.downloading") : t("pages.reports.download")}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("pages.reports.filterTable")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 w-full sm:w-56"
                />
              </div>
            </div>
            {impressionsQuery.isLoading ? (
              <LoadingState message={t("pages.reports.loadingImpressions")} />
            ) : impressionsQuery.isError ? (
              <ErrorState
                message={t("pages.reports.errorVisits")}
                onRetry={() => impressionsQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colEvent")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("common.keyword")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colAd")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colDate")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground" title={t("pages.reports.deviceTitle")}>
                          {t("pages.results.thDevice")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.checkoutTitle")}
                        >
                          Checkout Page
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.results.thSource")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.paidTitle")}
                        >
                          {t("pages.reports.typeLegend")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.situationTitle")}
                        >
                          {t("pages.reports.filterSituation")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCountry")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.regionTitle")}
                        >
                          {t("pages.reports.colRegion")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t("pages.automizer.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                            {t("pages.reports.emptyRange")}
                          </td>
                        </tr>
                      ) : (
                        accessDisplay.slice.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[130px] truncate" title={row.ip}>
                              {row.ip}
                            </td>
                            <td className="py-2.5 px-3 text-xs" title={row.id}>
                              <span className="font-medium text-foreground">{row.eventLabel}</span>
                              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground truncate max-w-[7rem]">
                                {row.id.slice(0, 8)}…
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs">{dimCell(row.keyword === "—" ? "" : row.keyword, row.keywordMacro, t("pages.reports.macroTitle"))}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_campaign}
                            </td>
                            <td className="py-2.5 px-3 text-xs max-w-[140px] truncate">
                              {dimCell(row.utm_content === "—" ? "" : row.utm_content, row.contentMacro, t("pages.reports.macroTitle"))}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {row.lastAccess}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                            <td className="py-2.5 px-3">
                              <CheckoutPageCell url={row.checkout_page} host={row.checkout_host} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate" title={row.origin}>
                              {row.origin}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  row.type === "Pago"
                                    ? "bg-primary/10 text-primary"
                                    : row.type === t("pages.reports.noClickId")
                                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                      : "bg-muted text-muted-foreground"
                                }`}
                                title={row.typeTitle || undefined}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                title={row.statusTitle || undefined}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${visitorSituationClass(row.statusKind)}`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              <CountryCell code={row.country} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                            <td className="py-2.5 px-3">
                              {row.ip && row.ip !== "—" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  title={t("pages.reports.blockIpTitle")}
                                  disabled={blockIpMutation.isPending}
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
                                </Button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {accessDisplay.total === 0
                      ? t("pages.reports.noRows")
                      : fill(t("pages.reports.showingRange"), {
                        from: (accessDisplay.page - 1) * pageSize + 1,
                        to: Math.min(accessDisplay.page * pageSize, accessDisplay.total),
                        total: accessDisplay.total,
                      })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accessDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">
                      {accessDisplay.page} / {accessDisplay.pages}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accessDisplay.page >= accessDisplay.pages}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(accessDisplay.pages, p + 1))}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cliques" className="mt-6 space-y-4">
          <UsageLimitBar />
          <TimezoneAlert />
          <DateFilters showSituation />
          <ReportDimensionStrip className="mb-4" rows={clickRows} />

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <span className="text-sm text-muted-foreground min-w-0 flex-1">
                {t("pages.reports.clicksInPeriod")}{" "}
                <span className="text-foreground/80">
                  {t("pages.reports.clicksLegend")} {t("pages.reports.paidCloud")}
                </span>
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                  disabled={clicksQuery.isLoading || clicksQuery.isError}
                  title={t("pages.reports.copyIpsTitle")}
                  onClick={() => void copyDatacenterIpsForGoogleAds()}
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("pages.reports.copyIps")}
                  {datacenterIpsForAds.length > 0 ? ` (${datacenterIpsForAds.length})` : ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                  disabled={
                    exportBusy || clicksQuery.isLoading || clicksQuery.isError || !canExportClicks
                  }
                  title={
                    clicksQuery.isSuccess && !canExportClicks ? t("pages.reports.emptyClicks") : undefined
                  }
                  onClick={() => void handleExportCsv("click")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "click" ? t("pages.reports.downloading") : t("pages.reports.download")}
                </Button>
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("pages.reports.filterTable")}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 w-full sm:w-56"
                  />
                </div>
              </div>
            </div>
            {clicksQuery.isLoading ? (
              <LoadingState message={t("pages.reports.loadingClicks")} />
            ) : clicksQuery.isError ? (
              <ErrorState message={t("pages.reports.errorClicks")} onRetry={() => clicksQuery.refetch()} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.eventClick")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("common.keyword")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colAd")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colDate")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground" title={t("pages.reports.deviceTitle")}>
                          {t("pages.results.thDevice")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.hoplinkTitle")}
                        >
                          Checkout Page
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.results.thSource")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.paidTitle")}
                        >
                          {t("pages.reports.typeLegend")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.situationTitle")}
                        >
                          {t("pages.reports.filterSituation")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCountry")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.regionTitle")}
                        >
                          {t("pages.reports.colRegion")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t("pages.automizer.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clickDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                            {t("pages.reports.emptyRange")}
                          </td>
                        </tr>
                      ) : (
                        clickDisplay.slice.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[130px] truncate" title={row.ip}>
                              {row.ip}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[160px] truncate" title={row.clickId}>
                              {row.clickId}
                            </td>
                            <td className="py-2.5 px-3 text-xs">{dimCell(row.keyword === "—" ? "" : row.keyword, row.keywordMacro, t("pages.reports.macroTitle"))}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_campaign}
                            </td>
                            <td className="py-2.5 px-3 text-xs max-w-[140px] truncate">
                              {dimCell(row.utm_content === "—" ? "" : row.utm_content, row.contentMacro, t("pages.reports.macroTitle"))}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {row.lastAccess}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                            <td className="py-2.5 px-3">
                              <CheckoutPageCell url={row.checkout_page} host={row.checkout_host} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate" title={row.origin}>
                              {row.origin}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  row.type === "Pago"
                                    ? "bg-primary/10 text-primary"
                                    : row.type === t("pages.reports.noClickId")
                                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                      : "bg-muted text-muted-foreground"
                                }`}
                                title={row.typeTitle || undefined}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                title={row.statusTitle || undefined}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${visitorSituationClass(row.statusKind)}`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              <CountryCell code={row.country} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                            <td className="py-2.5 px-3">
                              {row.ip && row.ip !== "—" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  title={t("pages.reports.blockIpTitle")}
                                  disabled={blockIpMutation.isPending}
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
                                </Button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {clickDisplay.total === 0
                      ? t("pages.reports.noRows")
                      : fill(t("pages.reports.showingRange"), {
                        from: (clickDisplay.page - 1) * pageSize + 1,
                        to: Math.min(clickDisplay.page * pageSize, clickDisplay.total),
                        total: clickDisplay.total,
                      })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={clickDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">
                      {clickDisplay.page} / {clickDisplay.pages}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={clickDisplay.page >= clickDisplay.pages}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(clickDisplay.pages, p + 1))}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="conversoes" className="mt-6 space-y-4">
          <UsageLimitBar />
          <DateFilters showPlatformGclid />

          {conversionByCampaign.length > 0 ? (
            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{t("pages.reports.summaryTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("pages.reports.summaryHint")}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">{t("pages.reports.colCampaign")}</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">{t("common.sales")}</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">{t("pages.reports.colCommissionTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversionByCampaign.map((row) => (
                      <tr key={row.label} className="border-b border-border/50">
                        <td className="py-2 px-3 max-w-[280px] truncate" title={row.label}>
                          {row.label}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{row.count}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-success">
                          {row.revenue.toLocaleString(numLocale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {row.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-start">
              <p className="text-sm text-muted-foreground min-w-0 w-full lg:flex-1 lg:pr-4">
                {t("pages.reports.approvedHint")}
              </p>
              <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-0 lg:max-w-xl xl:max-w-2xl lg:shrink-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                    disabled={
                      exportBusy ||
                      conversionsQuery.isLoading ||
                      conversionsQuery.isError ||
                      !canExportConversionsReport
                    }
                    title={
                      conversionsQuery.isSuccess && !canExportConversionsReport
                        ? t("pages.reports.emptyConversions")
                        : undefined
                    }
                    onClick={() => void handleExportCsv("conversions")}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {exporting === "conversions" ? t("pages.reports.downloading") : t("pages.reports.download")}
                  </Button>
                  <div className="relative flex-1 sm:flex-initial min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("pages.reports.filterTable")}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-9 w-full sm:w-56"
                    />
                  </div>
                </div>
                {!conversionsQuery.isLoading && conversionsQuery.isSuccess && periodHasGclidConversions ? (
                  <div className="flex flex-col gap-2 pt-3 border-t border-border/60 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="flex-1 min-w-[min(100%,240px)] space-y-1">
                      <Label htmlFor="rel-google-ads-conv-name" className="text-xs">
                        {t("pages.reports.googleConvName")}
                      </Label>
                      <Input
                        id="rel-google-ads-conv-name"
                        placeholder={t("pages.reports.googleConvPlaceholder")}
                        value={googleAdsConversionName}
                        onChange={(e) => setGoogleAdsConversionName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-snug list-disc pl-4 marker:text-muted-foreground/70">
                        <li>
                          {t("pages.reports.googleNameHint")}{" "}
                          <span className="text-foreground/85">{t("pages.reports.googleNamePath")}</span>{" "}
                          {t("pages.reports.googleNameTail")}
                        </li>
                        <li>{t("pages.reports.googleTimeHint")}</li>
                        <li>
                          {t("pages.reports.googleActionHint")}{" "}
                          <span className="text-foreground/85">{t("pages.reports.googleClickImport")}</span>.{" "}
                          <a
                            href={GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 hover:text-primary/90"
                          >
                            {t("pages.reports.googleGuide")}
                          </a>
                        </li>
                      </ul>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                      disabled={
                        exportBusy ||
                        selectedConversionIds.length === 0 ||
                        !googleAdsConversionName.trim()
                      }
                      onClick={() => void handleExportGoogleAds()}
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {exporting === "google-ads" ? t("pages.reports.generating") : t("pages.reports.googleFile")}
                    </Button>
                  </div>
                ) : null}
                {!conversionsQuery.isLoading && conversionsQuery.isSuccess && !periodHasGclidConversions ? (
                  <p className="text-xs text-muted-foreground pt-3 border-t border-border/60">
                    {t("pages.reports.noGoogleSales")}
                  </p>
                ) : null}
              </div>
            </div>
            {conversionsQuery.isLoading ? (
              <LoadingState message={t("pages.reports.loadingConversions")} />
            ) : conversionsQuery.isError ? (
              <ErrorState
                message={t("pages.reports.errorConversions")}
                onRetry={() => conversionsQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="w-10 py-3 px-2 text-center font-medium text-muted-foreground">
                          <span className="sr-only">{t("pages.reports.select")}</span>
                          <Checkbox
                            checked={allConvPageSelected}
                            disabled={convPageSelectableIds.length === 0 || exportBusy}
                            onCheckedChange={() => toggleConvPageSelection()}
                            aria-label={t("pages.reports.selectPageSales")}
                          />
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colDate")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.eventClick")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.hoplinkShort")}
                        >
                          Checkout Page
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colOrigin")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colAdContent")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("common.keyword")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colPlatformCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCommission")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.platform")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Google Ads
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Meta CAPI
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync TikTok
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {convDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                            {t("pages.reports.emptyRange")}
                          </td>
                        </tr>
                      ) : (
                        convDisplay.slice.map((row) => {
                          const s = syncLabel(row.google_ads_sync);
                          const m = syncLabel(row.meta_capi_sync);
                          const tiktokSync = syncLabel(row.tiktok_events_sync);
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                            >
                              <td className="py-2.5 px-2 text-center align-middle">
                                <Checkbox
                                  checked={selectedConversionIds.includes(row.id)}
                                  disabled={!row.gclid?.trim() || exportBusy}
                                  title={
                                    row.gclid?.trim()
                                      ? t("pages.reports.includeInFile")
                                      : t("pages.reports.noGoogleClick")
                                  }
                                  onCheckedChange={(v) => {
                                    if (!row.gclid?.trim()) return;
                                    const on = v === true;
                                    setSelectedConversionIds((prev) =>
                                      on
                                        ? [...new Set([...prev, row.id])]
                                        : prev.filter((x) => x !== row.id),
                                    );
                                  }}
                                  aria-label={
                                    row.gclid?.trim()
                                      ? t("pages.reports.selectSale")
                                      : t("pages.reports.saleNoClick")
                                  }
                                />
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                                {formatDateTime(row.created_at, numLocale)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-xs text-primary max-w-[200px] truncate">
                                {row.click_id}
                              </td>
                              <td className="py-2.5 px-3">
                                <CheckoutPageCell url={row.checkout_page} host={row.checkout_host} />
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate" title={row.origin}>
                                {row.origin}
                              </td>
                              <td className="py-2.5 px-3 text-xs max-w-[160px] truncate" title={row.utm_campaign ?? ""}>
                                {row.utm_campaign || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-xs max-w-[160px] truncate" title={row.utm_content ?? ""}>
                                {row.utm_content || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-primary text-xs max-w-[140px] truncate">
                                {row.utm_term || row.keyword}
                              </td>
                              <td className="py-2.5 px-3 text-xs max-w-[160px] truncate" title={row.postback_campaign ?? ""}>
                                {row.postback_campaign || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-success">
                                {row.commissionStr}
                              </td>
                              <td className="py-2.5 px-3">{row.platform}</td>
                              <td className="py-2.5 px-3">
                                <span
                                  title={row.google_ads_sync_error || undefined}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    s.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {s.text}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  title={row.meta_capi_sync_error || undefined}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    m.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {m.text}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  title={row.tiktok_events_sync_error || undefined}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    tiktokSync.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {tiktokSync.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {convDisplay.total === 0
                      ? t("pages.reports.noRows")
                      : fill(t("pages.reports.showingRange"), {
                        from: (convDisplay.page - 1) * pageSize + 1,
                        to: Math.min(convDisplay.page * pageSize, convDisplay.total),
                        total: convDisplay.total,
                      })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={convDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">
                      {convDisplay.page} / {convDisplay.pages}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={convDisplay.page >= convDisplay.pages}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(convDisplay.pages, p + 1))}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sem-gclid" className="mt-6 space-y-4">
          <UsageLimitBar />
          <DateFilters showPlatformGclid />

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <span className="text-sm text-muted-foreground min-w-0 flex-1">
                {t("pages.reports.noGoogleHint")}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                  disabled={
                    exportBusy ||
                    noGclidQuery.isLoading ||
                    noGclidQuery.isError ||
                    !canExportNoGclid
                  }
                  title={
                    noGclidQuery.isSuccess && !canExportNoGclid
                      ? t("pages.reports.emptyNoGoogle")
                      : undefined
                  }
                  onClick={() => void handleExportCsv("no-gclid")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "no-gclid" ? t("pages.reports.downloading") : t("pages.reports.download")}
                </Button>
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("pages.reports.filterTable")}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 w-full sm:w-56"
                  />
                </div>
              </div>
            </div>
            {noGclidQuery.isLoading ? (
              <LoadingState message={t("pages.reports.loadingConversions")} />
            ) : noGclidQuery.isError ? (
              <ErrorState
                message={t("pages.reports.errorConversions")}
                onRetry={() => noGclidQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colDate")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.eventClick")}
                        </th>
                        <th
                          className="text-left py-3 px-3 font-medium text-muted-foreground"
                          title={t("pages.reports.hoplinkShort")}
                        >
                          Checkout Page
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.results.thSource")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colAd")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("common.keyword")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colPlatformCampaign")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.colCommission")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          {t("pages.reports.platform")}
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Google Ads
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Meta CAPI
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync TikTok
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {noGclidDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-sm text-muted-foreground">
                            {t("pages.reports.emptyRange")}
                          </td>
                        </tr>
                      ) : (
                        noGclidDisplay.slice.map((row) => {
                          const sg = syncLabel(row.google_ads_sync);
                          const sm = syncLabel(row.meta_capi_sync);
                          const st = syncLabel(row.tiktok_events_sync);
                          return (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {formatDateTime(row.created_at, numLocale)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[180px] truncate">{row.click_id}</td>
                            <td className="py-2.5 px-3">
                              <CheckoutPageCell url={row.checkout_page} host={row.checkout_host} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[180px] truncate">
                              {row.origin}
                            </td>
                            <td className="py-2.5 px-3 text-xs max-w-[140px] truncate">{row.utm_campaign || "—"}</td>
                            <td className="py-2.5 px-3 text-xs max-w-[140px] truncate">{row.utm_content || "—"}</td>
                            <td className="py-2.5 px-3 text-xs">{row.utm_term || row.keyword}</td>
                            <td className="py-2.5 px-3 text-xs max-w-[140px] truncate">
                              {row.postback_campaign || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-success">{row.commissionStr}</td>
                            <td className="py-2.5 px-3">{row.platform}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  sg.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                }`}
                              >
                                {sg.text}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  sm.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                }`}
                              >
                                {sm.text}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  st.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                }`}
                              >
                                {st.text}
                              </span>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {noGclidDisplay.total === 0
                      ? t("pages.reports.noRows")
                      : fill(t("pages.reports.showingRange"), {
                        from: (noGclidDisplay.page - 1) * pageSize + 1,
                        to: Math.min(noGclidDisplay.page * pageSize, noGclidDisplay.total),
                        total: noGclidDisplay.total,
                      })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={noGclidDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">
                      {noGclidDisplay.page} / {noGclidDisplay.pages}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={noGclidDisplay.page >= noGclidDisplay.pages}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(noGclidDisplay.pages, p + 1))}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
