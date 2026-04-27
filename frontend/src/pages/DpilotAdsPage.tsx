import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import {
  paidAdsService,
  type CampaignRow,
  type ChangeRequestRow,
  type OauthConfigDto,
  type PaidOverviewDto,
} from "@/services/paidAdsService";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DpilotAdsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = userCanAccessDpilotAds(user, isSuperAdmin);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<PaidOverviewDto | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [oauthConfig, setOauthConfig] = useState<OauthConfigDto | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const paramProject = searchParams.get("project");
  const validParamProject = paramProject && UUID_RE.test(paramProject) ? paramProject : null;

  const loadCore = useCallback(
    async (pid: string) => {
      const [ov, cfg, camps, crs] = await Promise.all([
        paidAdsService.getOverview(pid),
        paidAdsService.getOauthConfig(),
        paidAdsService.listCampaigns(pid),
        paidAdsService.listChangeRequests(pid),
      ]);
      if (ov.error || !ov.data) {
        setErr(ov.error || "Resumo indisponível.");
        setOverview(null);
      } else {
        setErr(null);
        setOverview(ov.data);
      }
      if (cfg.data) setOauthConfig(cfg.data);
      if (camps.data?.campaigns) setCampaigns(camps.data.campaigns as CampaignRow[]);
      if (crs.data?.change_requests) setChangeRequests(crs.data.change_requests as ChangeRequestRow[]);
    },
    [],
  );

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: list, error: e1 } = await paidAdsService.listProjects();
      if (cancelled) return;
      if (e1 || !list?.projects?.length) {
        setErr(e1 || "Ainda sem projecto de anúncios.");
        setLoading(false);
        return;
      }
      const chosen =
        validParamProject && list.projects.some((p) => p.id === validParamProject)
          ? validParamProject
          : list.projects[0].id;
      setProjectId(chosen);
      await loadCore(chosen);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, validParamProject, loadCore]);

  /** Toasts OAuth + recarrega ao voltar do redirect. */
  useEffect(() => {
    if (!projectId || loading) return;
    const g = searchParams.get("google");
    const m = searchParams.get("meta");
    const t = searchParams.get("tiktok");
    if (g === "connected") toast.success("Google Ads ligado com sucesso.");
    if (g === "error") toast.error("Não foi possível concluir o Google Ads OAuth.");
    if (m === "connected") toast.success("Meta Ads ligado com sucesso.");
    if (m === "error") toast.error("Não foi possível concluir o Meta OAuth.");
    if (t === "connected") toast.success("TikTok Ads ligado com sucesso.");
    if (t === "error") toast.error("Não foi possível concluir o TikTok OAuth.");
    if (g || m || t) {
      const next = new URLSearchParams(searchParams);
      next.delete("google");
      next.delete("meta");
      next.delete("tiktok");
      setSearchParams(next, { replace: true });
      void loadCore(projectId);
    }
  }, [projectId, loading, searchParams, setSearchParams, loadCore]);

  const startOAuth = async (kind: "google" | "meta" | "tiktok") => {
    if (!projectId) return;
    setConnecting(kind);
    try {
      const fn =
        kind === "google"
          ? paidAdsService.googleOAuthStart
          : kind === "meta"
            ? paidAdsService.metaOAuthStart
            : paidAdsService.tiktokOAuthStart;
      const { data, error } = await fn(projectId);
      if (error || !data?.url) {
        toast.error(error || "Não foi possível iniciar OAuth.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (kind: "google" | "meta" | "tiktok") => {
    if (!projectId) return;
    const fn =
      kind === "google"
        ? paidAdsService.disconnectGoogle
        : kind === "meta"
          ? paidAdsService.disconnectMeta
          : paidAdsService.disconnectTiktok;
    const { error } = await fn(projectId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Ligação removida.");
    void loadCore(projectId);
  };

  const review = async (id: string, status: "approved" | "rejected" | "applied") => {
    const { error } = await paidAdsService.reviewChangeRequest({ id, status });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(status === "applied" ? "Pedido aplicado." : "Atualizado.");
    if (projectId) void loadCore(projectId);
  };

  const googleConn = overview?.connection as { status?: string; account_name?: string | null } | undefined;
  const gr = overview?.guardrails as { max_daily_budget_micros?: number } | undefined;
  const metaAvailable = oauthConfig?.meta?.available;
  const tikAvailable = oauthConfig?.tiktok?.available;
  const googleAvailable = oauthConfig?.google?.available;

  const pendingList = useMemo(
    () => changeRequests.filter((c) => c.status === "pending"),
    [changeRequests],
  );

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <PageHeader
          title="Anúncios"
          description="Campanhas com revisão humana (Google, Meta, TikTok). Incluído no plano Premium."
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plano Pro</CardTitle>
            <CardDescription>
              O seu plano inclui presells e rastreamento. Para desbloquear anúncios, faça upgrade para Premium.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/planos">Ver planos e fazer upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-muted-foreground">A carregar módulo de anúncios…</p>
      </div>
    );
  }

  if (err || !overview) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <PageHeader title="Anúncios" description="Google Ads, Meta e TikTok no painel dclickora." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{err || "Dados em falta."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Anúncios"
        description="Liga as contas (OAuth), vê rascunhos e aprova pedidos. Callbacks: API em /api/paid/oauth/*/callback; regista os mesmos URLs no Google, Meta e TikTok."
      />

      {projectId && (
        <p className="text-xs text-muted-foreground">
          Projecto: <code className="rounded bg-muted px-1 py-0.5">{projectId}</code>
        </p>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="connections">Ligações</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="approvals">
            Aprovações
            {pendingList.length > 0 ? (
              <Badge variant="secondary" className="ml-1.5">
                {pendingList.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modo de trabalho</CardTitle>
                <CardDescription>Copiloto / autopiloto</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold capitalize">
                  {overview.project.paid_mode.replace(/_/g, " ")}
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
                  {googleConn?.status === "connected" ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Ligado</span>
                  ) : (
                    <span className="text-muted-foreground">Não ligado</span>
                  )}
                  {googleConn?.account_name ? ` — ${googleConn.account_name}` : null}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guardrails</CardTitle>
                <CardDescription>Orçamento diário máx. (micros)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm">{gr?.max_daily_budget_micros ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aprovações pendentes</CardTitle>
                <CardDescription>Pedidos de alteração</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{overview.pending_approvals}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Google Ads</CardTitle>
                <CardDescription>
                  {googleAvailable ? "Disponível no servidor" : "Configure credenciais na API (OAuth + developer token)."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={!projectId || !googleAvailable || connecting === "google"}
                  onClick={() => void startOAuth("google")}
                >
                  {connecting === "google" ? "A redirecionar…" : "Ligar Google"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!projectId || googleConn?.status !== "connected"}
                  onClick={() => void disconnect("google")}
                >
                  Desligar
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meta</CardTitle>
                <CardDescription>
                  {metaAvailable ? "App configurado" : "Defina META_APP_ID e META_APP_SECRET na API."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={!projectId || !metaAvailable || connecting === "meta"}
                  onClick={() => void startOAuth("meta")}
                >
                  {connecting === "meta" ? "A redirecionar…" : "Ligar Meta"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void disconnect("meta")}>
                  Desligar
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">TikTok</CardTitle>
                <CardDescription>
                  {tikAvailable ? "App configurado" : "Defina TIKTOK_APP_ID na API."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={!projectId || !tikAvailable || connecting === "tiktok"}
                  onClick={() => void startOAuth("tiktok")}
                >
                  {connecting === "tiktok" ? "A redirecionar…" : "Ligar TikTok"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void disconnect("tiktok")}>
                  Desligar
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campanhas (rascunhos e publicadas)</CardTitle>
              <CardDescription>Lista do projecto corrente</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem campanhas. Crie rascunhos no editor (API).</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.platform}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pedidos de alteração</CardTitle>
              <CardDescription>Administradores do workspace: aprovar, rejeitar ou aplicar (APIs remotas)</CardDescription>
            </CardHeader>
            <CardContent>
              {changeRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
              ) : (
                <div className="space-y-4">
                  {changeRequests.map((cr) => (
                    <div
                      key={cr.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {cr.type} — <Badge variant="secondary">{cr.status}</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cr.created_at).toLocaleString("pt-PT")} — {cr.id.slice(0, 8)}…
                        </p>
                        {cr.error_message ? (
                          <p className="text-xs text-destructive mt-1">{cr.error_message}</p>
                        ) : null}
                      </div>
                      {cr.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => void review(cr.id, "approved")}>
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void review(cr.id, "rejected")}
                          >
                            Rejeitar
                          </Button>
                          <Button type="button" size="sm" onClick={() => void review(cr.id, "applied")}>
                            Aplicar já
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
