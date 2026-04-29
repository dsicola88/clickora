import { useCallback, useEffect, useMemo, useState, memo, startTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Activity, Info, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  campaignPlatformLabel,
  campaignStatusLabel,
  changeRequestStatusBadgeClass,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  formatUsdFromMicros,
  optimizerDecisionTypeLabel,
  optimizerExecutionBadgeClass,
  optimizerExecutionSummary,
  optimizerFlagsHint,
  optimizerRuleCodeLabel,
  changeRequestCampaignIdFromPayload,
  friendlyGoogleAdsNetworkError,
  summarizeChangeRequestPayload,
} from "@/lib/paidAdsUi";
import type { CampaignRow, ChangeRequestRow, OptimizerDecisionRow, PaidOverviewDto } from "@/services/paidAdsService";
import { cn } from "@/lib/utils";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DpilotPaidOauthGrid } from "./DpilotPaidOauthGrid";
import { DpilotCampaignOptimizerDialog } from "./DpilotCampaignOptimizerDialog";
import { DpilotCampaignArchiveButton } from "./DpilotCampaignArchiveButton";
import { DpilotGuardrailsCeilingCard } from "./DpilotGuardrailsCeilingCard";
import { DpilotOptimizerPauseLimitsCard } from "./DpilotOptimizerPauseLimitsCard";

export function Gate({ children }: { children: React.ReactNode }) {
  const { loading, err, overview, reload, loadingExtras } = useDpilotPaid();
  if (loading) {
    return (
      <div className="space-y-4 py-2" aria-busy="true" aria-label="A carregar dados do projecto">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-24 w-full max-w-2xl" />
      </div>
    );
  }
  if (err || !overview?.project) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 space-y-4">
        <p className="text-sm text-destructive leading-relaxed">
          {err || "Não foi possível carregar os dados deste projecto."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()} disabled={loadingExtras}>
          {loadingExtras ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              A actualizar…
            </>
          ) : (
            "Tentar novamente"
          )}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

export function DpilotVisaoPage() {
  const p = useDpilotPaid();
  const paidModeRaw = p.overview?.project.paid_mode ?? "";
  const paidModeLabel =
    paidModeRaw === "autopilot"
      ? "Autopilot"
      : paidModeRaw === "copilot"
        ? "Copilot"
        : paidModeRaw.replace(/_/g, " ") || "—";

  return (
    <Gate>
      <PageHeader
        title="Visão geral"
        description="Estado das contas publicitárias, modo de trabalho e pedidos que aguardam revisão."
      />
      {p.overview && (
        <p className="text-xs text-muted-foreground">
          ID do projecto (suporte): <code className="rounded bg-muted px-1 py-0.5">{p.projectId}</code>
        </p>
      )}
      <Card className="mt-4 border-border/80 bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Três passos simples</CardTitle>
          <CardDescription>O mesmo percurso para qualquer rede — ligue, crie e autorize quando o Copilot o pedir.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 rounded-lg border border-border/60 bg-background/80 p-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
              aria-hidden
            >
              1
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Ligar a conta</p>
              <p className="text-xs text-muted-foreground leading-snug">OAuth seguro por rede (Google, Meta ou TikTok).</p>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link to={`/tracking/dpilot/p/${p.projectId}/ligacoes`}>Abrir ligações</Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-border/60 bg-background/80 p-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
              aria-hidden
            >
              2
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Criar campanha</p>
              <p className="text-xs text-muted-foreground leading-snug">Assistente com IA — escolha a rede no menu.</p>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link to={`/tracking/dpilot/p/${p.projectId}/campanhas`}>Ver campanhas e criar</Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-border/60 bg-background/80 p-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
              aria-hidden
            >
              3
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Rever pedidos</p>
              <p className="text-xs text-muted-foreground leading-snug">Aprove ou aplique na rede quando aparecer aqui.</p>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link to={`/tracking/dpilot/p/${p.projectId}/aprovacoes`}>Ir para aprovações</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de trabalho</CardTitle>
            <CardDescription>Revisão manual vs. publicação automática</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{paidModeLabel}</p>
            <p className="mt-2 text-xs text-muted-foreground leading-snug">
              No modo Copilot, alterações sensíveis ficam em fila até aprovação. No Autopilot, dentro dos limites
              configurados, o sistema pode aplicar na rede por si.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Ads</CardTitle>
            <CardDescription>Estado</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {(p.overview?.connection as { status?: string; account_name?: string | null })?.status ===
              "connected" ? (
                <span className="text-emerald-600 dark:text-emerald-400">Ligado</span>
              ) : (
                <span className="text-muted-foreground">Não ligado</span>
              )}{" "}
              {
                (p.overview?.connection as { account_name?: string | null })?.account_name
                  ? `— ${(p.overview?.connection as { account_name?: string | null }).account_name}`
                  : null
              }
            </p>
          </CardContent>
        </Card>
        <DpilotGuardrailsCeilingCard />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprovações pendentes</CardTitle>
            <CardDescription>Decisões em aberto na fila</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{p.overview?.pending_approvals ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <DpilotOptimizerPauseLimitsCard />
      </div>

      <Card className="mt-6 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Motor automático (Autopilot)
          </CardTitle>
          <CardDescription>
            Auditoria paginada de pausas, escala de orçamento e recomendações de criativo — alinhada com os registos do
            servidor (<code className="text-[11px]">paid.optimizer</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/tracking/dpilot/p/${p.projectId}/auditoria`}>Abrir auditoria completa</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Mesmo nível de rastreio que ambientes enterprise (histórico imutável por decisão).
          </span>
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotLigacoesPage() {
  return (
    <Gate>
      <PageHeader
        title="Ligações às redes"
        description="Autenticação OAuth por rede — cada conta publicitária liga-se uma vez com segurança."
      />
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Utilize «Ligar» para autorizar o Clickora junto do Google, Meta ou TikTok. Pode renovar o acesso ou revogar a
        ligação em qualquer momento; os tokens são tratados como credenciais sensíveis no servidor.
      </p>
      <div className="mt-4">
        <DpilotPaidOauthGrid only="all" />
      </div>
    </Gate>
  );
}

export function DpilotGooglePage() {
  return (
    <Gate>
      <PageHeader
        title="Google Ads"
        description="Liga a conta de anunciante (OAuth) e vê a conta activa abaixo."
      />
      <div className="mt-4">
        <DpilotPaidOauthGrid only="google" />
      </div>
    </Gate>
  );
}

export function DpilotMetaPage() {
  const { metaConn, isConnConnected, metaCounts, oauthConfig } = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Meta (Facebook + Instagram)"
        description="Visão geral e ligação à conta de anúncios Meta."
      />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Campanhas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{metaCounts?.campaigns ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rascunhos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{metaCounts?.drafts ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pendentes (pedidos)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{metaCounts?.pending ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Criativos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{metaCounts?.creatives ?? "—"}</CardContent>
          </Card>
        </div>
        {oauthConfig?.meta?.available && (
          <p className="text-sm text-muted-foreground">
            Conta: {isConnConnected(metaConn) ? (metaConn?.account_name ?? "Ligada") : "Não ligada — usa &quot;Ligações&quot; para OAuth."}
          </p>
        )}
        <DpilotPaidOauthGrid only="meta" />
      </div>
    </Gate>
  );
}

export function DpilotTiktokPage() {
  const { projectId, tikConn, isConnConnected, tiktokCounts, oauthConfig } = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="TikTok Ads"
        description="Visão geral e ligação OAuth TikTok for Business."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/tiktok/nova`}>Nova campanha TikTok</Link>
          </Button>
        }
      />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Campanhas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{tiktokCounts?.campaigns ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rascunhos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{tiktokCounts?.drafts ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pendentes (pedidos)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{tiktokCounts?.pending ?? "—"}</CardContent>
          </Card>
        </div>
        {oauthConfig?.tiktok?.available && (
          <p className="text-sm text-muted-foreground">
            Conta: {isConnConnected(tikConn) ? (tikConn?.account_name ?? "Ligada") : "Não ligada — usa &quot;Ligações&quot;."}
          </p>
        )}
        <DpilotPaidOauthGrid only="tiktok" />
      </div>
    </Gate>
  );
}

function CampaignListWithFilters({
  list,
  empty,
  projectId,
  reload,
  showPlatformFilter,
}: {
  list: CampaignRow[];
  empty: string;
  projectId: string;
  reload: () => void;
  showPlatformFilter: boolean;
}) {
  const [searchParams] = useSearchParams();
  const campaignFocus = searchParams.get("campaign");
  const [plat, setPlat] = useState<string>("all");
  const [st, setSt] = useState<string>("excluding_archived");
  const filtered = useMemo(() => {
    let xs = list;
    if (showPlatformFilter && plat !== "all") {
      xs = xs.filter((c) => c.platform === plat);
    }
    if (st === "excluding_archived") {
      xs = xs.filter((c) => c.status !== "archived");
    } else if (st !== "all") {
      xs = xs.filter((c) => c.status === st);
    }
    return xs;
  }, [list, plat, st, showPlatformFilter]);

  useEffect(() => {
    if (!campaignFocus) return;
    const id = `dpilot-campaign-${campaignFocus}`;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [campaignFocus, filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {showPlatformFilter ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Plataforma</p>
            <Select value={plat} onValueChange={setPlat}>
              <SelectTrigger className="w-[190px]" aria-label="Filtrar por plataforma">
                <SelectValue placeholder="Rede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as redes</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="meta_ads">Meta</SelectItem>
                <SelectItem value="tiktok_ads">TikTok Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Estado</p>
          <Select value={st} onValueChange={setSt}>
            <SelectTrigger className="w-[190px]" aria-label="Filtrar por estado da campanha">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excluding_archived">Em trabalho (sem arquivadas)</SelectItem>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="draft">{campaignStatusLabel("draft")}</SelectItem>
              <SelectItem value="pending_publish">{campaignStatusLabel("pending_publish")}</SelectItem>
              <SelectItem value="live">{campaignStatusLabel("live")}</SelectItem>
              <SelectItem value="paused">{campaignStatusLabel("paused")}</SelectItem>
              <SelectItem value="archived">{campaignStatusLabel("archived")}</SelectItem>
              <SelectItem value="error">{campaignStatusLabel("error")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {campaignsTable(filtered, empty, { projectId, reload })}
    </div>
  );
}

function campaignsTable(
  list: CampaignRow[],
  empty: string,
  controls?: { projectId: string; reload: () => void },
) {
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground leading-relaxed">{empty}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Plataforma</TableHead>
          <TableHead>Estado</TableHead>
          {controls ? (
            <>
              <TableHead className="hidden md:table-cell w-[120px]">Pausa (motor)</TableHead>
              <TableHead className="w-[7.5rem] text-right text-xs font-medium text-muted-foreground">Acções</TableHead>
            </>
          ) : null}
          <TableHead className="hidden lg:table-cell">Motor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((c) => {
          const hint = optimizerFlagsHint(c.optimizer_flags);
          return (
            <TableRow key={c.id} id={`dpilot-campaign-${c.id}`}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">{campaignPlatformLabel(c.platform)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {campaignStatusLabel(c.status)}
                </Badge>
              </TableCell>
              {controls ? (
                <>
                  <TableCell className="hidden md:table-cell align-middle">
                    <DpilotCampaignOptimizerDialog
                      projectId={controls.projectId}
                      campaign={c}
                      reload={controls.reload}
                    />
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    <DpilotCampaignArchiveButton
                      projectId={controls.projectId}
                      campaign={c}
                      reload={controls.reload}
                    />
                  </TableCell>
                </>
              ) : null}
              <TableCell className="hidden max-w-[14rem] lg:table-cell">
                {hint ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help font-normal">
                        Optimização
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-left" side="bottom">
                      {hint}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DpilotCampanhasPage() {
  const { campaigns, projectId, reload } = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Campanhas"
        description="Liste por estado; arquive rascunhos que já não precise (Acções → Arquivar). Override do motor opcional («Pausa motor»)."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha (Google)</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          <CampaignListWithFilters
            list={campaigns}
            projectId={projectId}
            reload={reload}
            showPlatformFilter
            empty="Ainda não há campanhas neste projecto. Utilize o assistente «Nova campanha» na rede pretendida e conclua ou aplique os pedidos em «Aprovações», conforme o modo Copilot ou Autopilot."
          />
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotMetaCampanhasPage() {
  const { campaigns, projectId, reload } = useDpilotPaid();
  const list = useMemo(() => campaigns.filter((c) => c.platform === "meta_ads"), [campaigns]);
  return (
    <Gate>
      <PageHeader
        title="Meta · campanhas"
        description="Facebook e Instagram: filtre por estado e ajuste a pausa do motor por campanha quando for administrador."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/meta/nova`}>Nova campanha Meta</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          <CampaignListWithFilters
            list={list}
            projectId={projectId}
            reload={reload}
            showPlatformFilter={false}
            empty="Sem campanhas Meta ainda. Ligue a conta em «Ligações às redes», crie uma campanha pelo assistente e, em modo Copilot, autorize os pedidos pendentes em «Aprovações»."
          />
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotTiktokCampanhasPage() {
  const { campaigns, projectId, reload } = useDpilotPaid();
  const list = useMemo(() => campaigns.filter((c) => c.platform === "tiktok_ads"), [campaigns]);
  return (
    <Gate>
      <PageHeader
        title="TikTok · campanhas"
        description="Filtros por estado; override do motor opcional nas linhas seguintes."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/tiktok/nova`}>Nova campanha TikTok</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          <CampaignListWithFilters
            list={list}
            projectId={projectId}
            reload={reload}
            showPlatformFilter={false}
            empty="Sem campanhas TikTok ainda."
          />
        </CardContent>
      </Card>
    </Gate>
  );
}

/** Detecta campanha com orçamento acima do teto dos guardrails — para sugestão opcional («snap» ao limite). */
function budgetSnapSuggestion(args: {
  payload: Record<string, unknown> | null | undefined;
  overview: PaidOverviewDto | null;
  campaigns: CampaignRow[];
}): { show: boolean; campaignId: string | null; suggestedMicros: number | null } {
  const p = args.payload && typeof args.payload === "object" ? (args.payload as Record<string, unknown>) : {};
  const campaignId = typeof p.campaign_id === "string" ? p.campaign_id : null;
  const raw = args.overview?.guardrails?.max_daily_budget_micros;
  const maxM = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  const camp = campaignId ? args.campaigns.find((c) => c.id === campaignId) : undefined;
  const fromCamp =
    typeof camp?.daily_budget_micros === "number" && Number.isFinite(camp.daily_budget_micros)
      ? camp.daily_budget_micros
      : null;
  const dm = p.daily_budget_micros ?? p.dailyBudgetMicros;
  const fromPayload = typeof dm === "number" && Number.isFinite(dm) ? dm : null;
  const cur = fromCamp ?? fromPayload;
  if (!campaignId || maxM == null || cur == null) {
    return { show: false, campaignId, suggestedMicros: maxM };
  }
  return {
    show: cur > maxM,
    campaignId,
    suggestedMicros: maxM,
  };
}

function parseGeoList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function intersectGeoWithAllowedList(geoTargets: string[], allowedCountries: string[]): string[] {
  const allowed = new Set(allowedCountries.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of geoTargets) {
    const u = String(raw).trim().toUpperCase();
    if (!allowed.has(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Países da campanha incluem geografias não permitidas; sugere apenas a intersecção com a lista dos guardrails. */
function geoSnapSuggestion(args: {
  payload: Record<string, unknown> | null | undefined;
  overview: PaidOverviewDto | null;
  campaigns: CampaignRow[];
}): {
  show: boolean;
  campaignId: string | null;
  /** Lista resultante ao remover países proibidos (útil para rotular o botão). */
  suggestedCountries: string[];
} {
  const p = args.payload && typeof args.payload === "object" ? (args.payload as Record<string, unknown>) : {};
  const campaignId = typeof p.campaign_id === "string" ? p.campaign_id : null;
  const rawAllowed = args.overview?.guardrails?.allowed_countries;
  const allowedCountries = Array.isArray(rawAllowed)
    ? rawAllowed.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!campaignId || allowedCountries.length === 0) {
    return { show: false, campaignId, suggestedCountries: [] };
  }
  const camp = args.campaigns.find((c) => c.id === campaignId);
  const geoFromCamp = parseGeoList(camp?.geo_targets);
  const geoFromPayload = parseGeoList(p.geo_targets ?? p.geoTargets);
  const current = geoFromCamp.length ? geoFromCamp : geoFromPayload;

  const allowedSet = new Set(allowedCountries.map((c) => c.trim().toUpperCase()));
  const hasForbidden = current.some((g) => !allowedSet.has(String(g).trim().toUpperCase()));
  const suggested = intersectGeoWithAllowedList(current, allowedCountries);

  return {
    show: hasForbidden && suggested.length > 0,
    campaignId,
    suggestedCountries: suggested,
  };
}

function sortChangeRequests(rows: ChangeRequestRow[]): ChangeRequestRow[] {
  const rank = (s: string) => {
    if (s === "pending") return 0;
    if (s === "approved") return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const ChangeRequestCard = memo(function ChangeRequestCard({
  cr,
  projectId,
  overview,
  campaigns,
  reload,
  review,
  reviewBusyChangeRequestId,
}: {
  cr: ChangeRequestRow;
  projectId: string;
  overview: PaidOverviewDto | null;
  campaigns: CampaignRow[];
  reload: () => void;
  review: (id: string, status: "approved" | "rejected" | "applied") => void | Promise<void>;
  reviewBusyChangeRequestId: string | null;
}) {
  const title = changeRequestTypeLabel(cr.type);
  const { lines, guardrailMessages } = summarizeChangeRequestPayload(cr.payload);
  const busy = reviewBusyChangeRequestId === cr.id;
  const editCampaignId = changeRequestCampaignIdFromPayload(cr.payload ?? null);
  const errFriendly = friendlyGoogleAdsNetworkError(cr.error_message);
  const [snapBusy, setSnapBusy] = useState<null | "budget" | "geo">(null);

  const budgetSnap = useMemo(
    () => budgetSnapSuggestion({ payload: cr.payload ?? undefined, overview, campaigns }),
    [cr.payload, overview, campaigns],
  );

  const geoSnap = useMemo(
    () => geoSnapSuggestion({ payload: cr.payload ?? undefined, overview, campaigns }),
    [cr.payload, overview, campaigns],
  );

  const onSnapBudget = useCallback(async () => {
    if (!budgetSnap.campaignId || budgetSnap.suggestedMicros == null) return;
    setSnapBusy("budget");
    try {
      const { error, data } = await paidAdsService.snapCampaignDailyBudgetToGuardrail(
        projectId,
        budgetSnap.campaignId,
      );
      if (error) {
        toast.error(error);
        return;
      }
      if (data?.adjusted) {
        toast.success("Orçamento alinhado ao limite", {
          description: `Definido para ${formatUsdFromMicros(budgetSnap.suggestedMicros)} por dia (guardrails).`,
        });
      } else {
        toast.info("Orçamento já estava dentro do limite.");
      }
      reload();
    } finally {
      setSnapBusy(null);
    }
  }, [budgetSnap.campaignId, budgetSnap.suggestedMicros, projectId, reload]);

  const onSnapGeo = useCallback(async () => {
    if (!geoSnap.campaignId || geoSnap.suggestedCountries.length === 0) return;
    setSnapBusy("geo");
    try {
      const { error, data } = await paidAdsService.snapCampaignGeoTargetsToGuardrail(projectId, geoSnap.campaignId);
      if (error) {
        toast.error(error);
        return;
      }
      if (data?.adjusted) {
        toast.success("Países alinhados aos guardrails", {
          description: `Segmentação: ${geoSnap.suggestedCountries.join(", ")}.`,
        });
      } else {
        toast.info("A segmentação já coincidia com a lista permitida.");
      }
      reload();
    } finally {
      setSnapBusy(null);
    }
  }, [geoSnap.campaignId, geoSnap.suggestedCountries, projectId, reload]);

  return (
    <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold leading-snug">{title}</h3>
            <Badge variant="outline" className={cn("shrink-0", changeRequestStatusBadgeClass(cr.status))}>
              {changeRequestStatusLabel(cr.status)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Pedido · {new Date(cr.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
          </p>
          {editCampaignId ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary" className="h-8">
                <Link to={`/tracking/dpilot/p/${projectId}/campanhas?campaign=${editCampaignId}`}>
                  Editar campanha (rascunho)
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to={`/tracking/dpilot/p/${projectId}/visao`}>Limites e guardrails</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to={`/tracking/dpilot/p/${projectId}/campanhas`}>Abrir Campanhas</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to={`/tracking/dpilot/p/${projectId}/visao`}>Visão geral</Link>
              </Button>
            </div>
          )}
          {lines.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
              {lines.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`} className="marker:text-muted-foreground/70">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {guardrailMessages.length > 0 ? (
            <div className="space-y-2">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50">
                <p className="font-medium text-amber-950/90 dark:text-amber-50/95">Motivos da revisão (limites)</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {guardrailMessages.map((m, i) => (
                    <li key={`g-${i}-${m.slice(0, 32)}`}>{m}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {editCampaignId ? (
                  <>
                    O rascunho edita-se na lista de{" "}
                    <Link className="font-medium underline underline-offset-2" to={`/tracking/dpilot/p/${projectId}/campanhas?campaign=${editCampaignId}`}>
                      Campanhas
                    </Link>
                    {" "}
                    ou os limites em{" "}
                    <Link className="font-medium underline underline-offset-2" to={`/tracking/dpilot/p/${projectId}/visao`}>
                      Visão geral
                    </Link>
                    . Depois volte a «Aplicar na rede».
                  </>
                ) : (
                  <>
                    Abra a{" "}
                    <Link className="font-medium underline underline-offset-2" to={`/tracking/dpilot/p/${projectId}/campanhas`}>
                      campanha correspondente
                    </Link>{" "}
                    ou os{" "}
                    <Link className="font-medium underline underline-offset-2" to={`/tracking/dpilot/p/${projectId}/visao`}>
                      guardrails
                    </Link>{" "}
                    antes de publicar.
                  </>
                )}
              </p>
            </div>
          ) : null}
          {budgetSnap.show && budgetSnap.campaignId && budgetSnap.suggestedMicros != null ? (
            <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || snapBusy !== null}
                  className="shrink-0"
                  onClick={() => void onSnapBudget()}
                >
                  {snapBusy === "budget" ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                      A aplicar…
                    </>
                  ) : (
                    <>Alinhar orçamento ao teto configurado ({formatUsdFromMicros(budgetSnap.suggestedMicros)}/dia)</>
                  )}
                </Button>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Usa o <strong className="font-medium text-foreground">orçamento máximo diário</strong> que está em{" "}
                  <Link className="font-medium underline underline-offset-2" to={`/tracking/dpilot/p/${projectId}/visao`}>
                    Visão geral
                  </Link>{" "}
                  (guardrails neste workspace), não um valor mágico fixo na app — altere esse teto lá se precisar de outro limite antes de clicar aqui.
                </span>
              </div>
            </div>
          ) : null}
          {geoSnap.show && geoSnap.campaignId && geoSnap.suggestedCountries.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || snapBusy !== null}
                  className="shrink-0"
                  onClick={() => void onSnapGeo()}
                >
                  {snapBusy === "geo" ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                      A aplicar…
                    </>
                  ) : (
                    <>
                      Aplicar países sugeridos ({geoSnap.suggestedCountries.join(", ")})
                    </>
                  )}
                </Button>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Opcional — remove apenas geografias não permitidas; não publica na rede.
                </span>
              </div>
            </div>
          ) : null}
          {cr.error_message ? (
            <div className="space-y-1.5">
              {errFriendly ? (
                <>
                  <p className="text-xs leading-relaxed text-destructive">
                    <span className="font-medium">Erro na rede:</span> {errFriendly}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/90 whitespace-pre-wrap leading-snug border-l border-border pl-2">
                    {cr.error_message}
                  </p>
                </>
              ) : (
                <p className="text-xs text-destructive">
                  <span className="font-medium">Erro na rede:</span> {cr.error_message}
                </p>
              )}
              {!errFriendly && /invalid\s+argument|INVALID_ARGUMENT/i.test(cr.error_message) ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Sugestão: confirme em{" "}
                  <Link
                    className="font-medium underline underline-offset-2"
                    to={`/tracking/dpilot/p/${projectId}/ligacoes`}
                  >
                    Ligações às redes
                  </Link>
                  , orçamentos mínimos da rede e conta de faturação. Inclua a referência técnica abaixo ao contactar suporte.
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="font-mono text-[10px] text-muted-foreground/80">
            Ref. técnica: {cr.id}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              A processar…
            </span>
          ) : cr.status === "pending" ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() => {
                        void review(cr.id, "approved");
                      })
                    }
                  >
                    Aprovar
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="bottom">
                  Regista que aceita o plano no Clickora; ainda não publica na rede publicitária.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() => {
                        void review(cr.id, "rejected");
                      })
                    }
                  >
                    Rejeitar
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="bottom">
                  Fecha o pedido sem aplicar alterações na conta Google / Meta / TikTok.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() => {
                        void review(cr.id, "applied");
                      })
                    }
                  >
                    Aplicar na rede
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="bottom">
                  Envia este plano para a API da rede e tenta criar ou actualizar recursos na conta ligada.
                </TooltipContent>
              </Tooltip>
            </>
          ) : cr.status === "approved" ? (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() => {
                        void review(cr.id, "applied");
                      })
                    }
                  >
                    Aplicar na rede
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="bottom">
                  Publicação efectiva na conta — utilize quando já validou o plano apresentado acima.
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  startTransition(() => {
                    void review(cr.id, "rejected");
                  })
                }
              >
                Arquivar pedido
              </Button>
            </div>
          ) : cr.status === "failed" ? (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() => {
                        void review(cr.id, "applied");
                      })
                    }
                  >
                    Tentar «Aplicar na rede» de novo
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="bottom">
                  Depois de corrigir o rascunho (limites ou campanha), volte a enviar para a API da rede.
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  startTransition(() => {
                    void review(cr.id, "rejected");
                  })
                }
              >
                Arquivar pedido
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

ChangeRequestCard.displayName = "ChangeRequestCard";

export function DpilotAprovacoesPage() {
  const p = useDpilotPaid();
  const sorted = useMemo(() => sortChangeRequests(p.changeRequests), [p.changeRequests]);
  const { reviewBusyChangeRequestId, projectId, overview, campaigns, reload } = p;

  return (
    <Gate>
      <PageHeader
        title="Aprovações"
        description="Fila de pedidos gerados pelo assistente ou pelo autopilot quando um humano deve confirmar antes da rede aplicar alterações."
      />
      <Alert className="mt-4 border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" aria-hidden />
        <AlertTitle className="text-sm font-semibold">Fluxo recomendado</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Aprovar</strong> apenas confirma no Clickora que o plano está
          aceite. Para alterar de facto a conta Google Ads, Meta ou TikTok, utilize{" "}
          <strong className="font-medium text-foreground">Aplicar na rede</strong>. Quem gere permissões do workspace
          pode rever esta fila.
        </AlertDescription>
      </Alert>
      <Card className="mt-4">
        <CardContent className="pt-6">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nenhum pedido em fila. Quando criar uma campanha em modo Copilot, ou quando os limites de segurança
              exigirem revisão, os pedidos aparecem aqui com um resumo legível.
            </p>
          ) : (
            <div className="space-y-4">
              {sorted.map((cr) => (
                <ChangeRequestCard
                  key={cr.id}
                  cr={cr}
                  projectId={projectId}
                  overview={overview}
                  campaigns={campaigns}
                  reload={reload}
                  review={p.review}
                  reviewBusyChangeRequestId={reviewBusyChangeRequestId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

const MOTOR_PAGE_SIZE = 40;

export function DpilotAuditoriaPage() {
  const { projectId } = useDpilotPaid();
  const [motorRows, setMotorRows] = useState<OptimizerDecisionRow[]>([]);
  const [motorTotal, setMotorTotal] = useState(0);
  const [motorLoading, setMotorLoading] = useState(true);
  const [motorLoadingMore, setMotorLoadingMore] = useState(false);
  const [motorErr, setMotorErr] = useState<string | null>(null);

  const [aiRows, setAiRows] = useState<Record<string, unknown>[]>([]);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setMotorLoading(true);
    setMotorErr(null);
    setMotorRows([]);
    void paidAdsService.listOptimizerDecisions(projectId, { limit: MOTOR_PAGE_SIZE, offset: 0 }).then(({ data, error }) => {
      if (cancelled) return;
      setMotorLoading(false);
      if (data?.decisions && data.pagination) {
        setMotorRows(data.decisions);
        setMotorTotal(data.pagination.total);
      } else {
        setMotorErr(error ?? "Histórico do motor indisponível.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadMoreMotor = useCallback(() => {
    if (motorLoadingMore || motorRows.length >= motorTotal) return;
    setMotorLoadingMore(true);
    void paidAdsService
      .listOptimizerDecisions(projectId, { limit: MOTOR_PAGE_SIZE, offset: motorRows.length })
      .then(({ data, error }) => {
        setMotorLoadingMore(false);
        if (data?.decisions) {
          setMotorRows((prev) => [...prev, ...data.decisions]);
          setMotorTotal(data.pagination.total);
        } else if (error) {
          setMotorErr(error);
        }
      });
  }, [projectId, motorLoadingMore, motorRows.length, motorTotal]);

  useEffect(() => {
    let cancel = false;
    setAiLoading(true);
    void paidAdsService.listAiRuns(projectId).then(({ data, error }) => {
      if (cancel) return;
      setAiLoading(false);
      if (data?.ai_runs) setAiRows(data.ai_runs);
      else if (error) setAiRows([]);
    });
    return () => {
      cancel = true;
    };
  }, [projectId]);

  const motorHasMore = motorRows.length < motorTotal;

  return (
    <Gate>
      <PageHeader
        title="Auditoria & conformidade"
        description="Duas linhas de evidência: decisões automáticas do motor Autopilot (APIs de rede) e execuções do assistente IA neste projecto."
      />

      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" aria-hidden />
            Motor automático — decisões recentes
          </CardTitle>
          <CardDescription>
            Paginação offset/limit no servidor; cada linha corresponde a um evento persistido na base de dados com
            correlacionação opcional (<code className="text-[11px]">tick_id</code> no snapshot).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {motorLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          ) : motorErr ? (
            <p className="text-sm text-destructive">{motorErr}</p>
          ) : motorRows.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sem decisões registadas ainda. Quando o optimizer estiver activo no servidor (<code className="text-xs">
                PAID_OPTIMIZER_ENABLED=true
              </code>
              ), os eventos aparecem aqui com marca temporal e resultado da execução.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Quando</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="hidden md:table-cell">Rede</TableHead>
                      <TableHead className="hidden lg:table-cell">Decisão</TableHead>
                      <TableHead className="hidden xl:table-cell">Regra</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="hidden lg:table-cell max-w-[220px]">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {motorRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground tabular-nums">
                          {new Date(row.created_at).toLocaleString("pt-PT", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="font-medium">{row.campaign_name ?? "—"}</span>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground break-all">{row.campaign_id}</p>
                        </TableCell>
                        <TableCell className="hidden align-top text-sm md:table-cell">
                          {campaignPlatformLabel(row.platform)}
                        </TableCell>
                        <TableCell className="hidden align-top lg:table-cell">
                          <span className="text-sm">{optimizerDecisionTypeLabel(row.decision_type)}</span>
                        </TableCell>
                        <TableCell className="hidden align-top text-xs xl:table-cell">
                          {optimizerRuleCodeLabel(row.rule_code)}
                        </TableCell>
                        <TableCell className="align-top">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={optimizerExecutionBadgeClass({
                                  dry_run: row.dry_run,
                                  execution_ok: row.execution_ok,
                                })}
                              >
                                {optimizerExecutionSummary({
                                  dry_run: row.dry_run,
                                  execution_ok: row.execution_ok,
                                  executed: row.executed,
                                })}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-left text-xs" side="bottom">
                              <span className="font-medium">Execução:</span>{" "}
                              {row.executed ? "registada" : "pendente/incompleta"} · dry_run:{" "}
                              {row.dry_run ? "sim" : "não"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="hidden align-top lg:table-cell max-w-[220px]">
                          {row.execution_detail ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="cursor-help truncate text-xs text-muted-foreground">{row.execution_detail}</p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-lg text-left text-xs">
                                <pre className="whitespace-pre-wrap font-sans">{row.execution_detail}</pre>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                <span>
                  A mostrar <strong className="text-foreground">{motorRows.length}</strong> de{" "}
                  <strong className="text-foreground">{motorTotal}</strong> decisões neste projecto.
                </span>
                {motorHasMore ? (
                  <Button type="button" variant="outline" size="sm" disabled={motorLoadingMore} onClick={() => loadMoreMotor()}>
                    {motorLoadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                        A carregar…
                      </>
                    ) : (
                      "Carregar mais"
                    )}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Execuções de IA (assistente)</CardTitle>
          <CardDescription>Últimos pedidos ao modelo para gerar planos de campanha neste projecto.</CardDescription>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : aiRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos de IA para este projecto.</p>
          ) : (
            <ul className="space-y-2">
              {aiRows.map((r, i) => (
                <li key={i} className="rounded border border-border/60 bg-muted/20 p-3 text-xs font-mono">
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(r, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotEquipaPage() {
  return (
    <div>
      <PageHeader
        title="Equipa e permissões"
        description="Quem pode ver e gerir este projecto segue as permissões da sua conta Clickora (workspace)."
      />
      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            Convites e papéis são tratados na área{" "}
            <Button variant="link" className="h-auto p-0" asChild>
              <Link to="/conta">Conta</Link>
            </Button>
            — membros autorizados acedem aos mesmos projectos de anúncios conforme o seu nível de acesso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function DpilotLandingsPage() {
  return (
    <div>
      <PageHeader
        title="Páginas de destino"
        description="URLs e presells utilizadas nas campanhas são criadas e editadas no construtor principal do Clickora."
      />
      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <Button asChild>
            <Link to="/presell/dashboard">Abrir minhas presells / landings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
