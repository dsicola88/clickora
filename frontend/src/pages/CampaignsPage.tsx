import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { campaignsService } from "@/services/campaignsService";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProPanel,
  ProTable,
  ProTh,
  ProTd,
  ProStatusDot,
} from "@/components/enterprise/ProShell";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function statusLabel(s: string) {
  if (s === "active") return "Activa";
  if (s === "draft") return "Rascunho";
  if (s === "paused") return "Pausada";
  return s;
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", "with_stats"],
    queryFn: async () => {
      const withStats = await campaignsService.list({ with_stats: true });
      if (!withStats.error && withStats.data) return withStats.data;
      const basic = await campaignsService.list();
      if (basic.error) throw new Error(basic.error || withStats.error || "Erro ao carregar");
      return basic.data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await campaignsService.remove(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState message="A carregar campanhas…" />;
  if (isError) return <ErrorState message="Erro ao carregar campanhas." onRetry={() => refetch()} />;

  if (data.length === 0) {
    return (
      <EmptyState
        title="Ainda sem campanhas"
        description="Uma campanha liga oferta, fonte de tráfego e presell. Comece pela presell com URL rastreado."
        actionLabel="Criar presell"
        onAction={() => navigate("/presells/nova")}
        icon={<Megaphone className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Campanhas"
        subtitle="Stats dos últimos 14 dias por utm_campaign (slug). Gasto na tabela = valor manual na ficha."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/presells/nova")}>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        }
      />

      <ProPanel title={`${data.length} campanha(s)`} description="Receita do período por slug · lucro/ROAS de conta no P&L (sync). Manual* = lifetime na ficha.">
        <ProTable>
          <thead>
            <tr>
              <ProTh>Nome</ProTh>
              <ProTh>Estado</ProTh>
              <ProTh>Fonte</ProTh>
              <ProTh align="right">Clk</ProTh>
              <ProTh align="right">Conv</ProTh>
              <ProTh align="right">Receita</ProTh>
              <ProTh align="right">Manual*</ProTh>
              <ProTh align="right">EPC</ProTh>
              <ProTh align="right"> </ProTh>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <ProTd>
                  <Link to={`/campanhas/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                  {c.presell ? (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">{c.presell.title}</p>
                  ) : (
                    <p className="text-[10px] text-amber-600">Sem presell</p>
                  )}
                </ProTd>
                <ProTd>
                  <ProStatusDot ok={c.status === "active"} label={statusLabel(c.status)} />
                </ProTd>
                <ProTd className="text-xs text-muted-foreground">{c.traffic_source}</ProTd>
                <ProTd align="right">{c.stats?.clicks ?? 0}</ProTd>
                <ProTd align="right">{c.stats?.conversions ?? 0}</ProTd>
                <ProTd align="right">{money(c.stats?.revenue)}</ProTd>
                <ProTd align="right" className="text-muted-foreground">
                  {money(c.spend_amount)}
                </ProTd>
                <ProTd align="right">{money(c.stats?.epc)}</ProTd>
                <ProTd align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Eliminar"
                    onClick={() => {
                      if (confirm(`Eliminar «${c.name}»?`)) del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ProTd>
              </tr>
            ))}
          </tbody>
        </ProTable>
      </ProPanel>
    </div>
  );
}
