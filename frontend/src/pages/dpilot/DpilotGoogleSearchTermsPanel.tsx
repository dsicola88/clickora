/**
 * Termos de pesquisa + negar na campanha (API real; dono aplica já / equipa → Aprovações).
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
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useGoogleManagerPrefs } from "@/hooks/useGoogleManagerPrefs";
import {
  GOOGLE_MANAGER_PRESETS,
  googleManagerPresetLabelKey,
} from "@/lib/googleManagerPrefs";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

const TERM_PRESETS = GOOGLE_MANAGER_PRESETS.filter((p) =>
  p === "today" || p === "yesterday" || p === "last_7" || p === "last_30",
);

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
  const { t } = useAppLocale();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
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
        `Bloquear ${list.length} termo(s) nesta campanha (modo frase)?\n\nComo dono, aplica já na Google. Pedidos de outros membros vão a Aprovações.`,
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
    if (!data?.added) {
      toast.success("Estes termos já estavam bloqueados");
    } else if (data.change_request?.status === "applied") {
      toast.success(`${data.added} termo(s) bloqueados na Google.`);
    } else if (data.change_request?.status === "pending") {
      toast.message(`${data.added} termo(s) pendentes em Aprovações.`);
    } else {
      toast.message(`${data.added} termo(s) enviados · total ${data.total}`);
    }
    void load();
  };

  const waste = terms.filter((t) => t.waste_candidate && !t.already_negative);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">O que as pessoas pesquisaram</p>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            {campaignName ? `Campanha «${campaignName}» · ` : ""}
            Marque o que gasta e não vende e bloqueie aqui — sem abrir o Google Ads.
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
              {TERM_PRESETS.map((p) => {
                const key = googleManagerPresetLabelKey(p);
                return (
                  <SelectItem key={p} value={p}>
                    {key ? t(key) : p}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
            Bloquear seleccionados ({selected.size})
          </Button>
        </div>
      </div>

      {waste.length > 0 ? (
        <Alert>
          <AlertTitle className="text-sm">
            {waste.length} termo(s) com gasto e poucas ou nenhumas vendas
          </AlertTitle>
          <AlertDescription className="text-xs">
            Vale a pena bloquear. Em testes novos, espere um pouco — a venda pode chegar atrasada.
            <Button
              type="button"
              variant="link"
              className="h-auto px-1 text-xs"
              onClick={() => setSelected(new Set(waste.map((w) => w.search_term)))}
            >
              Marcar estes
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
        <Alert>
          <AlertTitle className="text-sm">Sem termos neste período</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            A Google ainda não devolveu pesquisas (poucas impressões/cliques, ou o período está vazio).
            Mude para «Últimos 7 dias» / «Últimos 30 dias» ou espere a campanha acumular tráfego — depois
            pode marcar e bloquear desperdício daqui.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>O que pesquisaram</TableHead>
                <TableHead>Vezes visto</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Gasto</TableHead>
                <TableHead>Vendas</TableHead>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
