import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { campaignsService, type AffiliateCampaign } from "@/services/campaignsService";
import { Megaphone } from "lucide-react";

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await campaignsService.list();
      if (error) throw new Error(error);
      return data ?? [];
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
        description="Oferta, tráfego e resultados num só sítio."
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
              <th className="px-4 py-3 font-medium">Presell</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium w-12" />
            </tr>
          </thead>
          <tbody>
            {data.map((c: AffiliateCampaign) => (
              <tr key={c.id} className="border-t border-border/50 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <Link to={`/campanhas/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.traffic_source}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.presell?.title ?? "—"}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
