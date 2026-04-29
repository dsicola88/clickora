import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Layers, Sparkles, Target, Video } from "lucide-react";

import { getTikTokOverviewCounts } from "@/server/app-data.functions";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NewTikTokCampaignButton,
  TikTokConnectionCard,
} from "./app.projects.$projectId.paid.tiktok";

export const Route = createFileRoute("/app/projects/$projectId/paid/tiktok/")({
  component: TikTokOverview,
});

function TikTokOverview() {
  const { projectId } = Route.useParams();
  const [counts, setCounts] = useState<{
    campaigns: number;
    drafts: number;
    pending: number;
  } | null>(null);

  const loadCounts = useServerFn(getTikTokOverviewCounts);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await loadCounts({ data: { projectId } });
        if (!cancelled) setCounts(c);
      } catch {
        if (!cancelled) setCounts({ campaigns: 0, drafts: 0, pending: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadCounts]);

  return (
    <div className="pb-12">
      <PageHeader
        title="TikTok Ads · visão geral"
        description="TikTok Marketing API e mesma fila de aprovações que Google e Meta."
        actions={<NewTikTokCampaignButton projectId={projectId} />}
      />
      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          <TikTokConnectionCard projectId={projectId} />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label="Campanhas TikTok"
            value={counts?.campaigns}
            sub={counts ? `${counts.drafts} em rascunho` : undefined}
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Aprovações TikTok pendentes"
            value={counts?.pending}
            sub={counts && counts.pending > 0 ? "À revisar antes da API" : "fila vazia"}
            link={{
              to: "/app/projects/$projectId/paid/approvals",
              label: "Ver fila",
            }}
            projectId={projectId}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <InfoCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Como funciona"
            body="Após OAuth, aprovar na fila cria campanha na API; vídeo completo pode precisar do Ads Manager."
          />
          <InfoCard
            icon={<Video className="h-4 w-4" />}
            title="Instagram no mesmo produto"
            body="Instagram continua em Meta Ads; aqui é só TikTok."
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  link,
  projectId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  sub?: string;
  link?: { to: "/app/projects/$projectId/paid/approvals"; label: string };
  projectId?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
          {icon}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold">
        {value === undefined ? <Skeleton className="h-7 w-16" /> : value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      {link && projectId && value !== undefined && value > 0 && (
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to={link.to} params={{ projectId }}>
            {link.label}
          </Link>
        </Button>
      )}
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600 ring-1 ring-inset ring-pink-500/30 dark:text-pink-400">
          {icon}
        </div>
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <div className="mt-3">
        <Badge variant="muted" className="text-pink-600 dark:text-pink-400">
          <Video className="mr-1 h-3 w-3" /> TikTok Ads
        </Badge>
      </div>
    </div>
  );
}
