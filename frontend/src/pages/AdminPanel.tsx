import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminService } from "@/services/adminService";
import { brandingService } from "@/services/brandingService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  FileText,
  BarChart3,
  ShieldAlert,
  Search,
  Ban,
  CheckCircle,
  ImageIcon,
  Trash2,
  Upload,
  TrendingUp,
  MousePointerClick,
  CalendarClock,
  CreditCard,
  Sparkles,
  Calendar,
  KeyRound,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { useRef, useState } from "react";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { SubscriptionDatesDialog } from "@/components/admin/SubscriptionDatesDialog";
import { AdminPasswordDialog } from "@/components/admin/AdminPasswordDialog";
import { PlanEditorCard } from "@/components/admin/PlanEditorCard";
import { PlansLandingEditor } from "@/components/admin/PlansLandingEditor";
import type { AdminUser } from "@/types/api";

const PUBLIC_BRANDING_KEY = ["public-branding"] as const;

const ADMIN_TABS_SUPER = ["overview", "users", "plans", "brand"] as const;
const ADMIN_TABS_BASIC = ["overview", "users", "plans"] as const;

function normalizeAdminTab(tab: string | null, isSuperAdmin: boolean): string {
  const allowed = isSuperAdmin ? ADMIN_TABS_SUPER : ADMIN_TABS_BASIC;
  if (tab && (allowed as readonly string[]).includes(tab)) return tab;
  return "overview";
}

function formatMoneyCents(cents: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function roleBadge(role: string) {
  if (role === "super_admin") return { label: "Super admin", className: "bg-violet-600 hover:bg-violet-600 text-white" };
  if (role === "admin") return { label: "Admin", className: "bg-primary/90 hover:bg-primary/90 text-primary-foreground" };
  if (role === "moderator") return { label: "Moderador", className: "bg-amber-600/90 hover:bg-amber-600/90 text-white" };
  return { label: "Utilizador", className: "" };
}

export default function AdminPanel() {
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeAdminTab(searchParams.get("tab"), isSuperAdmin);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [subscriptionUser, setSubscriptionUser] = useState<AdminUser | null>(null);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await adminService.getAllUsers();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await adminService.getOverview();
      if (error) throw new Error(error);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
    enabled: isAdmin,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await adminService.getPlans();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: plansLandingForEditors } = useQuery({
    queryKey: ["admin-plans-landing"],
    queryFn: async () => {
      const { data, error } = await adminService.getPlansLanding();
      if (error) throw new Error(error);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
    enabled: isAdmin && isSuperAdmin && activeTab === "plans",
  });

  const { data: brandingMeta } = useQuery({
    queryKey: PUBLIC_BRANDING_KEY,
    queryFn: () => brandingService.getPublicMeta(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: (file: File) => adminService.uploadFavicon(file),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Favicon publicado. O separador do browser atualiza em segundos.");
      queryClient.invalidateQueries({ queryKey: PUBLIC_BRANDING_KEY });
      window.dispatchEvent(new CustomEvent("clickora:branding"));
    },
  });

  const clearFaviconMutation = useMutation({
    mutationFn: () => adminService.clearFavicon(),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Favicon personalizado removido.");
      queryClient.invalidateQueries({ queryKey: PUBLIC_BRANDING_KEY });
      window.dispatchEvent(new CustomEvent("clickora:branding"));
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, isSuspended }: { userId: string; isSuspended: boolean }) => {
      return isSuspended ? adminService.reactivateUser(userId) : adminService.suspendUser(userId);
    },
    onSuccess: (_, { isSuspended }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(isSuspended ? "Utilizador reativado" : "Utilizador suspenso");
    },
    onError: () => toast.error("Erro ao atualizar estado"),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ userId, planType }: { userId: string; planType: string }) => adminService.updateUserPlan(userId, planType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Plano atualizado");
    },
    onError: () => toast.error("Erro ao alterar plano"),
  });

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    queryClient.invalidateQueries({ queryKey: ["admin-plans-landing"] });
  };

  const canAdminResetPassword = (u: AdminUser) =>
    isSuperAdmin || (u.role !== "super_admin" && u.role !== "admin");

  if (authLoading) return <LoadingState />;
  if (!isAdmin) {
    navigate("/plans");
    return null;
  }
  if (isLoading) return <LoadingState message="A carregar administradores…" />;
  if (isError) return <ErrorState message="Erro ao carregar dados do admin." onRetry={() => refetch()} />;

  const filtered = users.filter(
    (u) => u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const chartSignups =
    overview?.signups_by_day.map((d) => ({
      label: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      registos: d.count,
    })) ?? [];

  const chartLeads =
    overview?.conversions_by_day.map((d) => ({
      label: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      conversoes: d.count,
    })) ?? [];

  return (
    <div className={cn(APP_PAGE_SHELL)}>
      <SubscriptionDatesDialog
        user={subscriptionUser}
        open={subscriptionUser !== null}
        onOpenChange={(o) => {
          if (!o) setSubscriptionUser(null);
        }}
        saving={subscriptionSaving}
        onSave={async (payload) => {
          if (!subscriptionUser) return;
          setSubscriptionSaving(true);
          try {
            const { error } = await adminService.updateUserSubscription(subscriptionUser.user_id, payload);
            if (error) throw new Error(error);
            toast.success("Datas da assinatura guardadas");
            invalidateAdmin();
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao guardar");
            throw e;
          } finally {
            setSubscriptionSaving(false);
          }
        }}
      />
      <AdminPasswordDialog
        user={passwordUser}
        open={passwordUser !== null}
        onOpenChange={(o) => {
          if (!o) setPasswordUser(null);
        }}
        saving={passwordSaving}
        onSave={async (newPassword) => {
          if (!passwordUser) return;
          setPasswordSaving(true);
          try {
            const { error } = await adminService.setUserPassword(passwordUser.user_id, newPassword);
            if (error) throw new Error(error);
            toast.success("Senha redefinida");
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao redefinir senha");
            throw e;
          } finally {
            setPasswordSaving(false);
          }
        }}
      />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            Painel do sistema
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão global, assinantes, planos e personalização — {isSuperAdmin ? "super administrador" : "administrador"}.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (v === "overview") next.delete("tab");
            else next.set("tab", v);
            return next;
          });
        }}
        className="space-y-6"
      >
        <TabsList
          className={cn(
            "grid w-full max-w-3xl gap-1 bg-muted/60 p-1 h-auto",
            isSuperAdmin ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          <TabsTrigger value="overview" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" />
            Assinantes
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Planos
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="brand" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              Marca
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {overviewLoading || !overview ? (
            <LoadingState message="A carregar métricas…" />
          ) : (
            <>
              {overview.subscriptions_expiring_14d > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <CalendarClock className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                  <p className="text-foreground/90">
                    <strong>{overview.subscriptions_expiring_14d}</strong> assinatura(s) ativa(s) com data de fim nos próximos 14 dias.
                    Confirme em <span className="font-medium">Assinantes</span> (coluna &quot;Fim / expiração&quot;).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                  { icon: Users, label: "Utilizadores", value: overview.total_users, sub: "contas" },
                  { icon: CheckCircle, label: "Assinaturas ativas", value: overview.active_users, sub: "subscrições" },
                  { icon: FileText, label: "Presells", value: overview.total_presells, sub: "páginas" },
                  { icon: BarChart3, label: "Eventos", value: overview.total_events, sub: "tracking" },
                  { icon: MousePointerClick, label: "Conversões (leads)", value: overview.total_conversions, sub: "total" },
                  { icon: TrendingUp, label: "A expirar (14d)", value: overview.subscriptions_expiring_14d, sub: "ativas" },
                ].map((k) => (
                  <Card key={k.label} className="border-border/80 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                        <k.icon className="h-3.5 w-3.5" />
                        {k.label}
                      </div>
                      <p className="text-2xl font-bold tabular-nums text-foreground">{k.value.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {isAdmin && (
                <Card className="border-border/80 border-violet-500/25 bg-violet-500/[0.06]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bell className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />
                      Alertas no telemóvel quando há uma venda
                    </CardTitle>
                    <CardDescription>
                      {isSuperAdmin
                        ? "Isto é feito uma vez no servidor. Depois, cada assinante só precisa de tocar em Ativar no site — no telemóvel não há app nem definições do sistema a configurar."
                        : "A parte inicial é feita por quem gere o servidor (super administrador). Depois o assinante usa só o menu Integrações no site; no telemóvel não instala nada nem configura o aparelho."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-3">
                    {isSuperAdmin ? (
                      <>
                        <p className="text-foreground/90">
                          Como <strong className="font-medium text-foreground">super administrador</strong>, o que precisa de saber
                          é: o sistema precisa de duas &quot;chaves&quot; guardadas no sítio onde corre a API (Railway ou similar),
                          igual a quando se colocam outras palavras-passe de serviço. Sem isso, o botão nas Integrações não consegue
                          enviar notificações — com isso, funciona para toda a plataforma.
                        </p>
                        <ol className="list-decimal pl-5 space-y-2.5 marker:text-foreground/70 text-foreground/85">
                          <li>
                            <strong className="font-medium text-foreground">Atualizar a base de dados</strong> no próximo arranque
                            da API (o mesmo processo que já usam quando há alterações à base — deploy normal).
                          </li>
                          <li>
                            <strong className="font-medium text-foreground">Obter o par de chaves</strong> — a equipa técnica gera
                            dois textos longos (público e privado). O privado é secreto, como uma palavra-passe.
                          </li>
                          <li>
                            <strong className="font-medium text-foreground">Colar no painel do servidor</strong> da API, nas
                            variáveis com nomes que a documentação do projecto indica (chaves público/privado e um e-mail de
                            contacto em formato mailto).
                          </li>
                          <li>
                            <strong className="font-medium text-foreground">Publicar de novo</strong> a API e confirmar que está
                            tudo a correr sem avisos sobre estas chaves em falta.
                          </li>
                          <li>
                            <strong className="font-medium text-foreground">Assinantes</strong>: em{" "}
                            <span className="font-medium text-foreground">Tracking → Integrações</span> tocam em Ativar no
                            browser (telefone ou PC). Não precisam de instalar app nem de ir às definições do telemóvel — só ao
                            site.
                          </li>
                        </ol>
                        <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 space-y-2 text-xs leading-relaxed">
                          <p>
                            <strong className="text-foreground/90">Privacidade entre contas:</strong> cada utilizador só recebe
                            alertas das suas próprias vendas. Uma conta nunca vê notificações de outra.
                          </p>
                          <p>
                            <strong className="text-foreground/90">Cuidado:</strong> não partilhe a chave privada nem a coloque no
                            site visível ao público. O site em produção deve abrir em HTTPS (cadeado no browser).
                          </p>
                          <p className="text-muted-foreground/90 pt-1 border-t border-border/50">
                            <span className="font-medium text-foreground/80">Detalhe para quem usa terminal:</span> gerar chaves com{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">npx web-push generate-vapid-keys</code> e
                            copiar para as variáveis de ambiente da API (nomes no ficheiro{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env.example</code> do backend).
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2.5 text-foreground/85">
                        <p>
                          <strong className="font-medium text-foreground">O que é isto?</strong> Permite que um afiliado receba um
                          aviso no telemóvel ou no computador quando regista uma venda, sem abrir o Telegram.
                        </p>
                        <p>
                          <strong className="font-medium text-foreground">O seu papel:</strong> não precisa de configurar nada técnico
                          aqui. Quem trata do servidor (super administrador ou alguém da infra) faz a configuração inicial uma vez.
                        </p>
                        <p>
                          <strong className="font-medium text-foreground">Depois:</strong> cada assinante entra no site,{" "}
                          <span className="font-medium text-foreground">Tracking → Integrações</span>, e toca em Ativar. No
                          telemóvel não configura o aparelho — só o browser quando pedir permissão.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Novos registos (30 dias)</CardTitle>
                    <CardDescription>Contas criadas por dia na plataforma</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartSignups} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="admReg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                        <Area type="monotone" dataKey="registos" stroke="hsl(var(--primary))" fill="url(#admReg)" strokeWidth={2} name="Registos" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Conversões / leads (30 dias)</CardTitle>
                    <CardDescription>Vendas aprovadas registadas por dia</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartLeads} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="admLead" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="conversoes"
                          stroke="hsl(142 76% 36%)"
                          fill="url(#admLead)"
                          strokeWidth={2}
                          name="Conversões"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-6">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por e-mail ou nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="whitespace-nowrap">Início assin.</TableHead>
                  <TableHead className="whitespace-nowrap">Fim / expiração</TableHead>
                  <TableHead className="text-right">Presells</TableHead>
                  <TableHead className="text-right">Eventos</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="whitespace-nowrap">Alterar plano</TableHead>
                  <TableHead className="w-12 text-center">Datas</TableHead>
                  <TableHead className="w-12 text-center" title="Redefinir senha">
                    Senha
                  </TableHead>
                  <TableHead className="w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const rb = roleBadge(u.role);
                  const ends = u.sub_ends_at ? new Date(u.sub_ends_at) : null;
                  const expired =
                    u.ends_at_passed === true || (u.ends_at_passed === undefined && Boolean(ends && ends < new Date()));
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Conta: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", rb.className)} variant={rb.className ? "default" : "secondary"}>
                          {rb.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.plan_type === "free_trial" ? "secondary" : "default"}>{u.plan_name || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.sub_status === "active" ? "default" : "destructive"}>{u.sub_status || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {u.sub_starts_at ? new Date(u.sub_starts_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {!u.sub_ends_at ? (
                          <span className="text-muted-foreground">Sem data fim</span>
                        ) : (
                          <span className={cn(expired && "text-destructive font-medium")}>
                            {ends!.toLocaleDateString("pt-BR")}
                            {expired ? " · expirado" : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.pages_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.events_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.conversions_count?.toLocaleString() ?? "0"}</TableCell>
                      <TableCell>
                        <Select
                          value={u.plan_type ?? ""}
                          onValueChange={(planType) => updatePlanMutation.mutate({ userId: u.user_id, planType })}
                          disabled={updatePlanMutation.isPending}
                        >
                          <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue placeholder="Plano" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((p) => (
                              <SelectItem key={p.id} value={p.type} className="text-xs">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar datas da assinatura"
                          onClick={() => setSubscriptionUser(u)}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title={
                            canAdminResetPassword(u)
                              ? "Redefinir senha do utilizador"
                              : "Apenas o super administrador pode alterar esta senha"
                          }
                          disabled={!canAdminResetPassword(u)}
                          onClick={() => setPasswordUser(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={suspendMutation.isPending}
                          onClick={() => suspendMutation.mutate({ userId: u.user_id, isSuspended: u.sub_status === "suspended" })}
                          title={u.sub_status === "suspended" ? "Reativar" : "Suspender"}
                        >
                          {u.sub_status === "suspended" ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <Ban className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                      Nenhum utilizador encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-6">
          {isSuperAdmin ? (
            <>
              <PlansLandingEditor onInvalidateAdmin={invalidateAdmin} />
              <p className="text-sm text-muted-foreground max-w-2xl">
                Como super administrador pode alterar preços e limites em tempo real. As alterações aplicam-se a novas faturações e à verificação de
                limites dos utilizadores.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {plans.map((p) => (
                  <PlanEditorCard
                    key={p.id}
                    plan={p}
                    onSaved={invalidateAdmin}
                    priceLabels={plansLandingForEditors?.plan_display_labels}
                  />
                ))}
              </div>
              {plans.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Sem planos na base de dados</p>
              )}
            </>
          ) : (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Tipos de plano</CardTitle>
                <CardDescription>Consulta apenas. A edição de preços é reservada ao super administrador.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo (interno)</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Max presells</TableHead>
                      <TableHead className="text-right">Max cliques/mês</TableHead>
                      <TableHead>Branding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.type}</code>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoneyCents(p.price_cents)}</TableCell>
                        <TableCell className="text-right">{p.max_presell_pages ?? "—"}</TableCell>
                        <TableCell className="text-right">{p.max_clicks_per_month?.toLocaleString() ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.has_branding ? "secondary" : "outline"}>{p.has_branding ? "Sim" : "Não"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Sem planos na base de dados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="brand" className="space-y-4 mt-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Favicon e marca
                </CardTitle>
                <CardDescription>
                  Ícone do separador do browser (PNG, ICO, SVG ou WebP, até 512 KB). Visível para todos os visitantes nas presells públicas.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {brandingMeta?.has_favicon ? (
                    <img
                      src={brandingService.faviconHref(brandingMeta.updated_at)}
                      alt=""
                      className="h-12 w-12 rounded-md border border-border object-contain bg-muted/30"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {brandingMeta?.has_favicon ? (
                      <span>
                        Favicon ativo
                        {brandingMeta.updated_at && (
                          <span className="block text-xs opacity-80">
                            Atualizado {new Date(brandingMeta.updated_at).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>A usar o favicon predefinido do site.</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ico,.png,.svg,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFaviconMutation.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-2"
                    disabled={uploadFaviconMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Importar favicon
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    disabled={!brandingMeta?.has_favicon || clearFaviconMutation.isPending}
                    onClick={() => clearFaviconMutation.mutate()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
