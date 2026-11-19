/**
 * Hub project-wide de termos de pesquisa — cortar desperdício em todas as campanhas Search.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7", label: "Últimos 7 dias" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
] as const;

type TermRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsProjectSearchTerms>>["data"]
>["terms"][number];

function rowKey(t: Pick<TermRow, "campaign_id" | "search_term">) {
  return `${t.campaign_id}::${t.search_term}`;
}

export function DpilotGoogleSearchTermsHubPage() {
  const { projectId } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [wasteOnly, setWasteOnly] = useState(false);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("phrase");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [totals, setTotals] = useState<{
    rows: number;
    waste: number;
    campaigns_with_terms: number;
    published_campaigns: number;
  } | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsProjectSearchTerms(projectId, {
      preset,
      waste_only: wasteOnly,
    });
    if (error) {
      setErr(error);
      setTerms([]);
      setTotals(null);
      setNote(null);
    } else {
      setTerms(data?.terms ?? []);
      setTotals(data?.totals ?? null);
      setRange(data?.range ?? null);
      setNote(data?.note ?? null);
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId, preset, wasteOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const waste = useMemo(
    () => terms.filter((t) => t.waste_candidate && !t.already_negative),
    [terms],
  );

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const negateSelected = async () => {
    if (selected.size === 0) return;
    const byCampaign = new Map<string, string[]>();
    for (const t of terms) {
      const key = rowKey(t);
      if (!selected.has(key) || t.already_negative) continue;
      const list = byCampaign.get(t.campaign_id) ?? [];
      list.push(t.search_term);
      byCampaign.set(t.campaign_id, list);
    }
    const items = [...byCampaign.entries()].map(([campaign_id, termList]) => ({
      campaign_id,
      terms: termList,
    }));
    if (items.length === 0) return;
    const termCount = items.reduce((s, i) => s + i.terms.length, 0);
    if (
      !window.confirm(
        `Negar ${termCount} termo(s) em ${items.length} campanha(s) como «${matchType}»?\n\nSegue Copilot (Aprovações) ou Autopilot — sem cloaking da landing.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await paidAdsService.negateGoogleAdsSearchTermsBatch(projectId, {
      match_type: matchType,
      items,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.failed) {
      toast.message(
        `${data.added} negativa(s) enfileirada(s); ${data.failed} campanha(s) falharam`,
      );
    } else {
      toast.success(
        data?.added
          ? `${data.added} negativa(s) enfileirada(s) em ${items.length} campanha(s)`
          : "Termos já estavam como negativas",
      );
    }
    void load();
  };

  return (
    <Gate>
      <div className="relative overflow-hidden rounded-xl border border-[#1a73e8]/25 bg-gradient-to-br from-[#1a73e8]/10 via-background to-background p-5 sm:p-6">
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <Search className="h-7 w-7 text-[#1a73e8]" aria-hidden />
              <span>Termos de pesquisa</span>
              <Badge
                aria-hidden
                className="border border-[#1a73e8]/30 bg-[#1a73e8]/15 font-normal text-[#1a73e8] hover:bg-[#1a73e8]/15"
              >
                Projecto
              </Badge>
            </span>
          }
          description={
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Vista unificada do que a Google está a mostrar. Seleccione desperdício e negue em lote —
              as mudanças passam por Copilot/Autopilot, com a Final URL intacta.
            </p>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="w-[170px]" aria-label="Período">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={wasteOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setWasteOnly((v) => !v)}
              >
                Só desperdício
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Termos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.rows ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Candidatos a negativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-amber-800 dark:text-amber-200">
              {totals?.waste ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Campanhas com termos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.campaigns_with_terms ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Search publicadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.published_campaigns ?? "—"}</p>
            {range ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {range.from} → {range.to}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">Negar em lote</CardTitle>
              <CardDescription>
                Match type aplicado a todos os seleccionados. Revise candidatos — testes novos podem ter
                conversões atrasadas.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as "exact" | "phrase" | "broad")}
              >
                <SelectTrigger className="w-[140px]" aria-label="Tipo de correspondência">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phrase">Frase</SelectItem>
                  <SelectItem value="exact">Exacta</SelectItem>
                  <SelectItem value="broad">Amplia</SelectItem>
                </SelectContent>
              </Select>
              {waste.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(waste.map(rowKey)))}
                >
                  Seleccionar desperdício ({waste.length})
                </Button>
              ) : null}
              <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                Negar ({selected.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {note ? (
            <Alert>
              <AlertTitle className="text-sm">Sem dados de rede ainda</AlertTitle>
              <AlertDescription className="text-xs space-y-2">
                <p>{note}</p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ir a Campanhas & importar</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {err ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível carregar</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem termos neste período
              {wasteOnly ? " com o filtro de desperdício" : ""}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Termo</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Impr.</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => {
                    const key = rowKey(t);
                    return (
                      <TableRow key={key} className={t.waste_candidate ? "bg-amber-500/5" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(key)}
                            disabled={t.already_negative}
                            onCheckedChange={(v) => toggle(key, v === true)}
                            aria-label={`Seleccionar ${t.search_term}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[14rem] font-medium">
                          <span className="line-clamp-2">{t.search_term}</span>
                        </TableCell>
                        <TableCell className="max-w-[12rem]">
                          <Link
                            className="line-clamp-2 text-xs text-[#1a73e8] hover:underline"
                            to={`/tracking/dpilot/p/${projectId}/campanhas/${t.campaign_id}/google`}
                          >
                            {t.campaign_name}
                          </Link>
                        </TableCell>
                        <TableCell>{t.metrics.impressions.toLocaleString()}</TableCell>
                        <TableCell>{t.metrics.clicks.toLocaleString()}</TableCell>
                        <TableCell>{formatUsdFromMicros(t.metrics.cost_micros)}</TableCell>
                        <TableCell>{t.metrics.conversions.toFixed(1)}</TableCell>
                        <TableCell>
                          {t.already_negative ? (
                            <Badge variant="secondary" className="font-normal">
                              Já negativa
                            </Badge>
                          ) : t.waste_candidate ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200"
                            >
                              Desperdício?
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t.status || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}
