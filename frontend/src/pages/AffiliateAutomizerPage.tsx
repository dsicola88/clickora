import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { integrationsService } from "@/services/integrationsService";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { LoadingState } from "@/components/LoadingState";
import { useState, useEffect } from "react";

/**
 * Automizer de keywords + sync de custos — controlo simples para media buyers Google Ads.
 */
export default function AffiliateAutomizerPage() {
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-automizer"],
    queryFn: async () => {
      const { data: d, error } = await integrationsService.getAffiliateAutomizer();
      if (error) throw new Error(error);
      return d!;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [minSpend, setMinSpend] = useState(15);
  const [minClicks, setMinClicks] = useState(20);
  const [lookback, setLookback] = useState(3);
  const [metaAct, setMetaAct] = useState("");
  const [ttAdv, setTtAdv] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setDryRun(data.dry_run);
    setMinSpend(data.min_spend_usd);
    setMinClicks(data.min_clicks);
    setLookback(data.lookback_days);
    setMetaAct(data.meta_ads_account_id ?? "");
    setTtAdv(data.tiktok_advertiser_id ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async (extra?: { sync_costs_now?: boolean; run_automizer_now?: boolean }) => {
      const { data: d, error } = await integrationsService.patchAffiliateAutomizer({
        enabled,
        dry_run: dryRun,
        min_spend_usd: minSpend,
        min_clicks: minClicks,
        lookback_days: lookback,
        meta_ads_account_id: metaAct.trim() || null,
        tiktok_advertiser_id: ttAdv.trim() || null,
        ...extra,
      });
      if (error) throw new Error(error);
      return d;
    },
    onSuccess: () => {
      toast.success("Definições guardadas.");
      void qc.invalidateQueries({ queryKey: ["affiliate-automizer"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={APP_PAGE_SHELL}>
        <LoadingState message="A carregar Automizer…" />
      </div>
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Automizer & custos"
        description="Pausa keywords Google sem receita e sincroniza gasto diário (Google / Meta / TikTok) para P&L histórico."
      />

      <section className="max-w-2xl space-y-5 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Regra: gasto ≥ limiar + cliques ≥ mínimo + receita postback = 0 → pausa a keyword no Google Ads.
            </p>
            <p>
              Comece com <strong className="text-foreground">dry-run</strong> (só regista o que pausaria). Depois desligue dry-run.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-on">Activar Automizer</Label>
          <Switch id="auto-on" checked={enabled} disabled={locked} onCheckedChange={setEnabled} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-dry">Dry-run (recomendado)</Label>
            <p className="text-xs text-muted-foreground">Não pausa de verdade — só escreve no log.</p>
          </div>
          <Switch id="auto-dry" checked={dryRun} disabled={locked} onCheckedChange={setDryRun} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Gasto mín. (USD)</Label>
            <Input
              type="number"
              min={1}
              value={minSpend}
              disabled={locked}
              onChange={(e) => setMinSpend(Number(e.target.value) || 15)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliques mín.</Label>
            <Input
              type="number"
              min={1}
              value={minClicks}
              disabled={locked}
              onChange={(e) => setMinClicks(Number(e.target.value) || 20)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Janela (dias)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={lookback}
              disabled={locked}
              onChange={(e) => setLookback(Number(e.target.value) || 3)}
            />
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border/50 pt-4">
          <Label>Meta Ads account ID (opcional — custo no ROAS)</Label>
          <Input
            placeholder="act_123… ou só números"
            value={metaAct}
            disabled={locked}
            onChange={(e) => setMetaAct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Usa o mesmo access token da Meta CAPI com permissão ads_read.</p>
        </div>
        <div className="space-y-1.5">
          <Label>TikTok Advertiser ID (opcional)</Label>
          <Input
            placeholder="ID numérico"
            value={ttAdv}
            disabled={locked}
            onChange={(e) => setTtAdv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Requer token Marketing API (não só Events).</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={locked || save.isPending} onClick={() => save.mutate({})}>
            Guardar
          </Button>
          <Button
            variant="secondary"
            disabled={locked || save.isPending}
            onClick={() => save.mutate({ sync_costs_now: true })}
          >
            Sync custos agora
          </Button>
          <Button
            variant="outline"
            disabled={locked || save.isPending || !enabled}
            onClick={() => save.mutate({ run_automizer_now: true })}
          >
            Correr Automizer agora
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/integracoes">Voltar</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-2xl mt-6 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Últimas acções</h2>
        {(data?.recent_logs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem logs. Active dry-run e sync custos.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data!.recent_logs.map((l) => (
              <li key={l.id} className="border-t border-border/40 pt-2 first:border-0 first:pt-0">
                <span className="font-mono text-xs">{l.keyword}</span>
                <span className="text-muted-foreground"> — {l.action}</span>
                {l.dry_run ? (
                  <span className="ml-1 text-[10px] uppercase text-amber-600">dry-run</span>
                ) : null}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(l.created_at).toLocaleString("pt-PT")}
                  {!l.ok ? " · falhou" : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{l.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
