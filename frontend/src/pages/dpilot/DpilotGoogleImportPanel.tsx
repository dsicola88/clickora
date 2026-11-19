/**
 * Importa campanhas Search da conta Google para a Dclickora.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsdFromMicros, toastGoogleAdsError } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

type RemoteRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.listRemoteGoogleCampaigns>>["data"]
>["campaigns"][number];

export function DpilotGoogleImportPanel({
  projectId,
  onImported,
}: {
  projectId: string;
  onImported?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<RemoteRow[]>([]);
  const [totals, setTotals] = useState<{ remote: number; imported: number; new: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.listRemoteGoogleCampaigns(projectId);
    if (error) {
      setErr(error);
      setRows([]);
      setTotals(null);
    } else {
      setRows(data?.campaigns ?? []);
      setTotals(data?.totals ?? null);
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isSearch = (r: RemoteRow) => String(r.channel_type || "SEARCH").toUpperCase() === "SEARCH";

  const selectNew = () => {
    setSelected(
      new Set(
        rows
          .filter((r) => isSearch(r) && !r.already_imported)
          .map((r) => r.external_campaign_id),
      ),
    );
  };

  const runImport = async (refresh: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        refresh
          ? `Re-sincronizar estrutura de ${ids.length} campanha(s)? Substitui grupos/keywords/anúncios locais pelos da Google.`
          : `Importar ${ids.length} campanha(s) Search para a Dclickora?\n\nPoderá gerir, pausar, orçamento e termos sem abrir ads.google.com.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await paidAdsService.importGoogleCampaigns(projectId, {
      external_campaign_ids: ids,
      refresh_existing: refresh,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    const n = data?.imported?.length ?? 0;
    const e = data?.errors?.length ?? 0;
    toast.success(`${n} importada(s)${e ? ` · ${e} erro(s)` : ""}`);
    data?.errors?.forEach((x) => toast.message(`${x.external_campaign_id}: ${x.error}`));
    void load();
    onImported?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Importar da conta Google</p>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            Campanhas Search da conta Google. A importação traz grupos, RSA, keywords e negativas (campanha + grupo)
            — depois opere termos e orçamento aqui.
          </p>
          {totals ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Remotas {totals.remote} · já na app {totals.imported} · novas {totals.new}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={selectNew} disabled={loading}>
            Seleccionar novas
          </Button>
          <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void runImport(false)}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Importar ({selected.size})
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => void runImport(true)}
          >
            Re-sincronizar estrutura
          </Button>
        </div>
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível ler a conta Google</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{toastGoogleAdsError(err)}</p>
            <p className="text-xs opacity-90">
              Enquanto isto falhar, a lista «Campanhas» acima continua a ser só rascunhos deste projecto — não o
              inventário de ads.google.com.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link to="/integracoes/google-ads">Verificar Integrações → Google</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> A ler campanhas na Google…
        </p>
      ) : rows.length === 0 && !err ? (
        <p className="text-sm text-muted-foreground">
          A Google não devolveu campanhas nesta conta. Confirme o customer ID em Integrações (conta cliente, não MCC).
        </p>
      ) : rows.length === 0 ? null : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>ID Google</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Orçamento/dia</TableHead>
                <TableHead>Na Dclickora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.external_campaign_id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.external_campaign_id)}
                      disabled={!isSearch(r)}
                      onCheckedChange={(v) => toggle(r.external_campaign_id, v === true)}
                      aria-label={`Seleccionar ${r.name}`}
                      title={isSearch(r) ? undefined : "Só Search pode ser importada neste fluxo"}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[16rem]">
                    <span className="line-clamp-2">{r.name}</span>
                  </TableCell>
                  <TableCell className="text-xs">{r.channel_type || "SEARCH"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.external_campaign_id}</TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span>
                        {r.daily_budget_micros != null ? formatUsdFromMicros(r.daily_budget_micros) : "—"}
                      </span>
                      {r.budget_shared ? (
                        <Badge
                          variant="outline"
                          className={
                            r.budget_editable
                              ? "block w-fit font-normal text-[10px]"
                              : "block w-fit border-amber-500/50 font-normal text-[10px] text-amber-800 dark:text-amber-200"
                          }
                        >
                          Partilhado ({r.budget_reference_count})
                          {!r.budget_editable ? " · só leitura" : ""}
                        </Badge>
                      ) : (
                        <span className="block text-[10px] text-muted-foreground">Exclusivo</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.already_imported && r.local_campaign_id ? (
                      <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${r.local_campaign_id}/google`}>
                          Já importada · Gestão
                        </Link>
                      </Button>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Nova
                      </Badge>
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
