import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
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
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel, ProTable, ProTh, ProTd, ProEmpty } from "@/components/enterprise/ProShell";

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
      return { data: d, extra };
    },
    onSuccess: ({ data: d, extra }) => {
      void qc.invalidateQueries({ queryKey: ["affiliate-automizer"] });
      if (extra?.sync_costs_now) {
        void qc.invalidateQueries({ queryKey: ["analytics"] });
        void qc.invalidateQueries({ queryKey: ["results"] });
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
      if (extra?.sync_costs_now && d?.cost_sync) {
        const parts: string[] = [];
        if (d.cost_sync.google.ok) parts.push(`Google OK (${d.cost_sync.google.rows ?? 0} dias)`);
        else if (d.cost_sync.google.error && d.cost_sync.google.error !== "google_not_ready")
          parts.push(`Google: ${d.cost_sync.google.error}`);
        else parts.push("Google: ligue a conta em Integrações");
        if (d.cost_sync.meta.ok) parts.push(`Meta OK (${d.cost_sync.meta.rows ?? 0})`);
        else if (metaAct.trim() && d.cost_sync.meta.error && d.cost_sync.meta.error !== "meta_not_configured")
          parts.push(`Meta: ${d.cost_sync.meta.error}`);
        if (d.cost_sync.tiktok.ok) parts.push(`TikTok OK (${d.cost_sync.tiktok.rows ?? 0})`);
        else if (ttAdv.trim() && d.cost_sync.tiktok.error && d.cost_sync.tiktok.error !== "tiktok_not_configured")
          parts.push(`TikTok: ${d.cost_sync.tiktok.error}`);
        const anyOk = d.cost_sync.google.ok || d.cost_sync.meta.ok || d.cost_sync.tiktok.ok;
        if (anyOk) toast.success("Custos actualizados", { description: parts.join(" · ") });
        else toast.error("Não foi possível sincronizar custos", { description: parts.join(" · ") });
        return;
      }
      if (extra?.run_automizer_now && d?.automizer_run) {
        const r = d.automizer_run;
        toast.success("Automizer executado", {
          description: `Avaliadas ${r.evaluated} · pausadas ${r.paused} · simulação ${r.dry_run} · ignoradas ${r.skipped}`,
        });
        return;
      }
      toast.success("Definições guardadas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message="A carregar custos automáticos…" />
      </div>
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Custos automáticos"
        subtitle="Pausa palavras-chave sem vendas e actualiza o custo em Resultados. Comece em simulação."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="max-w-none space-y-5 rounded-lg border border-border/70 bg-card p-5">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Regra: gasto acima do limite, visitas acima do mínimo e nenhuma venda. A palavra-chave fica em pausa no Google Ads.
            </p>
            <p>
              Comece em <strong className="text-foreground">simulação</strong> (só regista o que pausaria). Depois desligue a simulação.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-on">Activar pausa automática</Label>
          <Switch id="auto-on" checked={enabled} disabled={locked} onCheckedChange={setEnabled} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-dry">Simulação (recomendado)</Label>
            <p className="text-xs text-muted-foreground">Não pausa de verdade — só escreve no registo.</p>
          </div>
          <Switch id="auto-dry" checked={dryRun} disabled={locked} onCheckedChange={setDryRun} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Gasto mín.</Label>
            <Input
              type="number"
              min={1}
              value={minSpend}
              disabled={locked}
              onChange={(e) => setMinSpend(Number(e.target.value) || 15)}
            />
            <p className="text-[10px] text-muted-foreground">Moeda da conta Google Ads (não força USD).</p>
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
          <Label>Número da conta Meta (opcional)</Label>
          <Input
            placeholder="Número da conta de anúncios"
            value={metaAct}
            disabled={locked}
            onChange={(e) => setMetaAct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Usa a mesma ligação da Meta, com permissão para ler anúncios.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Número da conta TikTok (opcional)</Label>
          <Input
            placeholder="ID numérico"
            value={ttAdv}
            disabled={locked}
            onChange={(e) => setTtAdv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Precisa de token Marketing API do TikTok (o token só Events API não lê gasto).
          </p>
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
            Actualizar custos agora
          </Button>
          <Button
            variant="outline"
            disabled={locked || save.isPending || !enabled}
            onClick={() => save.mutate({ run_automizer_now: true })}
          >
            Aplicar pausas agora
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/integracoes">Voltar</Link>
          </Button>
        </div>
      </section>

      <ProPanel title="Histórico" description="Últimas 30 acções, em simulação ou de verdade.">
        {(data?.recent_logs?.length ?? 0) === 0 ? (
          <ProEmpty title="Sem registos" detail="Active a simulação e aplique as pausas, ou actualize os custos." />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <ProTh>Quando</ProTh>
                <ProTh>Palavra-chave</ProTh>
                <ProTh>Acção</ProTh>
                <ProTh>Modo</ProTh>
              </tr>
            </thead>
            <tbody>
              {data!.recent_logs.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <ProTd className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-PT")}
                  </ProTd>
                  <ProTd mono>{l.keyword}</ProTd>
                  <ProTd>
                    <span className="text-xs">{l.action}</span>
                    {l.reason ? <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[280px]">{l.reason}</p> : null}
                  </ProTd>
                  <ProTd className="text-[11px]">
                    {l.dry_run ? "simulação" : l.ok ? "real" : "erro"}
                  </ProTd>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </ProPanel>
      </div>
    </div>
  );
}
