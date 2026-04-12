import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, Search, Trash2, AlertTriangle, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { integrationsService } from "@/services/integrationsService";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";

export default function Blacklist() {
  const queryClient = useQueryClient();
  const [newIp, setNewIp] = useState("");

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

  const handleAdd = () => {
    if (!newIp.trim()) {
      toast.error("Insira um IP.");
      return;
    }
    addMutation.mutate();
  };

  if (isLoading) return <LoadingState message="Carregando blacklist…" />;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Blacklist de IPs"
        description="Bloqueia cliques e impressões de tracking para endereços IPv4. Os bloqueios ficam na base de dados e aparecem em tentativas bloqueadas."
      />

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
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
            <strong>Como funciona:</strong> pedidos de <span className="font-mono text-xs">/track/r/…</span>, pixel e{" "}
            <span className="font-mono text-xs">/track/click</span> com este IP recebem 403 e <strong>não contam</strong> como clique ou
            impressão. O evento é registado abaixo como tentativa bloqueada.
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
          Registo automático quando alguém com IP na lista tenta gerar clique ou impressão rastreada.
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
          Tráfego identificado por <strong className="text-foreground/90">User-Agent</strong> (Googlebot, ferramentas, crawlers, etc.) aparece em{" "}
          <strong className="text-foreground/90">Analytics → Últimos cliques</strong> com dispositivo <Badge variant="secondary" className="mx-0.5">bot</Badge> e etiqueta do tipo de bot.
          Isto não bloqueia o acesso — só classifica para análise. Use a blacklist acima para bloquear por IP.
        </p>
      </div>
    </div>
  );
}
