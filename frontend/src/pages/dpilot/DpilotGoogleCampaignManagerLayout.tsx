/**
 * Chrome «Campaign Manager» Google Ads — layout profissional (header + sidebar GESTÃO).
 */
import { NavLink, Outlet, useParams } from "react-router-dom";
import {
  Bot,
  Crosshair,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Megaphone,
  Search,
  Settings2,
  Type,
} from "lucide-react";
import { DpilotGoogleNetworkBanner } from "@/components/dpilot/DpilotGoogleNetworkBanner";
import { cn } from "@/lib/utils";
import { useDpilotPaid } from "./DpilotPaidContext";

const navBtn =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";
const navIdle = "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900";
const navOn = "bg-white text-slate-900 font-medium shadow-sm ring-1 ring-slate-200/80";

function googlePath(base: string, segment: string) {
  return segment ? `${base}/google/${segment}` : `${base}/google`;
}

export function DpilotGoogleCampaignManagerLayout() {
  const { projectId: pid } = useParams();
  const { projectId, overview, isConnConnected } = useDpilotPaid();
  const id = projectId || pid;
  const base = `/tracking/dpilot/p/${id}`;

  const conn = overview?.connection as
    | { account_name?: string | null; google_customer_id?: string | null; status?: string }
    | undefined;
  const connected = isConnConnected(conn);
  const accountLabel =
    conn?.google_customer_id?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") ||
    conn?.account_name ||
    null;

  const gestao = [
    { to: googlePath(base, "visao"), label: "Visão geral", icon: LayoutDashboard, end: true },
    { to: googlePath(base, "campanhas"), label: "Campanhas", icon: Megaphone, end: true },
    { to: googlePath(base, "grupos"), label: "Grupos de anúncios", icon: LayoutGrid, end: false },
    { to: googlePath(base, "anuncios"), label: "Anúncios", icon: Type, end: false },
    { to: googlePath(base, "palavras-chave"), label: "Palavras-chave", icon: Search, end: false },
    { to: googlePath(base, "termos-pesquisa"), label: "Localizações / termos", icon: MapPin, end: false },
    { to: googlePath(base, "relatorios"), label: "Relatórios", icon: FileText, end: false },
    { to: googlePath(base, ""), label: "Configurações", icon: Settings2, end: true },
  ] as const;

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
              connected ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-100",
            )}
          >
            {connected ? "Conta Google ligada" : "Google Ads por sincronizar"}
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
        <aside className="w-full shrink-0 border-b border-slate-200 bg-slate-50 lg:w-56 lg:border-b-0 lg:border-r">
          <nav className="flex flex-col gap-4 p-3 sm:p-4">
            <div>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Gestão
              </p>
              <div className="flex flex-col gap-0.5">
                {gestao.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => cn(navBtn, isActive ? navOn : navIdle)}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Inteligência artificial
              </p>
              <NavLink
                to={`${base}/google/assistente`}
                className={({ isActive }) => cn(navBtn, isActive ? navOn : navIdle)}
              >
                <Bot className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                AI Campaign Assistant
              </NavLink>
            </div>
            <NavLink
              to={`${base}/campanhas`}
              className="mt-auto px-3 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              ← Ads Studio (todas as redes)
            </NavLink>
          </nav>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6">
          {id ? <DpilotGoogleNetworkBanner projectId={id} /> : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
