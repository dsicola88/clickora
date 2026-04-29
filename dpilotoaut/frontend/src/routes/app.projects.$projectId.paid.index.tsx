import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Info,
  Loader2,
  Plug,
  Plus,
  Settings2,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { dollarsToMicros, formatMicrosUsd, microsToDollars } from "@/lib/format";
import {
  getPaidOverview,
  updateProjectPaidMode,
  upsertGuardrails,
} from "@/server/app-data.functions";
import { getRequestErrorMessage } from "@/lib/error-utils";
import { getGoogleAdsMetrics } from "@/server/paid-metrics.functions";
import {
  checkGoogleAdsOAuthAvailable,
  disconnectGoogleAdsConnection,
} from "@/server/google-oauth.functions";
import type { GoogleAdsConnectionRow, PaidGuardrailsRow, ProjectPaidMode } from "@/types/domain";
import { PageHeader } from "@/components/AppShell";
import { ClickoraFlowBar } from "@/components/ClickoraFlowBar";
import { useClickoraEmbed } from "@/hooks/useClickoraEmbed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
type Guardrails = PaidGuardrailsRow;
type Connection = GoogleAdsConnectionRow;
type ProjectMode = ProjectPaidMode;

export const Route = createFileRoute("/app/projects/$projectId/paid/")({
  component: PaidOverview,
});

const guardrailsSchema = z.object({
  maxDailyBudget: z.number().min(1).max(100000),
  maxMonthlySpend: z.number().min(1).max(10000000),
  maxCpc: z.number().min(0).max(1000).nullable(),
  allowedCountries: z.string().max(500),
  blockedKeywords: z.string().max(2000),
  requireApprovalAbove: z.number().min(0).max(100000).nullable(),
});

function PaidOverview() {
  const clickoraEmbed = useClickoraEmbed();
  const { projectId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ProjectMode>("copilot");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [guardrails, setGuardrails] = useState<Guardrails | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [googleMetrics, setGoogleMetrics] = useState<{
    state: "disconnected" | "ok" | "error";
    todayMicros: number | null;
    seriesUsd: { date: string; spendUsd: number }[] | null;
    message: string | null;
  } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadOverview = useServerFn(getPaidOverview);
  const saveMode = useServerFn(updateProjectPaidMode);
  const loadMetrics = useServerFn(getGoogleAdsMetrics);
  const checkGoogleOauth = useServerFn(checkGoogleAdsOAuthAvailable);
  const disconnectGoogle = useServerFn(disconnectGoogleAdsConnection);

  const refreshOverview = useCallback(async () => {
    const overview = await loadOverview({ data: { projectId } });
    setMode(overview.project.paid_mode);
    setConnection(overview.connection);
    setGuardrails(overview.guardrails);
    setPendingApprovals(overview.pendingApprovals);
  }, [loadOverview, projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshOverview();
      } catch (e) {
        if (!cancelled) {
          toast.error("Falha ao carregar dados", {
            description: getRequestErrorMessage(e),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshOverview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetricsLoading(true);
      setGoogleMetrics(null);
      try {
        const m = await loadMetrics({ data: { projectId } });
        if (!cancelled) setGoogleMetrics(m);
      } catch (e) {
        if (!cancelled) {
          setGoogleMetrics({
            state: "error",
            todayMicros: null,
            seriesUsd: null,
            message: getRequestErrorMessage(e),
          });
        }
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadMetrics, connection?.status, connection?.google_customer_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("google");
    if (p === "connected") {
      toast.success("Google Ads ligado com sucesso.");
      void refreshOverview();
    } else if (p === "error") {
      toast.error(
        "Não foi possível concluir a ligação Google Ads. Verifique o developer token e o redirect no Google Cloud.",
      );
      void refreshOverview();
    }
    if (p) {
      const u = new URL(window.location.href);
      u.searchParams.delete("google");
      window.history.replaceState({}, "", u.toString());
    }
  }, [pathname, refreshOverview]);

  const toggleMode = async () => {
    const next: ProjectMode = mode === "copilot" ? "autopilot" : "copilot";
    setMode(next);
    try {
      await saveMode({ data: { projectId, paidMode: next } });
      toast.success(
        `Modo alterado para ${next === "copilot" ? "Copilot" : "Autopilot (com guardrails)"}`,
      );
    } catch (e) {
      toast.error("Não foi possível alterar o modo", {
        description: e instanceof Error ? e.message : "Erro",
      });
      setMode(mode);
    }
  };

  return (
    <div className="pb-12">
      <PageHeader
        title={clickoraEmbed ? "Anúncios" : "Paid Autopilot"}
        description="Modo Copilot ou Autopilot, guardrails, Google/Meta/TikTok e fila de aprovações."
        badge={
          <Badge variant={mode === "autopilot" ? "soft" : "muted"}>
            {mode === "autopilot" ? "Autopilot · com guardrails" : "Copilot"}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/projects/$projectId/paid/approvals" params={{ projectId }}>
                Aprovações
                {pendingApprovals > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {pendingApprovals}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/projects/$projectId/paid/campaigns/new" params={{ projectId }}>
                <Plus className="mr-1 h-4 w-4" /> Nova campanha
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <ClickoraFlowBar />
        {/* Mode + connection cards */}
        <div className="grid gap-5 lg:grid-cols-3">
          <ModeCard mode={mode} onToggle={toggleMode} loading={loading} />
          <GoogleConnectionCard
            projectId={projectId}
            connection={connection}
            loading={loading}
            onRefresh={refreshOverview}
            checkOauth={checkGoogleOauth}
            onDisconnect={disconnectGoogle}
          />
          <SpendSummaryCard
            guardrails={guardrails}
            loading={loading}
            metricsLoading={metricsLoading}
            googleMetrics={googleMetrics}
          />
        </div>

        <SpendChartCard
          guardrails={guardrails}
          googleMetrics={googleMetrics}
          metricsLoading={metricsLoading}
        />

        {/* Guardrails editor */}
        <GuardrailsCard
          projectId={projectId}
          guardrails={guardrails}
          loading={loading}
          onSaved={(g) => setGuardrails(g)}
        />
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

function ModeCard({
  mode,
  onToggle,
  loading,
}: {
  mode: ProjectMode;
  onToggle: () => void;
  loading: boolean;
}) {
  const isAutopilot = mode === "autopilot";
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Modo de operação
            </p>
            <p className="font-semibold">
              {isAutopilot ? "Autopilot · com guardrails" : "Copilot"}
            </p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-10" />
        ) : (
          <Switch
            checked={isAutopilot}
            onCheckedChange={onToggle}
            aria-label="Alternar autopilot"
          />
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {isAutopilot
          ? "Dentro dos guardrails aplica logo; o resto vai para aprovações."
          : "A IA sugere alterações — publicação só após aprovação."}
      </p>
    </Card>
  );
}

function GoogleConnectionCard({
  projectId,
  connection,
  loading,
  onRefresh,
  checkOauth,
  onDisconnect,
}: {
  projectId: string;
  connection: Connection | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  checkOauth: ReturnType<typeof useServerFn<typeof checkGoogleAdsOAuthAvailable>>;
  onDisconnect: ReturnType<typeof useServerFn<typeof disconnectGoogleAdsConnection>>;
}) {
  const [oauthOk, setOauthOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await checkOauth();
        if (!c) setOauthOk(r.available);
      } catch {
        if (!c) setOauthOk(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [checkOauth]);

  const status = connection?.status ?? "disconnected";
  const isConnected = status === "connected";

  async function connect() {
    setBusy(true);
    try {
      window.location.href = `/hooks/google-oauth/start?projectId=${encodeURIComponent(projectId)}`;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desligar Google Ads deste projeto?")) return;
    setBusy(true);
    try {
      await onDisconnect({ data: { projectId } });
      toast.success("Conta Google Ads desligada.");
      await onRefresh();
    } catch (e) {
      toast.error(getRequestErrorMessage(e, "Falha ao desligar."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-56 w-full rounded-2xl" />;
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/15 text-info ring-1 ring-inset ring-info/30">
            <Plug className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Google Ads</p>
            <p className="font-semibold">{connection?.account_name ?? "Não conectado"}</p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Badge variant={isConnected ? "success" : status === "error" ? "destructive" : "muted"}>
            {isConnected ? "Conectado" : status === "error" ? "Erro" : "Desconectado"}
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {connection?.google_customer_id
          ? `ID de cliente: ${connection.google_customer_id}`
          : "Ligue Google Ads (OAuth + developer token) para métricas e publicação."}
      </p>
      {connection?.error_message && (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {connection.error_message}
        </p>
      )}
      {isConnected ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => void disconnect()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="mr-1 h-4 w-4" />
          )}
          Desligar
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-4 w-full"
          onClick={() => void connect()}
          disabled={busy || oauthOk === false}
          title={
            oauthOk === false
              ? "Defina GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN."
              : undefined
          }
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {oauthOk === false ? "Configurar credenciais" : "Ligar Google Ads"}
        </Button>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" />
        <span>
          <code className="rounded bg-muted px-1">GOOGLE_OAUTH_REDIRECT_URL</code> = redirect no
          Google Cloud.
        </span>
      </p>
    </Card>
  );
}

function SpendSummaryCard({
  guardrails,
  loading,
  metricsLoading,
  googleMetrics,
}: {
  guardrails: Guardrails | null;
  loading: boolean;
  metricsLoading: boolean;
  googleMetrics: {
    state: "disconnected" | "ok" | "error";
    todayMicros: number | null;
    message: string | null;
  } | null;
}) {
  const dailyCap = guardrails?.max_daily_budget_micros ?? 0;
  const spendToday =
    googleMetrics?.state === "ok" && googleMetrics.todayMicros != null
      ? googleMetrics.todayMicros
      : 0;
  const hasLive = googleMetrics?.state === "ok";
  const pct = hasLive && dailyCap > 0 ? Math.min(100, (spendToday / Number(dailyCap)) * 100) : 0;
  const overCap = pct >= 90;
  const label =
    !hasLive && (googleMetrics?.state === "disconnected" || !googleMetrics)
      ? "Gasto hoje (ligue o Google)"
      : googleMetrics?.state === "error"
        ? "Gasto hoje (erro API)"
        : "Gasto hoje (Google)";

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15 text-success ring-1 ring-inset ring-success/30">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading || metricsLoading ? (
              <Skeleton className="mt-1 h-7 w-24" />
            ) : (
              <p className="font-semibold">
                {hasLive
                  ? formatMicrosUsd(spendToday)
                  : googleMetrics?.state === "error"
                    ? "—"
                    : "—"}
              </p>
            )}
          </div>
        </div>
        {loading || metricsLoading ? (
          <Skeleton className="h-5 w-12" />
        ) : (
          <Badge variant={overCap && hasLive ? "warning" : "muted"}>
            {hasLive ? `${Math.round(pct)}%` : "—"}
          </Badge>
        )}
      </div>
      {googleMetrics?.message && (
        <p className="mt-2 text-xs text-destructive/90">{googleMetrics.message}</p>
      )}
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              overCap && hasLive ? "bg-warning" : "bg-gradient-primary"
            }`}
            style={{ width: hasLive ? `${pct}%` : "0%" }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Limite diário {formatMicrosUsd(dailyCap)} (referência para Autopilot).
        </p>
      </div>
    </Card>
  );
}

function SpendChartCard({
  guardrails,
  googleMetrics,
  metricsLoading,
}: {
  guardrails: Guardrails | null;
  googleMetrics: {
    state: "disconnected" | "ok" | "error";
    seriesUsd: { date: string; spendUsd: number }[] | null;
    message: string | null;
  } | null;
  metricsLoading: boolean;
}) {
  const capDollars = guardrails ? microsToDollars(guardrails.max_daily_budget_micros) : 50;
  const data = useMemo(() => {
    if (googleMetrics?.state === "ok" && googleMetrics.seriesUsd?.length) {
      return googleMetrics.seriesUsd.map((p) => ({
        date: p.date,
        spend: p.spendUsd,
        cap: capDollars,
      }));
    }
    return [];
  }, [googleMetrics, capDollars]);
  const isLive = googleMetrics?.state === "ok" && data.length > 0;
  const subtitle = metricsLoading
    ? "A carregar…"
    : isLive
      ? "Gasto diário (USD) na conta ligada — últimos 14 dias."
      : googleMetrics?.state === "error"
        ? (googleMetrics.message ?? "Erro na API: confira developer token e permissões.")
        : "Ligue Google Ads no cartão ao lado para ver o gasto real.";

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold">Gasto (últimos 14 dias)</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant={isLive ? "soft" : "muted"}>{isLive ? "Dados reais" : "Sem série"}</Badge>
      </div>
      {metricsLoading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          A carregar…
        </div>
      ) : !isLive ? (
        <div className="flex h-[240px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {googleMetrics?.state === "disconnected" || !googleMetrics
            ? "Ligue Google Ads para ver a série de gasto."
            : googleMetrics.state === "error"
              ? (googleMetrics.message ?? "Erro ao obter dados: token ou ID de cliente.")
              : "Sem gasto nestes 14 dias ou ainda a sincronizar."}
        </div>
      ) : (
        <div className="h-[260px] w-full px-2 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 285)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 285)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis
                dataKey="date"
                stroke="currentColor"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                stroke="currentColor"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.205 0.022 265)",
                  border: "1px solid oklch(1 0 0 / 8%)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "oklch(0.97 0.005 250)",
                }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Gasto"]}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="oklch(0.78 0.18 285)"
                strokeWidth={2}
                fill="url(#spendGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function GuardrailsCard({
  projectId,
  guardrails,
  loading,
  onSaved,
}: {
  projectId: string;
  guardrails: Guardrails | null;
  loading: boolean;
  onSaved: (g: Guardrails) => void;
}) {
  const saveGuardrails = useServerFn(upsertGuardrails);
  const [maxDaily, setMaxDaily] = useState("");
  const [maxMonthly, setMaxMonthly] = useState("");
  const [maxCpc, setMaxCpc] = useState("");
  const [countries, setCountries] = useState("");
  const [blocked, setBlocked] = useState("");
  const [approvalAbove, setApprovalAbove] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guardrails) return;
    setMaxDaily(microsToDollars(guardrails.max_daily_budget_micros).toString());
    setMaxMonthly(microsToDollars(guardrails.max_monthly_spend_micros).toString());
    setMaxCpc(
      guardrails.max_cpc_micros ? microsToDollars(guardrails.max_cpc_micros).toString() : "",
    );
    setCountries(guardrails.allowed_countries.join(", "));
    setBlocked(guardrails.blocked_keywords.join("\n"));
    setApprovalAbove(
      guardrails.require_approval_above_micros
        ? microsToDollars(guardrails.require_approval_above_micros).toString()
        : "",
    );
  }, [guardrails]);

  const onSave = async () => {
    setError(null);
    const parsed = guardrailsSchema.safeParse({
      maxDailyBudget: Number(maxDaily),
      maxMonthlySpend: Number(maxMonthly),
      maxCpc: maxCpc ? Number(maxCpc) : null,
      allowedCountries: countries,
      blockedKeywords: blocked,
      requireApprovalAbove: approvalAbove ? Number(approvalAbove) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const countriesArr = parsed.data.allowedCountries
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 50);
    const blockedArr = parsed.data.blockedKeywords
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);

    setSaving(true);
    try {
      const data = await saveGuardrails({
        data: {
          projectId,
          max_daily_budget_micros: dollarsToMicros(parsed.data.maxDailyBudget),
          max_monthly_spend_micros: dollarsToMicros(parsed.data.maxMonthlySpend),
          max_cpc_micros: parsed.data.maxCpc ? dollarsToMicros(parsed.data.maxCpc) : null,
          allowed_countries: countriesArr,
          blocked_keywords: blockedArr,
          require_approval_above_micros: parsed.data.requireApprovalAbove
            ? dollarsToMicros(parsed.data.requireApprovalAbove)
            : null,
        },
      });
      toast.success("Guardrails atualizados");
      onSaved(data);
    } catch (err) {
      toast.error("Não foi possível salvar os guardrails", {
        description: err instanceof Error ? err.message : "Erro",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning ring-1 ring-inset ring-warning/30">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Guardrails</p>
            <p className="text-xs text-muted-foreground">Limites aplicados antes de mudanças.</p>
          </div>
        </div>
        <TriangleAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orçamento diário máximo (USD)" hint="Por campanha e dia.">
            <Input
              type="number"
              min={1}
              step="0.01"
              value={maxDaily}
              onChange={(e) => setMaxDaily(e.target.value)}
            />
          </Field>
          <Field label="Gasto mensal máximo (USD)" hint="Teto global do projeto.">
            <Input
              type="number"
              min={1}
              step="0.01"
              value={maxMonthly}
              onChange={(e) => setMaxMonthly(e.target.value)}
            />
          </Field>
          <Field label="CPC máximo (USD, opcional)" hint="Teto de lance por palavra-chave.">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={maxCpc}
              onChange={(e) => setMaxCpc(e.target.value)}
              placeholder="ex.: 5.00"
            />
          </Field>
          <Field
            label="Limite para aprovação (USD, opcional)"
            hint="Acima disto — aprovação obrigatória (inclui Autopilot)."
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              value={approvalAbove}
              onChange={(e) => setApprovalAbove(e.target.value)}
              placeholder="ex.: 100.00"
            />
          </Field>
          <Field
            label="Países permitidos (ISO-2, separados por vírgula)"
            hint="Geo permitido apenas nestes códigos."
          >
            <Input
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="BR, PT, US"
            />
          </Field>
          <Field
            label="Palavras-chave bloqueadas (uma por linha)"
            hint="Filtradas nos planos gerados por IA."
            className="sm:col-span-2"
          >
            <Textarea
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              rows={4}
              placeholder={"marca concorrente\ndownload grátis"}
            />
          </Field>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={onSave} disabled={saving || loading}>
          {saving ? "Salvando…" : "Salvar guardrails"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
