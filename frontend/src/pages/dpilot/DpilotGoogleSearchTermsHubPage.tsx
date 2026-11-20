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
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useGoogleManagerPrefs, GOOGLE_MANAGER_ALL_CAMPAIGNS } from "@/hooks/useGoogleManagerPrefs";
import {
  GOOGLE_MANAGER_PRESETS,
  googleManagerPresetLabelKey,
  type GoogleManagerPreset,
} from "@/lib/googleManagerPrefs";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";

const HUB_PRESETS = GOOGLE_MANAGER_PRESETS.filter(
  (p): p is GoogleManagerPreset =>
    p === "today" ||
    p === "yesterday" ||
    p === "last_7" ||
    p === "last_30" ||
    p === "this_month",
);

type TermRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsProjectSearchTerms>>["data"]
>["terms"][number];

function rowKey(t: Pick<TermRow, "campaign_id" | "search_term">) {
  return `${t.campaign_id}::${t.search_term}`;
}

export function DpilotGoogleSearchTermsHubPage() {
  const { t } = useAppLocale();
  const { projectId } = useDpilotPaid();
  const { preset, setPreset, campaignFilter, setCampaignFilter, ensureCampaignFilterValid } =
    useGoogleManagerPrefs(projectId);
  const [wasteOnly, setWasteOnly] = useState(false);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("phrase");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<Array<{ id: string; name: string }>>([]);
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
      ...(campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS ? { campaign_id: campaignFilter } : {}),
    });
    if (error) {
      setErr(error);
      setTerms([]);
      setTotals(null);
      setNote(null);
      /** Filtro persistido apontava a campanha já apagada — limpar e deixar o próximo load recuperar. */
      if (
        campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS &&
        /não encontrada|not found/i.test(error)
      ) {
        setCampaignFilter(GOOGLE_MANAGER_ALL_CAMPAIGNS);
      }
    } else {
      setTerms(data?.terms ?? []);
      setTotals(data?.totals ?? null);
      setRange(data?.range ?? null);
      setNote(data?.note ?? null);
      setCampaignOptions(
        (data?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId, preset, wasteOnly, campaignFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (campaignOptions.length === 0) return;
    ensureCampaignFilterValid(campaignOptions.map((c) => c.id));
  }, [campaignOptions, ensureCampaignFilterValid]);

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
    const matchLabel =
      matchType === "exact" ? "igual ao termo" : matchType === "broad" ? "qualquer pesquisa semelhante" : "frase com o termo";
    if (
      !window.confirm(
        `Bloquear ${termCount} termo(s) em ${items.length} campanha(s)?\n\nModo: ${matchLabel}.\nComo dono, aplica já na Google; outros membros vão a Aprovações.`,
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
    if (!data?.added) {
      toast.success("Estes termos já estavam bloqueados");
    } else if (data.failed) {
      toast.message(
        `${data.added} termo(s) processados; ${data.failed} campanha(s) falharam — veja Aprovações.`,
      );
    } else if ((data.applied ?? 0) > 0 && (data.pending ?? 0) === 0) {
      toast.success(`${data.added} termo(s) bloqueados na Google (${items.length} campanha(s)).`);
    } else if ((data.pending ?? 0) > 0) {
      toast.message(
        `${data.added} termo(s) · ${data.applied ?? 0} aplicados · ${data.pending} pendentes em Aprovações.`,
      );
    } else {
      toast.message(`${data.added} termo(s) processados em ${items.length} campanha(s).`);
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
              O que as pessoas pesquisaram antes de clicar. Escolha uma campanha no filtro (ou «Todas»),
              marque o que gasta mal e bloqueie — sem abrir o Google Ads. A lander não muda.
            </p>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-[220px]" aria-label="Filtrar por campanha">
                  <SelectValue placeholder="Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GOOGLE_MANAGER_ALL_CAMPAIGNS}>Todas as campanhas</SelectItem>
                  {campaignOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="w-[170px]" aria-label={t("pages.dpilot.google.cm.periodAria")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUB_PRESETS.map((p) => {
                    const key = googleManagerPresetLabelKey(p);
                    return (
                      <SelectItem key={p} value={p}>
                        {key ? t(key) : p}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={wasteOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setWasteOnly((v) => !v)}
              >
                Só o que gasta mal
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
            <CardTitle className="text-sm text-muted-foreground">Gastam e quase não vendem</CardTitle>
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
            <CardTitle className="text-sm text-muted-foreground">Campanhas no ar</CardTitle>
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
              <CardTitle className="text-base">Bloquear termos seleccionados</CardTitle>
              <CardDescription>
                Escolha o modo de bloqueio e confirme. Em campanhas novas, espere um pouco — a venda pode
                chegar atrasada.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as "exact" | "phrase" | "broad")}
              >
                <SelectTrigger className="w-[200px]" aria-label="Modo de bloqueio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phrase">Frase (recomendado)</SelectItem>
                  <SelectItem value="exact">Só este termo exacto</SelectItem>
                  <SelectItem value="broad">Parecido (mais largo)</SelectItem>
                </SelectContent>
              </Select>
              {waste.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(waste.map(rowKey)))}
                >
                  Marcar os que gastam mal ({waste.length})
                </Button>
              ) : null}
              <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                Bloquear ({selected.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {note ? (
            <Alert>
              <AlertTitle className="text-sm">Ainda sem termos da Google</AlertTitle>
              <AlertDescription className="text-xs space-y-2">
                <p>{note}</p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ir a Campanhas e importar</Link>
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
              Sem pesquisas neste período
              {campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS ? " nesta campanha" : ""}
              {wasteOnly ? " no filtro «só o que gasta mal»" : ""}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>O que pesquisaram</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Vezes visto</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Vendas</TableHead>
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
                              Já bloqueado
                            </Badge>
                          ) : t.waste_candidate ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200"
                            >
                              Gasta mal?
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
