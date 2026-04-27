import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, CreditCard, Loader2, UserPlus, Users } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { getPlatformAdminDashboard } from "@/server/platform-admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

function formatBrlCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (y == null || m == null || d == null) return ymd;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const load = useServerFn(getPlatformAdminDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPlatformAdminDashboard>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await load();
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar o painel.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    if (authLoading || !user?.isPlatformAdmin) return;
    void refresh();
  }, [user, authLoading, refresh]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {err && !data && (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">A carregar métricas…</span>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Utilizadores"
              value={String(data.totals.users)}
              hint="Contas na aplicação"
              icon={Users}
            />
            <StatCard
              title="Workspaces"
              value={String(data.totals.organizations)}
              hint="Organizações (tenants B2B)"
              icon={Building2}
            />
            <StatCard
              title="Receita 30d"
              value={formatBrlCents(data.totals.revenue30dCents)}
              hint={`Total histórico: ${formatBrlCents(data.totals.revenueAllTimeCents)}`}
              icon={CreditCard}
            />
            <StatCard
              title="Compras (30d) / alinhados"
              value={`${data.totals.payments30d} / ${data.totals.appAccountsWithPurchase}`}
              hint="Eventos Hotmart 30d · contas de app com compra"
              icon={UserPlus}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads (registos) — 30 dias</CardTitle>
                <CardDescription>Novas contas criadas na aplicação por dia.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pl-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.series.signups}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={dayLabel}
                      interval="preserveStartEnd"
                    />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                      labelFormatter={(label) =>
                        typeof label === "string" ? dayLabel(label) : String(label)
                      }
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      name="Registos"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receita (centavos) — 30 dias</CardTitle>
                <CardDescription>Soma dos valores de eventos de compra (webhook) por dia.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pl-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.series.revenue}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={dayLabel}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      width={48}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `R$ ${(v / 1_000_000).toFixed(0)}M`
                          : `R$ ${(v / 100).toFixed(0)}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                      labelFormatter={(label) =>
                        typeof label === "string" ? dayLabel(label) : String(label)
                      }
                      formatter={(v) => [
                        formatBrlCents(typeof v === "number" ? v : Number(v)),
                        "Receita",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenueCents"
                      name="Receita"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assinantes (visão e-mail)</CardTitle>
                <CardDescription>Compradores distintos com e-mail no histórico de webhooks</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data.totals.uniqueBuyerEmails}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projectos</CardTitle>
                <CardDescription>Projectos de paid media em todos os workspaces</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data.totals.projects}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos de pagamento recentes</CardTitle>
              <CardDescription>Últimas linhas ligadas a Hotmart (e futuras integrações).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Conta app</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        Ainda sem eventos. Configure o postback Hotmart em /hooks/hotmart/webhook
                      </TableCell>
                    </TableRow>
                  )}
                  {data.recentPayments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">{row.eventType}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">
                        {row.buyerEmail ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {row.productName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.priceCents != null ? formatBrlCents(row.priceCents) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.appUserId ? "Sim" : "Não"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Webhook:{" "}
            <code className="rounded bg-muted px-1 py-0.5">POST /hooks/hotmart/webhook?hottok=…</code> (mesmo
            token que <code className="rounded bg-muted px-1">HOTMART_WEBHOOK_HOTTOK</code> no servidor).
          </p>
        </>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
