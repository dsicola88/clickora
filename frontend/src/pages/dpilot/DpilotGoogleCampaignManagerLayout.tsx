/**
 * Chrome «Campaign Manager» Google Ads — layout profissional (header + sidebar GESTÃO).
 * Caminho crítico: inventário + fila. Relatórios/IA/config em «Mais».
 * Mobile: select + chips horizontais (sem aside empilhado).
 */
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Ban,
  Bot,
  ClipboardList,
  Crosshair,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Megaphone,
  Search,
  Settings2,
  Target,
  Type,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DpilotGoogleNetworkBanner } from "@/components/dpilot/DpilotGoogleNetworkBanner";
import { cn } from "@/lib/utils";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

const navBtn =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";
const navIdle = "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900";
const navOn = "bg-white text-slate-900 font-medium shadow-sm ring-1 ring-slate-200/80";
const chipBtn =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors";
const chipIdle = "bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-100";
const chipOn = "bg-[#1a234e] text-white shadow-sm";

function googlePath(base: string, segment: string) {
  return segment ? `${base}/google/${segment}` : `${base}/google`;
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

function pathMatches(pathname: string, item: NavItem) {
  if (item.end) {
    return pathname === item.to || pathname === `${item.to}/`;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function DpilotGoogleCampaignManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: pid } = useParams();
  const { projectId, overview, isConnConnected, changeRequests } = useDpilotPaid();
  const id = projectId || pid;
  const base = `/tracking/dpilot/p/${id}`;
  const pendingApprovals = changeRequests.filter((c) => c.status === "pending").length;
  /** Estúdio por campanha tem o próprio índice — não empilhar GESTÃO do CM. */
  const onCampaignStudio = /\/campanhas\/[^/]+\/google\/?$/.test(location.pathname);

  const conn = overview?.connection as
    | { account_name?: string | null; google_customer_id?: string | null; status?: string }
    | undefined;
  const connected = isConnConnected(conn);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [liveCustomerId, setLiveCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !connected) {
      setNetworkOk(null);
      setLiveCustomerId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await paidAdsService.getGoogleAdsManagerOverview(id, { preset: "today" });
      if (cancelled) return;
      const ok =
        Boolean(data?.connected) &&
        !data?.connection_error &&
        data?.source === "google_ads_api";
      setNetworkOk(ok);
      setLiveCustomerId(data?.account?.customer_id ?? conn?.google_customer_id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, connected, conn?.google_customer_id]);

  const accountLabel =
    (liveCustomerId ?? conn?.google_customer_id)?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") ||
    conn?.account_name ||
    null;
  const badgeLabel = !connected
    ? "Google Ads por sincronizar"
    : networkOk === false
      ? "Ligada · rede indisponível"
      : networkOk === true
        ? "Conta Google · rede OK"
        : "Conta Google ligada";
  const badgeClass = !connected
    ? "bg-amber-500/20 text-amber-100"
    : networkOk === false
      ? "bg-amber-500/25 text-amber-100"
      : "bg-emerald-500/20 text-emerald-200";

  const gestaoCritica: NavItem[] = useMemo(
    () => [
      { to: googlePath(base, "visao"), label: "Visão geral", icon: LayoutDashboard, end: true },
      { to: googlePath(base, "campanhas"), label: "Campanhas", icon: Megaphone, end: true },
      { to: googlePath(base, "grupos"), label: "Grupos", icon: LayoutGrid },
      { to: googlePath(base, "anuncios"), label: "Anúncios", icon: Type },
      { to: googlePath(base, "palavras-chave"), label: "Palavras-chave", icon: Search },
      { to: googlePath(base, "termos-pesquisa"), label: "Termos", icon: Ban },
      { to: googlePath(base, "orcamentos"), label: "Orçamentos", icon: Wallet },
    ],
    [base],
  );

  const fila: NavItem[] = useMemo(
    () => [{ to: googlePath(base, "aprovacoes"), label: "Aprovações", icon: ClipboardList }],
    [base],
  );

  const mais: NavItem[] = useMemo(
    () => [
      { to: googlePath(base, "conversoes"), label: "Conversões", icon: Target },
      { to: googlePath(base, "relatorios"), label: "Relatórios", icon: FileText },
      { to: googlePath(base, "recomendacoes"), label: "Recomendações", icon: Lightbulb },
      { to: googlePath(base, "historico"), label: "Histórico", icon: History },
      { to: googlePath(base, "automacoes"), label: "Automações", icon: Zap },
      { to: googlePath(base, "assistente"), label: "Assistente IA", icon: Bot },
      { to: googlePath(base, ""), label: "Configurações", icon: Settings2, end: true },
    ],
    [base],
  );

  const allNav = useMemo(() => [...gestaoCritica, ...fila, ...mais], [gestaoCritica, fila, mais]);

  const activeTo = useMemo(() => {
    const hit = allNav.find((item) => pathMatches(location.pathname, item));
    return hit?.to ?? null;
  }, [allNav, location.pathname]);

  const renderNavLink = (item: NavItem, opts?: { badge?: number }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn(navBtn, isActive ? navOn : navIdle)}
    >
      <item.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {opts?.badge != null && opts.badge > 0 ? (
        <Badge variant="secondary" className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px]">
          {opts.badge}
        </Badge>
      ) : null}
    </NavLink>
  );

  return (
    <div className="mx-auto flex min-h-[min(900px,calc(100vh-120px))] w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#1a234e] px-4 py-3 text-white sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Crosshair className="h-5 w-5 text-sky-300" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/90">
              dclickora
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight sm:text-base">
              <LayoutGrid className="h-4 w-4 text-sky-300" aria-hidden />
              Campaign Manager
            </p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              badgeClass,
            )}
          >
            {badgeLabel}
          </span>
          {accountLabel ? (
            <p className="mt-1 font-mono text-[11px] text-slate-300">Conta: {accountLabel}</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">
              <NavLink className="underline hover:text-white" to={`${base}/google`}>
                Abrir configurações
              </NavLink>
            </p>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {onCampaignStudio ? null : (
          <>
            {/* Mobile: select + chips (caminho crítico) */}
            <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50 p-3 lg:hidden">
              <Select
                value={activeTo ?? undefined}
                onValueChange={(to) => navigate(to)}
              >
                <SelectTrigger className="h-9 bg-white text-sm" aria-label="Secção do Campaign Manager">
                  <SelectValue placeholder="Secção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Gestão</SelectLabel>
                    {gestaoCritica.map((item) => (
                      <SelectItem key={item.to} value={item.to}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Fila</SelectLabel>
                    {fila.map((item) => (
                      <SelectItem key={item.to} value={item.to}>
                        {item.label}
                        {pendingApprovals > 0 && item.to.includes("aprovacoes")
                          ? ` (${pendingApprovals})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Mais</SelectLabel>
                    {mais.map((item) => (
                      <SelectItem key={item.to} value={item.to}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                {gestaoCritica.map((item) => {
                  const on = pathMatches(location.pathname, item);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={cn(chipBtn, on ? chipOn : chipIdle)}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      {item.label}
                    </NavLink>
                  );
                })}
                <NavLink
                  to={fila[0].to}
                  className={cn(
                    chipBtn,
                    pathMatches(location.pathname, fila[0]) ? chipOn : chipIdle,
                  )}
                >
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Aprovações
                  {pendingApprovals > 0 ? (
                    <span className="rounded-md bg-amber-500/20 px-1 text-[10px] text-amber-900">
                      {pendingApprovals}
                    </span>
                  ) : null}
                </NavLink>
              </div>
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-slate-50 lg:block">
              <nav className="flex h-full flex-col gap-4 p-3 sm:p-4">
                <div>
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Gestão
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {gestaoCritica.map((item) => renderNavLink(item))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Fila
                  </p>
                  {renderNavLink(fila[0], { badge: pendingApprovals })}
                </div>
                <div>
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Mais
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {mais.map((item) => renderNavLink(item))}
                  </div>
                </div>
                <NavLink
                  to={`${base}/campanhas`}
                  className="mt-auto px-3 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  ← Ads Studio (todas as redes)
                </NavLink>
              </nav>
            </aside>
          </>
        )}

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto bg-white",
            onCampaignStudio ? "p-3 sm:p-4" : "p-4 sm:p-6",
          )}
        >
          {id && !onCampaignStudio ? <DpilotGoogleNetworkBanner projectId={id} /> : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
