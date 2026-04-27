import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DpilotPaidOauthGrid } from "./DpilotPaidOauthGrid";

export function Gate({ children }: { children: React.ReactNode }) {
  const { loading, err, overview } = useDpilotPaid();
  if (loading) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>;
  }
  if (err || !overview?.project) {
    return <p className="text-sm text-destructive">{err || "Dados do projecto em falta. Tente recarregar."}</p>;
  }
  return <>{children}</>;
}

export function DpilotVisaoPage() {
  const p = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Visão geral"
        description="Resumo do projecto, modo de trabalho e ligações. Callbacks: /api/paid/oauth/*/callback."
      />
      {p.overview && (
        <p className="text-xs text-muted-foreground">
          Projecto: <code className="rounded bg-muted px-1 py-0.5">{p.projectId}</code>
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de trabalho</CardTitle>
            <CardDescription>Copiloto / autopiloto</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold capitalize">
              {p.overview?.project.paid_mode?.replace(/_/g, " ") ?? "—"}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guardrails</CardTitle>
            <CardDescription>Orçamento diário máx. (micros)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm">
              {(p.overview?.guardrails as { max_daily_budget_micros?: number })?.max_daily_budget_micros ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprovações pendentes</CardTitle>
            <CardDescription>Pedidos de alteração</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{p.overview?.pending_approvals ?? "—"}</p>
          </CardContent>
        </Card>
      </div>
    </Gate>
  );
}

export function DpilotLigacoesPage() {
  return (
    <Gate>
      <PageHeader
        title="Ligações (OAuth)"
        description="Cada rede é independente. Meta e TikTok exigem variáveis no servidor (Railway)."
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Cada rede é uma ligação OAuth separada. &quot;Ligar&quot; abre a página do fornecedor; se já estiveres ligado, podes
        reautenticar ou desligar.
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

function campaignsTable(
  list: { id: string; name: string; platform: string; status: string }[],
  empty: string,
) {
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Plataforma</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((c) => (
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
  );
}

export function DpilotCampanhasPage() {
  const { campaigns, projectId } = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Campanhas"
        description="Rascunhos e publicadas do projecto (todas as plataformas)."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha (Google)</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {campaignsTable(
            campaigns,
            "Ainda sem campanhas. Comece por «Google · nova campanha» (assistente) e acompanhe as aprovações; rascunhos também podem surgir via fluxo interno da API.",
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotMetaCampanhasPage() {
  const { campaigns, projectId } = useDpilotPaid();
  const list = campaigns.filter((c) => c.platform === "meta_ads");
  return (
    <Gate>
      <PageHeader
        title="Meta · campanhas"
        description="Apenas campanhas de plataforma meta_ads."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/meta/nova`}>Nova campanha Meta</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {campaignsTable(
            list,
            "Sem campanhas Meta. Comece por «Meta · nova campanha» (assistente) ou ligue a conta em OAuth, depois aprove pedidos; ver documentação em docs/DPILOT-PARITY.md.",
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotTiktokCampanhasPage() {
  const { campaigns, projectId } = useDpilotPaid();
  const list = campaigns.filter((c) => c.platform === "tiktok_ads");
  return (
    <Gate>
      <PageHeader
        title="TikTok · campanhas"
        description="Apenas campanhas tiktok_ads."
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/tiktok/nova`}>Nova campanha TikTok</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {campaignsTable(list, "Sem campanhas TikTok ainda.")}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotAprovacoesPage() {
  const p = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Aprovações"
        description="Pedidos pendentes e histórico (admin/owner do workspace aplica ações remotas)."
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {p.changeRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
          ) : (
            <div className="space-y-4">
              {p.changeRequests.map((cr) => (
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
                    {cr.error_message ? <p className="text-xs text-destructive mt-1">{cr.error_message}</p> : null}
                  </div>
                  {cr.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void p.review(cr.id, "approved")}>
                        Aprovar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void p.review(cr.id, "rejected")}>
                        Rejeitar
                      </Button>
                      <Button type="button" size="sm" onClick={() => void p.review(cr.id, "applied")}>
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
    </Gate>
  );
}

export function DpilotAuditoriaPage() {
  const { projectId } = useDpilotPaid();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await paidAdsService.listAiRuns(projectId);
      if (!cancel) {
        if (data?.ai_runs) setRows(data.ai_runs);
        else if (error) setRows([]);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [projectId]);
  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Últimas execuções de IA (runs) no projecto — até 50."
      />
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">A carregar…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Sem registos de auditoria.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="rounded border border-border/60 p-3 text-xs font-mono">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(r, null, 0)}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DpilotEquipaPage() {
  return (
    <div>
      <PageHeader
        title="Equipa do workspace"
        description="No dclickora, acesso a este projecto segue o workspace (dono Faturação + membros). O Autopilot em iframe usava convites de organização — aqui reutilizas a Conta/permisos do Clickora."
      />
      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Ajusta o teu perfil e membros do workspace noutro ecrã:{" "}
            <Button variant="link" className="h-auto p-0" asChild>
              <Link to="/conta">Conta</Link>
            </Button>{" "}
            (e, quando activo, integrações/convites nessa área).
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
        title="Páginas de venda"
        description="O Autopilot em TanStack Start tinha landings de projecto. No dclickora, as presells/landings vivem em &quot;Minha presell&quot; (mesmo monólito) — reutilizamos o builder principal."
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
