/**
 * Termos de pesquisa + negar na campanha (API real via Copilot/Autopilot).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7", label: "Últimos 7 dias" },
  { value: "last_30", label: "Últimos 30 dias" },
] as const;

type TermRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsSearchTerms>>["data"]
>["terms"][number];

export function DpilotGoogleSearchTermsPanel({
  projectId,
  campaignId,
  campaignName,
}: {
  projectId: string;
  campaignId: string;
  campaignName?: string;
}) {
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsSearchTerms(projectId, campaignId, { preset });
    if (error) {
      setErr(error);
      setTerms([]);
    } else {
      setTerms(data?.terms ?? []);
      setRange(data?.range ?? null);
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId, campaignId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (term: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(term);
      else next.delete(term);
      return next;
    });
  };

  const negateSelected = async () => {
    const list = [...selected];
    if (list.length === 0) return;
    if (
      !window.confirm(
        `Adicionar ${list.length} termo(s) como negativa de frase nesta campanha?\n\nA alteração segue Copilot (Aprovações) ou Autopilot.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await paidAdsService.negateGoogleAdsSearchTerms(
      projectId,
      campaignId,
      list.map((text) => ({ text, match_type: "phrase" as const })),
    );
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      data?.added
        ? `${data.added} negativa(s) enfileirada(s) · total ${data.total}`
        : "Termos já estavam como negativas",
    );
    void load();
  };

  const waste = terms.filter((t) => t.waste_candidate && !t.already_negative);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Termos de pesquisa</p>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            {campaignName ? `Campanha «${campaignName}» · ` : ""}
            Dados reais da Google Ads API. Negue desperdício aqui — sem abrir ads.google.com.
          </p>
          {range ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {range.from} → {range.to}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[160px]">
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
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
            Negar seleccionados ({selected.size})
          </Button>
        </div>
      </div>

      {waste.length > 0 ? (
        <Alert>
          <AlertTitle className="text-sm">{waste.length} termo(s) com gasto e poucas/nenhumas conversões</AlertTitle>
          <AlertDescription className="text-xs">
            Candidatos a negativa. Revise antes de aplicar — pode cortar volume em testes novos.
            <Button
              type="button"
              variant="link"
              className="h-auto px-1 text-xs"
              onClick={() => setSelected(new Set(waste.map((w) => w.search_term)))}
            >
              Seleccionar candidatos
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
        <Skeleton className="h-40 w-full" />
      ) : terms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem termos neste período (ou campanha sem impressões).</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Termo</TableHead>
                <TableHead>Impr.</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Conv.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((t) => (
                <TableRow key={t.search_term} className={t.waste_candidate ? "bg-amber-500/5" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.search_term)}
                      disabled={t.already_negative}
                      onCheckedChange={(v) => toggle(t.search_term, v === true)}
                      aria-label={`Seleccionar ${t.search_term}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[16rem] font-medium">
                    <span className="line-clamp-2">{t.search_term}</span>
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
                      <Badge variant="outline" className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200">
                        Desperdício?
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.status || "—"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
