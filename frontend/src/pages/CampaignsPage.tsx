import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { campaignsService, type AffiliateCampaign } from "@/services/campaignsService";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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
        description="Uma campanha liga a oferta, a fonte de tráfego e a presell. Comece por criar uma presell."
        actionLabel="Criar presell"
        onAction={() => navigate("/presells/nova")}
        icon={<Megaphone className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Campanhas"
        description="Cliques, conversões, gasto e lucro por campanha (últimos 14 dias)."
        actions={
          <Button className="gap-2" onClick={() => navigate("/presells/nova")}>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Fonte</th>
              <th className="px-4 py-3 font-medium text-right">Cliques</th>
              <th className="px-4 py-3 font-medium text-right">Conv.</th>
              <th className="px-4 py-3 font-medium text-right">Receita</th>
              <th className="px-4 py-3 font-medium text-right">Gasto</th>
              <th className="px-4 py-3 font-medium text-right">Lucro</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium w-12" />
            </tr>
          </thead>
          <tbody>
            {data.map((c: AffiliateCampaign) => {
              const s = c.stats;
              return (
                <tr key={c.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link to={`/campanhas/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                    {c.presell?.title ? (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{c.presell.title}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.traffic_source}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s?.clicks ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s?.conversions ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(s?.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(c.spend_amount)}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      s?.profit != null && s.profit < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {money(s?.profit)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => {
                        if (confirm("Remover esta campanha?")) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
