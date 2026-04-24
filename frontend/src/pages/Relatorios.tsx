import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, RotateCcw, AlertTriangle, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
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

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function originFromEvent(e: TrackingEvent) {
  const parts = [e.source, e.medium, e.campaign].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

function paidLabel(e: TrackingEvent) {
  if (e.traffic_type === "paid") return "Pago";
  if (e.traffic_type === "organic") return "Orgânico";
  const meta = e.metadata || {};
  const g = typeof meta.gclid === "string" ? meta.gclid : "";
  const m = typeof meta.msclkid === "string" ? meta.msclkid : "";
  const f = typeof meta.fbclid === "string" ? meta.fbclid : "";
  const t = typeof meta.ttclid === "string" ? meta.ttclid : "";
  return g.trim() || m.trim() || f.trim() || t.trim() ? "Pago" : "Orgânico";
}

function platformMatches(rowPlatform: string, selected: string) {
  if (!selected || selected === "all") return true;
  return rowPlatform.toLowerCase().includes(selected.replace(/_/g, "").toLowerCase());
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
  const { tab: tabParam } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const tab: RelatorioTab = isRelatorioTab(tabParam) ? tabParam : "acessos";

  useEffect(() => {
    if (tabParam !== undefined && !isRelatorioTab(tabParam)) {
      navigate("/tracking/relatorios/acessos", { replace: true });
    }
  }, [tabParam, navigate]);

  const initial = defaultDateRange();
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [searchTerm, setSearchTerm] = useState("");
  const [platform, setPlatform] = useState("all");
  const [gclidFilter, setGclidFilter] = useState("");
  const [perPage, setPerPage] = useState("25");
  const [page, setPage] = useState(1);
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
        const { data, filename, error } = await analyticsService.downloadEventsCsv({
          event_type: kind === "impression" ? "impression" : "click",
          from: applied.from,
          to: applied.to,
        });
        if (error || !data) {
          toast.error(error || "Não foi possível exportar.");
          return;
        }
        triggerCsvDownload(
          data,
          `tracking-events_${kind === "impression" ? "impressions" : "clicks"}_${applied.from}_${applied.to}.csv`,
          filename,
        );
        toast.success("Ficheiro descarregado.");
        return;
      }
      const { data, filename, error } = await analyticsService.downloadConversionsCsv({
        from: applied.from,
        to: applied.to,
        missing_gclid: kind === "no-gclid",
      });
      if (error || !data) {
        toast.error(error || "Não foi possível exportar.");
        return;
      }
      triggerCsvDownload(
        data,
        kind === "no-gclid"
          ? `conversions_no-click-id_${applied.from}_${applied.to}.csv`
          : `conversions_${applied.from}_${applied.to}.csv`,
        filename,
      );
      toast.success("Ficheiro descarregado.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportGoogleAds = async () => {
    const name = googleAdsConversionName.trim();
    if (!name) {
      toast.error("Indique o nome da conversão tal como está em Google Ads → Conversões.");
      return;
    }
    if (selectedConversionIds.length === 0) {
      toast.error("Selecione pelo menos uma linha com GCLID.");
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
        toast.error(error || "Não foi possível exportar.");
        return;
      }
      triggerCsvDownload(
        data,
        `google-ads-offline-gclid_${applied.from}_${applied.to}_selecao.csv`,
        filename,
      );
      toast.success("Ficheiro pronto. Importe em Google Ads → Conversões → importar por cliques.");
    } finally {
      setExporting(null);
    }
  };

  const impressionsQuery = useQuery({
    queryKey: ["relatorios", "events", "impression", applied.from, applied.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "impression",
        from: applied.from,
        to: applied.to,
        limit: 500,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "acessos",
  });

  const clicksQuery = useQuery({
    queryKey: ["relatorios", "events", "click", applied.from, applied.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({
        event_type: "click",
        from: applied.from,
        to: applied.to,
        limit: 500,
      });
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "cliques",
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

  const applyDateRange = (from: string, to: string) => {
    if (!from || !to) {
      toast.error("Selecione data inicial e final.");
      return;
    }
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
      toast.error("Intervalo de datas inválido.");
      return;
    }
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    setApplied({ from, to });
  };

  const handleReset = () => {
    const { from, to } = defaultDateRange();
    setStartDate(from);
    setEndDate(to);
    setApplied({ from, to });
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
        e.utm_term || (typeof meta.utm_term === "string" ? meta.utm_term : "") || "";
      const dt = formatDateTime(e.created_at);
      const utmCamp = e.utm_campaign || e.campaign || "";
      const utmCont = e.utm_content || "";
      return {
        id: e.id,
        ip: e.ip_address || "—",
        clickId: "—",
        keyword: keyword || "—",
        utm_campaign: utmCamp?.trim() || "—",
        utm_content: utmCont?.trim() || "—",
        lastAccess: dt,
        device: e.device || "—",
        origin: originFromEvent(e),
        type: paidLabel(e),
        country: e.country || "—",
        region: "—",
        status: e.is_bot ? "Bot" : "OK",
      };
    });
  }, [impressionsQuery.data]);

  const clickRows = useMemo(() => {
    const raw = Array.isArray(clicksQuery.data) ? clicksQuery.data : [];
    return raw.map((e) => {
      const meta = e.metadata || {};
      const keyword =
        e.utm_term || (typeof meta.utm_term === "string" ? meta.utm_term : "") || "";
      const dt = formatDateTime(e.created_at);
      const utmCamp = e.utm_campaign || e.campaign || "";
      const utmCont = e.utm_content || "";
      return {
        id: e.id,
        ip: e.ip_address || "—",
        clickId: e.id,
        keyword: keyword || "—",
        utm_campaign: utmCamp?.trim() || "—",
        utm_content: utmCont?.trim() || "—",
        lastAccess: dt,
        device: e.device || "—",
        origin: originFromEvent(e),
        type: paidLabel(e),
        country: e.country || "—",
        region: "—",
        status: e.is_bot ? "Bot" : "OK",
      };
    });
  }, [clicksQuery.data]);

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
          r.google_ads_sync,
          r.meta_capi_sync,
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
          r.google_ads_sync,
          r.meta_capi_sync,
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

  const accessDisplay = paginate(
    filterBySearch(impressionRows, [
      "ip",
      "keyword",
      "utm_campaign",
      "utm_content",
      "device",
      "country",
      "origin",
    ]),
  );
  const clickDisplay = paginate(
    filterBySearch(clickRows, [
      "ip",
      "clickId",
      "keyword",
      "utm_campaign",
      "utm_content",
      "device",
      "country",
      "origin",
    ]),
  );
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
        "google_ads_sync",
        "meta_capi_sync",
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
        "google_ads_sync",
        "meta_capi_sync",
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
        "(sem campanha)";
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
    if (sync === "sent") return { ok: true, text: "Enviado" };
    if (!sync || sync === "skipped_pending") return { ok: false, text: "Pendente" };
    if (sync === "skipped_no_fbclid") return { ok: false, text: "Sem fbclid" };
    if (sync === "skipped_no_gclid") return { ok: false, text: "Sem gclid" };
    if (sync === "skipped_disabled") return { ok: false, text: "Desligado" };
    return { ok: false, text: sync };
  };

  const UsageLimitBar = () => (
    <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Uso da ferramenta para rastreio dos endereços de IP
        </span>
        <span className="text-sm font-medium text-muted-foreground">—</span>
      </div>
      <Progress value={0} className="h-2.5" />
    </div>
  );

  const TimezoneAlert = () => (
    <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-card-foreground">
          <span className="text-warning">Atenção:</span> O horário atual da sua instalação é{" "}
          <span className="text-primary font-bold">{currentTime}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Para os horários dos cliques serem exatos, tenha certeza de que o horário da sua instalação
          esteja correto.
        </p>
      </div>
    </div>
  );

  const DateFilters = ({ showPlatformGclid }: { showPlatformGclid?: boolean }) => (
    <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
      <div className="flex flex-col lg:flex-row flex-wrap items-end gap-4">
        {showPlatformGclid ? (
          <>
            <div className="space-y-2 min-w-[180px]">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="buygoods">BuyGoods</SelectItem>
                  <SelectItem value="clickbank">ClickBank</SelectItem>
                  <SelectItem value="smartadv">SmartAdv</SelectItem>
                  <SelectItem value="hotmart">Hotmart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[160px]">
              <Label>Filtrar por texto (Click ID / GCLID / palavra-chave)</Label>
              <Input
                placeholder="Opcional"
                value={gclidFilter}
                onChange={(e) => setGclidFilter(e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="space-y-2 flex-1 min-w-[220px] max-w-sm">
          <Label>Período</Label>
          <DateRangeFilter
            from={startDate}
            to={endDate}
            onApply={(p) => applyDateRange(p.from, p.to)}
            showCompare
          />
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" /> Redefinir
        </Button>
      </div>
    </div>
  );

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Relatórios"
        description="Cada separador tem o seu URL (/tracking/relatorios/acessos, cliques, conversoes, sem-gclid) para favoritos ou partilha. Filtre por período, exporte CSV e use sub-IDs nos links de tracking."
      />

      <Tabs value={tab} onValueChange={(v) => navigate(`/tracking/relatorios/${v}`)}>
        <TabsList className="bg-card border border-border flex flex-wrap h-auto gap-1 p-1 w-full justify-start sm:w-auto">
          <TabsTrigger value="acessos" className="shrink-0">
            Acessos
          </TabsTrigger>
          <TabsTrigger value="cliques" className="shrink-0">
            Cliques
          </TabsTrigger>
          <TabsTrigger value="conversoes" className="shrink-0">
            Conversões
          </TabsTrigger>
          <TabsTrigger
            value="sem-gclid"
            title="Conversões sem Click ID (GCLID / gbraid / wbraid)"
            className="shrink-0 max-w-[200px] sm:max-w-none text-left leading-tight"
          >
            Sem Click ID
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acessos" className="mt-6 space-y-4">
          <UsageLimitBar />
          <TimezoneAlert />
          <DateFilters />

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
                <span className="text-sm text-muted-foreground">por página</span>
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
                      ? "Não há acessos neste período."
                      : undefined
                  }
                  onClick={() => void handleExportCsv("impression")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "impression" ? "A descarregar…" : "Descarregar"}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar tabela…"
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
              <LoadingState message="A carregar impressões…" />
            ) : impressionsQuery.isError ? (
              <ErrorState
                message="Erro ao carregar acessos."
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
                          Evento
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Palavra chave
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha UTM
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Anúncio (content)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Dispositivo
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Origem
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Tipo
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          País
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Região
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        accessDisplay.slice.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[130px] truncate">
                              {row.ip}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[120px] truncate">
                              {row.id.slice(0, 8)}…
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_campaign}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_content}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {row.lastAccess}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                              {row.origin}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  row.type === "Pago"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              <CountryCell code={row.country} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                  row.status === "OK"
                                    ? "bg-success/10 text-success"
                                    : "bg-warning/10 text-warning"
                                }`}
                              >
                                {row.status}
                              </span>
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
                      ? "Nenhum registo"
                      : `Mostrando ${(accessDisplay.page - 1) * pageSize + 1}–${Math.min(accessDisplay.page * pageSize, accessDisplay.total)} de ${accessDisplay.total}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accessDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
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
                      Próximo
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
          <DateFilters />

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <span className="text-sm text-muted-foreground min-w-0 flex-1">Cliques no período seleccionado.</span>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                  disabled={
                    exportBusy || clicksQuery.isLoading || clicksQuery.isError || !canExportClicks
                  }
                  title={
                    clicksQuery.isSuccess && !canExportClicks ? "Não há cliques neste período." : undefined
                  }
                  onClick={() => void handleExportCsv("click")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "click" ? "A descarregar…" : "Descarregar"}
                </Button>
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar tabela…"
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
              <LoadingState message="A carregar cliques…" />
            ) : clicksQuery.isError ? (
              <ErrorState message="Erro ao carregar cliques." onRetry={() => clicksQuery.refetch()} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Click ID
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Palavra chave
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha UTM
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Anúncio (content)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Dispositivo
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Origem
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Tipo
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          País
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Região
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clickDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        clickDisplay.slice.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[130px] truncate">
                              {row.ip}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[160px] truncate">
                              {row.clickId}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_campaign}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">
                              {row.utm_content}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {row.lastAccess}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                              {row.origin}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  row.type === "Pago"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              <CountryCell code={row.country} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                  row.status === "OK"
                                    ? "bg-success/10 text-success"
                                    : "bg-warning/10 text-warning"
                                }`}
                              >
                                {row.status}
                              </span>
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
                      ? "Nenhum registo"
                      : `Mostrando ${(clickDisplay.page - 1) * pageSize + 1}–${Math.min(clickDisplay.page * pageSize, clickDisplay.total)} de ${clickDisplay.total}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={clickDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
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
                      Próximo
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
                <p className="text-sm font-medium text-foreground">Resumo por campanha (período filtrado)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usa o nome da campanha UTM; se não houver, o nome enviado pela plataforma de afiliados (postback).
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Vendas</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Comissão total</th>
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
                          {row.revenue.toLocaleString("pt-BR", {
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
                Conversões aprovadas no período. O descarregar inclui o período completo; os filtros só alteram a lista.
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
                        ? "Não há conversões neste período."
                        : undefined
                    }
                    onClick={() => void handleExportCsv("conversions")}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {exporting === "conversions" ? "A descarregar…" : "Descarregar"}
                  </Button>
                  <div className="relative flex-1 sm:flex-initial min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar tabela…"
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
                        Nome da conversão no Google Ads
                      </Label>
                      <Input
                        id="rel-google-ads-conv-name"
                        placeholder="Igual ao nome em Google Ads → Conversões"
                        value={googleAdsConversionName}
                        onChange={(e) => setGoogleAdsConversionName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-snug list-disc pl-4 marker:text-muted-foreground/70">
                        <li>
                          O nome é obrigatório e tem de ser o mesmo que em{" "}
                          <span className="text-foreground/85">Ferramentas → Medição → Conversões</span> (maiúsculas
                          e espaços contam).
                        </li>
                        <li>
                          A <span className="text-foreground/85">data e hora</span> de cada conversão entram no ficheiro
                          automaticamente em UTC (coluna Conversion Time).
                        </li>
                        <li>
                          A acção na sua conta tem de estar configurada para{" "}
                          <span className="text-foreground/85">importação por cliques</span> (offline).{" "}
                          <a
                            href={GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 hover:text-primary/90"
                          >
                            Guia oficial do Google
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
                      {exporting === "google-ads" ? "A gerar…" : "Ficheiro para Google Ads"}
                    </Button>
                  </div>
                ) : null}
                {!conversionsQuery.isLoading && conversionsQuery.isSuccess && !periodHasGclidConversions ? (
                  <p className="text-xs text-muted-foreground pt-3 border-t border-border/60">
                    Neste período não há conversões com GCLID; o upload manual no Google Ads não se aplica a estas linhas.
                  </p>
                ) : null}
              </div>
            </div>
            {conversionsQuery.isLoading ? (
              <LoadingState message="A carregar conversões…" />
            ) : conversionsQuery.isError ? (
              <ErrorState
                message="Erro ao carregar conversões."
                onRetry={() => conversionsQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="w-10 py-3 px-2 text-center font-medium text-muted-foreground">
                          <span className="sr-only">Seleccionar</span>
                          <Checkbox
                            checked={allConvPageSelected}
                            disabled={convPageSelectableIds.length === 0 || exportBusy}
                            onCheckedChange={() => toggleConvPageSelection()}
                            aria-label="Seleccionar todas com GCLID nesta página"
                          />
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Click ID
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Origem (fonte/meio/campanha)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha UTM
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Anúncio (utm_content)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Palavra-chave
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha (plataforma)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Comissão
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Plataforma
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Google Ads
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Meta CAPI
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {convDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        convDisplay.slice.map((row) => {
                          const s = syncLabel(row.google_ads_sync);
                          const m = syncLabel(row.meta_capi_sync);
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
                                      ? "Incluir no ficheiro GCLID para Google Ads"
                                      : "Sem GCLID no clique — use apenas cliques com etiquetagem automática (GCLID)"
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
                                      ? "Seleccionar conversão para exportação Google Ads"
                                      : "Conversão sem GCLID"
                                  }
                                />
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                                {formatDateTime(row.created_at)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-xs text-primary max-w-[200px] truncate">
                                {row.click_id}
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
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    s.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {s.text}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    m.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {m.text}
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
                      ? "Nenhum registo"
                      : `Mostrando ${(convDisplay.page - 1) * pageSize + 1}–${Math.min(convDisplay.page * pageSize, convDisplay.total)} de ${convDisplay.total}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={convDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
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
                      Próximo
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
                Conversões em que o clique não tem identificador Google (gclid / gbraid / wbraid).
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
                      ? "Não há conversões sem Click ID neste período."
                      : undefined
                  }
                  onClick={() => void handleExportCsv("no-gclid")}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exporting === "no-gclid" ? "A descarregar…" : "Descarregar"}
                </Button>
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar tabela…"
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
              <LoadingState message="A carregar conversões…" />
            ) : noGclidQuery.isError ? (
              <ErrorState
                message="Erro ao carregar conversões."
                onRetry={() => noGclidQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Click ID
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Origem
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha UTM
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Anúncio (content)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Palavra-chave
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Campanha (plataforma)
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Comissão
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Plataforma
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Google Ads
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Sync Meta CAPI
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {noGclidDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        noGclidDisplay.slice.map((row) => {
                          const sg = syncLabel(row.google_ads_sync);
                          const sm = syncLabel(row.meta_capi_sync);
                          return (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {formatDateTime(row.created_at)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs max-w-[180px] truncate">{row.click_id}</td>
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
                      ? "Nenhum registo"
                      : `Mostrando ${(noGclidDisplay.page - 1) * pageSize + 1}–${Math.min(noGclidDisplay.page * pageSize, noGclidDisplay.total)} de ${noGclidDisplay.total}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={noGclidDisplay.page <= 1}
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
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
                      Próximo
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
