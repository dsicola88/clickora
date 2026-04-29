import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollText } from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { listAiRuns, listAuditChangeRequests } from "@/server/app-data.functions";
import type {
  AiFeature,
  AiRunRow,
  AiRunStatus,
  ChangeRequestStatus,
  ChangeRequestType,
  PaidChangeRequestRow,
} from "@/types/domain";

type AiRun = AiRunRow;
type CR = PaidChangeRequestRow;

export const Route = createFileRoute("/app/projects/$projectId/paid/audit")({
  component: AuditLog,
});

const aiStatusLabel: Record<AiRunStatus, string> = {
  pending: "pendente",
  success: "sucesso",
  error: "erro",
};

const aiFeatureLabel: Record<AiFeature, string> = {
  keyword_plan: "plano de palavras-chave",
  rsa_generation: "geração de RSA",
  campaign_plan: "plano de campanha",
};

const crStatusLabel: Record<ChangeRequestStatus, string> = {
  pending: "pendente",
  approved: "aprovado",
  rejected: "rejeitado",
  applied: "aplicado",
  failed: "falhou",
};

const crTypeLabel: Record<ChangeRequestType, string> = {
  create_campaign: "criar campanha",
  update_budget: "atualizar orçamento",
  add_keywords: "adicionar palavras-chave",
  publish_rsa: "publicar anúncio RSA",
  pause_entity: "pausar entidade",
  meta_create_campaign: "criar campanha Meta",
  meta_update_budget: "atualizar orçamento Meta",
  meta_publish_creative: "publicar criativo Meta",
  meta_pause_entity: "pausar entidade Meta",
  tiktok_create_campaign: "criar campanha TikTok",
  tiktok_update_budget: "atualizar orçamento TikTok",
  tiktok_pause_entity: "pausar entidade TikTok",
};

function AuditLog() {
  const { projectId } = Route.useParams();
  const [runs, setRuns] = useState<AiRun[] | null>(null);
  const [crs, setCrs] = useState<CR[] | null>(null);
  const fetchRuns = useServerFn(listAiRuns);
  const fetchCrs = useServerFn(listAuditChangeRequests);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, c] = await Promise.all([
          fetchRuns({ data: { projectId } }),
          fetchCrs({ data: { projectId } }),
        ]);
        if (cancelled) return;
        setRuns(r);
        setCrs(c);
      } catch {
        if (!cancelled) {
          setRuns([]);
          setCrs([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchRuns, fetchCrs]);

  return (
    <div className="pb-12">
      <PageHeader
        title="Auditoria"
        description="Execuções de IA e pedidos de alteração, com estado e revisor."
      />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-2 sm:px-8">
        <Section
          title="Execuções de IA"
          icon={<ScrollText className="h-4 w-4" />}
          empty="Nenhuma execução de IA ainda."
          loading={runs === null}
        >
          {(runs ?? []).map((r) => (
            <Row
              key={r.id}
              left={aiFeatureLabel[r.feature] ?? r.feature.replace(/_/g, " ")}
              middle={r.input_summary ?? r.output_summary ?? "—"}
              right={
                <Badge
                  variant={
                    r.status === "success"
                      ? "success"
                      : r.status === "error"
                        ? "destructive"
                        : "muted"
                  }
                >
                  {aiStatusLabel[r.status] ?? r.status}
                </Badge>
              }
              meta={`${r.model} · ${formatRelative(r.created_at)} · ${
                (r.tokens_in ?? 0) + (r.tokens_out ?? 0)
              } tokens`}
            />
          ))}
        </Section>

        <Section
          title="Pedidos de mudança"
          icon={<ScrollText className="h-4 w-4" />}
          empty="Nenhum pedido de mudança ainda."
          loading={crs === null}
        >
          {(crs ?? []).map((c) => (
            <Row
              key={c.id}
              left={crTypeLabel[c.type] ?? c.type.replace(/_/g, " ")}
              middle={c.error_message ?? "—"}
              right={
                <Badge
                  variant={
                    c.status === "applied"
                      ? "success"
                      : c.status === "rejected" || c.status === "failed"
                        ? "destructive"
                        : c.status === "approved"
                          ? "info"
                          : "warning"
                  }
                >
                  {crStatusLabel[c.status] ?? c.status}
                </Badge>
              }
              meta={`solicitado ${formatRelative(c.created_at)}${
                c.reviewed_at ? ` · revisado ${formatRelative(c.reviewed_at)}` : ""
              }`}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  empty,
  loading,
  children,
}: {
  title: string;
  icon: ReactNode;
  empty: string;
  loading: boolean;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
          {icon}
        </div>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="divide-y divide-border">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !hasChildren ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Row({
  left,
  middle,
  right,
  meta,
}: {
  left: string;
  middle: string;
  right: ReactNode;
  meta: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium capitalize">{left}</p>
        <p className="truncate text-xs text-muted-foreground">{middle}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{meta}</p>
      </div>
      <div>{right}</div>
    </div>
  );
}
