import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RotateCcw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { analyticsService } from "@/services/analyticsService";
import type { TrackingEvent } from "@/types/api";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

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
  return g.trim() || m.trim() ? "Pago" : "Orgânico";
}

function platformMatches(rowPlatform: string, selected: string) {
  if (!selected || selected === "all") return true;
  return rowPlatform.toLowerCase().includes(selected.replace(/_/g, "").toLowerCase());
}

export default function Relatorios() {
  const initial = defaultDateRange();
  const [tab, setTab] = useState("acessos");
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [searchTerm, setSearchTerm] = useState("");
  const [platform, setPlatform] = useState("all");
  const [gclidFilter, setGclidFilter] = useState("");
  const [perPage, setPerPage] = useState("25");
  const [page, setPage] = useState(1);

  const pageSize = Math.min(Number(perPage) || 25, 100);

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

  const currentTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleSearch = () => {
    if (!startDate || !endDate) {
      toast.error("Selecione data inicial e final.");
      return;
    }
    const a = new Date(startDate);
    const b = new Date(endDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
      toast.error("Intervalo de datas inválido.");
      return;
    }
    setPage(1);
    setApplied({ from: startDate, to: endDate });
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

  const impressionRows = useMemo(() => {
    const raw = Array.isArray(impressionsQuery.data) ? impressionsQuery.data : [];
    return raw.map((e) => {
      const meta = e.metadata || {};
      const keyword =
        e.utm_term || (typeof meta.utm_term === "string" ? meta.utm_term : "") || "";
      const dt = formatDateTime(e.created_at);
      return {
        id: e.id,
        ip: e.ip_address || "—",
        clickId: "—",
        keyword: keyword || "—",
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
      return {
        id: e.id,
        ip: e.ip_address || "—",
        clickId: e.id,
        keyword: keyword || "—",
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
      rows = rows.filter(
        (r) =>
          (r.gclid && r.gclid.toLowerCase().includes(g)) ||
          r.click_id.toLowerCase().includes(g) ||
          r.keyword.toLowerCase().includes(g),
      );
    }
    return rows;
  }, [conversionsQuery.data, platform, gclidFilter]);

  const noGclidRowsFiltered = useMemo(() => {
    let rows = Array.isArray(noGclidQuery.data) ? noGclidQuery.data : [];
    rows = rows.filter((r) => platformMatches(r.platform, platform));
    const g = gclidFilter.trim().toLowerCase();
    if (g) {
      rows = rows.filter(
        (r) =>
          r.click_id.toLowerCase().includes(g) || r.keyword.toLowerCase().includes(g),
      );
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
    filterBySearch(impressionRows, ["ip", "keyword", "device", "country", "origin"]),
  );
  const clickDisplay = paginate(
    filterBySearch(clickRows, ["ip", "clickId", "keyword", "device", "country", "origin"]),
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
      ["click_id", "keyword", "platform", "commissionStr"],
    ),
  );
  const noGclidDisplay = paginate(
    filterBySearch(
      noGclidRowsFiltered.map((r) => ({
        ...r,
        commissionStr:
          r.commission != null && Number.isFinite(r.commission)
            ? `${r.commission} ${r.currency}`
            : "—",
      })),
      ["click_id", "keyword", "platform", "commissionStr"],
    ),
  );

  const syncLabel = (sync: string | null) => {
    if (sync === "sent") return { ok: true, text: "Enviado" };
    if (!sync || sync === "skipped_pending") return { ok: false, text: "Pendente" };
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
        <div className="space-y-2 flex-1 min-w-[140px]">
          <Label>Data inicial</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2 flex-1 min-w-[140px]">
          <Label>Data final</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
        >
          <Search className="h-4 w-4" /> Pesquisar
        </Button>
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
        description="Detalhe operacional: escolha o intervalo de datas e analise impressões, cliques e conversões em tabela. Complementa o resumo do painel (Resumo e guia) e o gráfico rápido em Analytics."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
          <TabsTrigger value="cliques">Cliques</TabsTrigger>
          <TabsTrigger value="conversoes">Conversões</TabsTrigger>
          <TabsTrigger value="sem-gclid">Conversões sem Click ID</TabsTrigger>
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
                          <td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
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
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.country}</td>
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
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between">
              <span className="text-sm text-muted-foreground">
                Cliques com IP, palavra-chave (utm_term) e tipo de tráfego.
              </span>
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
                          <td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
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
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.country}</td>
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

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between">
              <span className="text-sm text-muted-foreground">
                Conversões registadas via postback (comissão e sync Google Ads).
              </span>
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
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Click ID
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Palavra chave
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
                      </tr>
                    </thead>
                    <tbody>
                      {convDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        convDisplay.slice.map((row) => {
                          const s = syncLabel(row.google_ads_sync);
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                            >
                              <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                                {formatDateTime(row.created_at)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-xs text-primary max-w-[200px] truncate">
                                {row.click_id}
                              </td>
                              <td className="py-2.5 px-3 text-primary text-xs">{row.keyword}</td>
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
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between">
              <span className="text-sm text-muted-foreground">
                Conversões em que o clique não tem gclid/gbraid/wbraid (upload Google Ads limitado).
              </span>
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
                          Palavra chave
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Comissão
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                          Plataforma
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {noGclidDisplay.slice.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                            Nenhum registo a mostrar neste intervalo.
                          </td>
                        </tr>
                      ) : (
                        noGclidDisplay.slice.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {formatDateTime(row.created_at)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.click_id}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword}</td>
                            <td className="py-2.5 px-3 font-semibold text-success">{row.commissionStr}</td>
                            <td className="py-2.5 px-3">{row.platform}</td>
                          </tr>
                        ))
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
