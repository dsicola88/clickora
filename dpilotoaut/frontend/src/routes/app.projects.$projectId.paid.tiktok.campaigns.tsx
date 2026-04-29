import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Video } from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMicrosUsd, formatRelative } from "@/lib/format";
import { listPaidCampaigns } from "@/server/app-data.functions";
import type { CampaignStatus, PaidCampaignRow } from "@/types/domain";

type Campaign = PaidCampaignRow;
type Status = CampaignStatus;

const statusVariant: Record<Status, "muted" | "success" | "warning" | "info" | "destructive"> = {
  draft: "muted",
  pending_publish: "warning",
  live: "success",
  paused: "info",
  archived: "muted",
  error: "destructive",
};
const statusLabel: Record<Status, string> = {
  draft: "rascunho",
  pending_publish: "aguardando publicação",
  live: "no ar",
  paused: "pausada",
  archived: "arquivada",
  error: "erro",
};

export const Route = createFileRoute("/app/projects/$projectId/paid/tiktok/campaigns")({
  component: TikTokCampaigns,
});

function TikTokCampaigns() {
  const { projectId } = Route.useParams();
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const fetchCampaigns = useServerFn(listPaidCampaigns);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCampaigns({
        data: { projectId, platform: "tiktok_ads" },
      });
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchCampaigns]);

  return (
    <div className="pb-12">
      <PageHeader
        title="Campanhas TikTok"
        description="Lista de campanhas TikTok Ads (rascunhos → fila)."
        actions={
          <Button asChild>
            <Link to="/app/projects/$projectId/paid/tiktok" params={{ projectId }}>
              <Plus className="mr-1 h-4 w-4" /> Novo rascunho (visão geral)
            </Link>
          </Button>
        }
      />
      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {rows === null ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty projectId={projectId} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Campanha</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Orçamento diário</th>
                  <th className="px-4 py-3 text-left">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.objective_summary}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatMicrosUsd(c.daily_budget_micros)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRelative(c.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-600 ring-1 ring-inset ring-pink-500/30 dark:text-pink-400">
        <Video className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">Nenhuma campanha TikTok</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Crie um rascunho na visão geral do TikTok Ads. Ele aparecerá aqui e na fila de aprovações.
      </p>
      <Button asChild>
        <Link to="/app/projects/$projectId/paid/tiktok" params={{ projectId }}>
          Ir para visão geral
        </Link>
      </Button>
    </div>
  );
}
