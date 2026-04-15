import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, ShieldCheck, Search, Trash2, AlertTriangle, Bot, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { integrationsService } from "@/services/integrationsService";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";

export default function Blacklist() {
  const queryClient = useQueryClient();
  const [newIp, setNewIp] = useState("");
  const [newWlIp, setNewWlIp] = useState("");
  const [newWlNote, setNewWlNote] = useState("");

  const { data: guards, isLoading: loadingGuards } = useQuery({
    queryKey: ["integrations-tracking-guards"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getTrackingGuards();
      if (error) throw new Error(error);
      return data ?? null;
    },
  });

  const { data: whitelist, isLoading: loadingWl } = useQuery({
    queryKey: ["integrations-whitelist"],
    queryFn: async () => {
      const { data, error } = await integrationsService.listWhitelist();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: blacklist, isLoading } = useQuery({
    queryKey: ["integrations-blacklist"],
    queryFn: async () => {
      const { data, error } = await integrationsService.listBlacklist();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ["analytics-blacklist-blocks"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getBlacklistBlocks({ limit: 50 });
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.addBlacklist({ ip: newIp.trim() });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success("IP adicionado à blacklist.");
      setNewIp("");
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await integrationsService.removeBlacklist(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success("IP removido.");
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchGuardsMutation = useMutation({
    mutationFn: async (body: { block_empty_user_agent?: boolean; block_bot_clicks?: boolean }) => {
      const { data, error } = await integrationsService.patchTrackingGuards(body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success("Definições atualizadas.");
      void queryClient.invalidateQueries({ queryKey: ["integrations-tracking-guards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addWlMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.addWhitelist({
        ip: newWlIp.trim(),
        note: newWlNote.trim() || undefined,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success("IP adicionado à whitelist.");
      setNewWlIp("");
      setNewWlNote("");
      void queryClient.invalidateQueries({ queryKey: ["integrations-whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWlMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await integrationsService.removeWhitelist(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success("IP removido da whitelist.");
      void queryClient.invalidateQueries({ queryKey: ["integrations-whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newIp.trim()) {
      toast.error("Insira um IP.");
      return;
    }
    addMutation.mutate();
  };

  const handleAddWl = () => {
    if (!newWlIp.trim()) {
      toast.error("Insira um IP.");
      return;
    }
    addWlMutation.mutate();
  };

  if (isLoading || loadingGuards || loadingWl) return <LoadingState message="Carregando proteções de IP…" />;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Proteções de tracking por IP"
        description="Rate limit global no servidor, lista opcional de permitidos, blacklist, e regras opcionais (UA vazio / bots). IPv4 só."
      />

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Regras opcionais da conta</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Desativadas por defeito. Ative só se souber o impacto (ex.: bloquear bots pode afetar pré-visualizações de redes).
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="guard-empty-ua">Recusar pedidos sem User-Agent</Label>
            <p className="text-xs text-muted-foreground">Reduz tráfego «anónimo» ou scripts sem UA (403).</p>
          </div>
          <Switch
            id="guard-empty-ua"
            checked={guards?.block_empty_user_agent ?? false}
            disabled={patchGuardsMutation.isPending}
            onCheckedChange={(v) => patchGuardsMutation.mutate({ block_empty_user_agent: v })}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="guard-bots">Bloquear cliques identificados como bot (UA)</Label>
            <p className="text-xs text-muted-foreground">Recusa tracking quando o UA corresponde a crawler/bot conhecido (403).</p>
          </div>
          <Switch
            id="guard-bots"
            checked={guards?.block_bot_clicks ?? false}
            disabled={patchGuardsMutation.isPending}
            onCheckedChange={(v) => patchGuardsMutation.mutate({ block_bot_clicks: v })}
          />
        </div>
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">Whitelist (permitidos)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground/90">Só faz efeito se existir pelo menos um IP:</strong> nesse modo, apenas esses IPv4
          podem gerar cliques/impressões rastreados; todos os outros recebem 403 (além da blacklist, que continua a bloquear).
          Lista vazia = desligado.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
          <Input
            className="sm:flex-1 min-w-[140px]"
            placeholder="IPv4 permitido"
            value={newWlIp}
            onChange={(e) => setNewWlIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddWl()}
          />
          <Input
            className="sm:flex-1 min-w-[140px]"
            placeholder="Nota (opcional)"
            value={newWlNote}
            onChange={(e) => setNewWlNote(e.target.value)}
          />
          <Button type="button" onClick={handleAddWl} disabled={addWlMutation.isPending} className="gap-2 shrink-0">
            <ShieldCheck className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {!whitelist?.length ? (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhum IP na whitelist — modo restrito desligado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nota</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-card-foreground">{item.ip}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.note || "—"}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={removeWlMutation.isPending}
                        onClick={() => removeWlMutation.mutate(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Blacklist (bloqueados)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bloqueio por IP: estes pedidos não contam como clique ou impressão.</p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 w-full">
          <div className="space-y-2 flex-1 w-full">
            <Input
              placeholder="IPv4, ex: 203.0.113.10"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="gap-2 w-full sm:w-auto shrink-0 gradient-primary border-0 text-primary-foreground hover:opacity-90"
          >
            <Search className="h-4 w-4" /> Adicionar à blacklist
          </Button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200/90">
            <strong>Blacklist:</strong> pedidos de <span className="font-mono text-xs">/track/r/…</span>, pixel,{" "}
            <span className="font-mono text-xs">/track/click</span> e <span className="font-mono text-xs">/track/event</span> com este IP
            recebem 403 e <strong>não contam</strong>. Outras regras (whitelist, rate limit, UA, bots) aparecem na mesma tabela abaixo
            quando configuradas.
          </p>
        </div>

        {!blacklist?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum IP na blacklist.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nota</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Adicionado</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-card-foreground">{item.ip}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.reason || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">
                      {new Date(item.added_at).toLocaleString("pt-PT")}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        aria-label="Remover IP"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Tentativas bloqueadas (recentes)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Inclui bloqueios por blacklist, whitelist (IP não permitido), limite de pedidos (anti-spam), UA vazio ou bot (conforme ativar acima).
        </p>
        {!blocks?.length ? (
          <p className="text-sm text-muted-foreground py-2">Ainda não há tentativas bloqueadas registadas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Canal</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground max-w-[160px]">Motivo</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground max-w-[200px]">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("pt-PT")}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{row.ip ?? "—"}</td>
                    <td className="py-2 px-3 text-xs">{row.channel ?? "—"}</td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground truncate max-w-[160px]" title={row.message ?? ""}>
                      {row.message || "—"}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground truncate max-w-[240px]" title={row.user_agent ?? ""}>
                      {row.user_agent || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Bots nos relatórios</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Por defeito, tráfego com <strong className="text-foreground/90">User-Agent</strong> de bot (Googlebot, crawlers, etc.){" "}
          <strong>continua a contar</strong> nos eventos, com etiqueta <Badge variant="secondary" className="mx-0.5">bot</Badge> em Analytics.
          Pode ativar <strong className="text-foreground/90">Bloquear cliques identificados como bot</strong> acima para recusar esses pedidos (403).
          IP em blacklist ou fora da whitelist (modo restrito) também são bloqueados.
        </p>
      </div>
    </div>
  );
}
