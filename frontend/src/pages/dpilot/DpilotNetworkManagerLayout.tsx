/**
 * Chrome do Campaign Manager Meta / TikTok — separado do Google (não partilha rail Search).
 */
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { BarChart3, Facebook, Megaphone, Music2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const navItem =
  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground";
const navActive = "bg-primary/10 text-foreground font-medium";

export function DpilotNetworkManagerLayout({ network }: { network: "meta" | "tiktok" }) {
  const { projectId } = useParams();
  const location = useLocation();
  const base = `/tracking/dpilot/p/${projectId}/${network}`;
  const isMeta = network === "meta";
  const title = isMeta ? "Meta Ads" : "TikTok Ads";
  const accent = isMeta ? "text-indigo-600" : "text-rose-600";
  const Icon = isMeta ? Facebook : Music2;

  const links = [
    { to: `${base}/visao`, label: "Visão", icon: BarChart3 },
    { to: `${base}/campanhas`, label: "Campanhas", icon: Megaphone },
    { to: `${base}/importar`, label: "Importar", icon: Download },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-52">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Icon className={cn("h-4 w-4", accent)} aria-hidden />
          <p className="text-sm font-semibold tracking-tight">{title}</p>
        </div>
        <p className="mb-3 px-1 text-[11px] leading-snug text-muted-foreground">
          Ops day-to-day: métricas, pausar/activar, orçamento e import. Funil Clickora via
          presell → /track/r/.
        </p>
        <nav className="flex flex-col gap-0.5">
          {links.map((l) => {
            const I = l.icon;
            const active =
              location.pathname === l.to || location.pathname.startsWith(`${l.to}/`);
            return (
              <NavLink key={l.to} to={l.to} className={cn(navItem, active && navActive)}>
                <I className="h-4 w-4 shrink-0" />
                {l.label}
              </NavLink>
            );
          })}
          <NavLink
            to={`/tracking/dpilot/p/${projectId}/${network}/nova`}
            className={({ isActive }) => cn(navItem, "mt-2", isActive && navActive)}
          >
            Nova campanha
          </NavLink>
          <NavLink
            to={`/tracking/dpilot/p/${projectId}/campanhas?plat=${isMeta ? "meta_ads" : "tiktok_ads"}`}
            className={cn(navItem, "mt-1")}
          >
            Hub todas redes
          </NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
