import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMicrosUsd, formatRelative } from "@/lib/format";
import { listChangeRequests, reviewChangeRequest } from "@/server/app-data.functions";
import type { ChangeRequestStatus, ChangeRequestType, PaidChangeRequestRow } from "@/types/domain";

export const Route = createFileRoute("/app/projects/$projectId/paid/approvals")({
  component: ApprovalsQueue,
});

type CR = PaidChangeRequestRow;

type PlatformFilter = "all" | "google_ads" | "meta_ads" | "tiktok_ads";

function ApprovalsQueue() {
  const { projectId } = Route.useParams();
  const [rows, setRows] = useState<CR[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const fetchList = useServerFn(listChangeRequests);
  const submitReview = useServerFn(reviewChangeRequest);

  const load = async () => {
    const data = await fetchList({ data: { projectId } });
    setRows(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filtered = (rows ?? []).filter((cr) => {
    if (platform === "all") return true;
    if (platform === "meta_ads") return cr.type.startsWith("meta_");
    if (platform === "tiktok_ads") return cr.type.startsWith("tiktok_");
    return !cr.type.startsWith("meta_") && !cr.type.startsWith("tiktok_");
  });

  const review = async (cr: CR, status: "approved" | "rejected" | "applied") => {
    setBusyId(cr.id);
    try {
      await submitReview({ data: { id: cr.id, status } });
      toast.success(
        status === "approved" ? "Aprovado" : status === "rejected" ? "Rejeitado" : "Aplicado",
      );
      await load();
    } catch (e) {
      toast.error("Ação falhou", { description: e instanceof Error ? e.message : "Erro" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pb-12">
      <PageHeader
        title="Aprovações"
        description="Aprove, rejeite ou aplique. Google e Meta publicam ativos na conta; Meta (UE) exige DSA: META_DSA_BENEFICIARY e META_DSA_PAYOR. TikTok cria campanha + ad group (v1.3). Anúncios de vídeo TikTok podem ainda requerer o Ads Manager."
        actions={
          <div className="flex gap-1 rounded-md border border-border bg-card p-1">
            {(["all", "google_ads", "meta_ads", "tiktok_ads"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                  (platform === p
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {p === "all"
                  ? "Todas"
                  : p === "google_ads"
                    ? "Google"
                    : p === "meta_ads"
                      ? "Meta"
                      : "TikTok"}
              </button>
            ))}
          </div>
        }
      />
      <div className="px-6 py-6 sm:px-8">
        {rows === null ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {filtered.map((cr) => (
              <ChangeRequestCard
                key={cr.id}
                cr={cr}
                busy={busyId === cr.id}
                onAction={(s) => review(cr, s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-12 text-center shadow-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/30">
        <ListChecks className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">Nenhuma mudança pendente</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Quando a IA gerar um plano, ou o Autopilot quiser aplicar algo fora dos guardrails, isso
        aparece aqui para revisão.
      </p>
    </div>
  );
}

const statusColor: Record<
  ChangeRequestStatus,
  "warning" | "success" | "destructive" | "muted" | "info"
> = {
  pending: "warning",
  approved: "info",
  rejected: "destructive",
  applied: "success",
  failed: "destructive",
};

const statusLabel: Record<ChangeRequestStatus, string> = {
  pending: "pendente",
  approved: "aprovado",
  rejected: "rejeitado",
  applied: "aplicado",
  failed: "falhou",
};

const typeLabel: Record<ChangeRequestType, string> = {
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

function translateStatus(s: ChangeRequestStatus) {
  return statusLabel[s] ?? s;
}
function translateType(t: ChangeRequestType) {
  return typeLabel[t] ?? t.replace(/_/g, " ");
}

function ChangeRequestCard({
  cr,
  busy,
  onAction,
}: {
  cr: CR;
  busy: boolean;
  onAction: (status: "approved" | "rejected" | "applied") => void;
}) {
  const payload = cr.payload as Record<string, unknown> | null;
  const reasons = (payload?.reasons as Array<{ code: string; message: string }> | undefined) ?? [];
  const autoApplied = Boolean(payload?.auto_applied);
  const mode = (payload?.mode as string | undefined) ?? null;
  const isPending = cr.status === "pending";
  const isApproved = cr.status === "approved";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft">{translateType(cr.type)}</Badge>
            <Badge variant={statusColor[cr.status]}>{translateStatus(cr.status)}</Badge>
            {autoApplied && <Badge variant="success">auto-aplicado · Autopilot</Badge>}
            {mode && !autoApplied && (
              <Badge variant="muted">modo {mode === "autopilot" ? "Autopilot" : "Copilot"}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              · solicitado {formatRelative(cr.created_at)}
            </span>
          </div>

          {reasons.length > 0 && (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {autoApplied ? "Aplicado apesar de avisos" : "Por que está aguardando aprovação"}
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-foreground/90">
                {reasons.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden>•</span>
                    <span>{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DiffPreview cr={cr} payload={payload} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPending && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction("rejected")}
                disabled={busy}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar
              </Button>
              <Button size="sm" onClick={() => onAction("approved")} disabled={busy}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar
              </Button>
            </>
          )}
          {(isApproved || isPending) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAction("applied")}
              disabled={busy}
              title="Marca como aplicado em modo dev (API de publicação do Google Ads não conectada)"
            >
              <PlayCircle className="mr-1 h-3.5 w-3.5" /> Simular aplicação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffPreview({ cr, payload }: { cr: CR; payload: Record<string, unknown> | null }) {
  if (cr.type === "create_campaign" && payload) {
    const plan = payload.plan as
      | {
          campaign?: { name?: string; objective_summary?: string };
          ad_groups?: Array<{
            name?: string;
            keywords?: { text: string; match_type: string }[];
            rsa?: { headlines?: string[]; descriptions?: string[] };
          }>;
        }
      | undefined;
    const budget = payload.daily_budget_micros as number | undefined;
    const geos = (payload.geo_targets as string[] | undefined) ?? [];
    return (
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-sm font-semibold">{plan?.campaign?.name ?? "Campanha"}</p>
          <p className="text-xs text-muted-foreground">{plan?.campaign?.objective_summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Orçamento diário {formatMicrosUsd(budget ?? 0)} · {geos.join(", ") || "—"}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(plan?.ad_groups ?? []).slice(0, 4).map((ag, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold">{ag.name}</p>
              <p className="mt-1 text-muted-foreground">
                {ag.keywords?.length ?? 0} palavras-chave · {ag.rsa?.headlines?.length ?? 0} títulos
              </p>
              {ag.keywords?.slice(0, 4).map((k, ki) => (
                <span
                  key={ki}
                  className="mr-1 mt-1.5 inline-block rounded bg-background px-1.5 py-0.5 text-[11px]"
                >
                  {k.text} <span className="text-muted-foreground">[{k.match_type}]</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
