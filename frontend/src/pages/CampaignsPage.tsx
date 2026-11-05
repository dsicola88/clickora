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
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useAppLocale();

  const statusLabel = (s: string) => {
    if (s === "active") return t("pages.campaigns.statusActive");
    if (s === "draft") return t("pages.campaigns.statusDraft");
    if (s === "paused") return t("pages.campaigns.statusPaused");
    return s;
  };

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", "with_stats"],
    queryFn: async () => {
      const withStats = await campaignsService.list({ with_stats: true });
      if (!withStats.error && withStats.data) return withStats.data;
      const basic = await campaignsService.list();
      if (basic.error) throw new Error(basic.error || withStats.error || t("pages.campaigns.loadError"));
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
      toast.success(t("pages.campaigns.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState message={t("pages.campaigns.loading")} />;
  if (isError) return <ErrorState message={t("pages.campaigns.loadError")} onRetry={() => refetch()} />;

  if (data.length === 0) {
    return (
      <EmptyState
        title={t("pages.campaigns.emptyTitle")}
        description={t("pages.campaigns.emptyDesc")}
        actionLabel={t("pages.campaigns.createPresellAction")}
        onAction={() => navigate("/presells/nova")}
        icon={<Megaphone className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.campaigns.title")}
        subtitle={t("pages.campaigns.subtitle")}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/presells/nova")}>
            <Plus className="h-4 w-4" />
            {t("pages.campaigns.create")}
          </Button>
        }
      />

      <ProPanel
        title={fill(t("pages.campaigns.panelTitle"), { n: data.length })}
        description={t("pages.campaigns.panelDesc")}
      >
        <ProTable>
          <thead>
            <tr>
              <ProTh>{t("pages.campaigns.colName")}</ProTh>
              <ProTh>{t("pages.campaigns.colStatus")}</ProTh>
              <ProTh>{t("pages.campaigns.colSource")}</ProTh>
              <ProTh align="right">{t("pages.campaigns.colClicks")}</ProTh>
              <ProTh align="right">{t("pages.campaigns.colSales")}</ProTh>
              <ProTh align="right">{t("pages.campaigns.colRevenue")}</ProTh>
              <ProTh align="right">{t("pages.campaigns.colManual")}</ProTh>
              <ProTh align="right">{t("pages.campaigns.colEpc")}</ProTh>
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
                    <p className="text-[10px] text-amber-600">{t("pages.campaigns.noPresell")}</p>
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
                    title={t("pages.campaigns.deleteTitle")}
                    onClick={() => {
                      if (confirm(fill(t("pages.campaigns.deleteConfirm"), { name: c.name }))) del.mutate(c.id);
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
