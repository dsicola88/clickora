import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  BarChart3,
  Facebook,
  FileText,
  Megaphone,
  Music2,
  ClipboardList,
  Shield,
  Users,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DpilotGoogleCampaignManagerLayout } from "./DpilotGoogleCampaignManagerLayout";

const navItem =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground";
const navActive = "bg-primary/10 text-foreground font-medium";

/**
 * Ads Studio shell.
 * Rotas Google (`/google/*` e detalhe de campanha) usam o Campaign Manager.
 */
export function DpilotPaidLayout() {
  const location = useLocation();
  const { projectId, changeRequests } = useDpilotPaid();
  const { projectId: pid } = useParams();
  const base = `/tracking/dpilot/p/${projectId || pid}`;
  const pending = changeRequests.filter((c) => c.status === "pending").length;

  const onGoogleManager =
    location.pathname.startsWith(`${base}/google`) ||
    /\/campanhas\/[^/]+\/google\/?$/.test(location.pathname);

  if (onGoogleManager) {
    return (
      <div className="px-2 py-4 lg:px-4">
        <DpilotGoogleCampaignManagerLayout />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-2 py-4 lg:flex-row lg:px-4">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="mb-4 space-y-2 rounded-lg border border-[#1a73e8]/20 bg-gradient-to-br from-[#1a73e8]/10 to-transparent px-3 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#1a73e8]" aria-hidden />
            <p className="text-xs font-semibold tracking-wide text-foreground">Ads Studio</p>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Escolha a rede. Google Ads abre o Campaign Manager.
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink
            to={`${base}/google/visao`}
            className={({ isActive }) =>
              cn(
                navItem,
                "font-medium",
                (isActive || location.pathname.startsWith(`${base}/google`)) && navActive,
              )
            }
          >
            <BarChart3 className="h-4 w-4 shrink-0 text-[#1a73e8]" />
            Google Ads
          </NavLink>
          <NavLink to={`${base}/meta`} className={({ isActive }) => cn(navItem, isActive && navActive)}>
            <Facebook className="h-4 w-4 shrink-0 text-indigo-600" />
            Meta Ads
          </NavLink>
          <NavLink to={`${base}/tiktok`} className={({ isActive }) => cn(navItem, isActive && navActive)}>
            <Music2 className="h-4 w-4 shrink-0 text-rose-600" />
            TikTok Ads
          </NavLink>

          <Separator className="my-2 opacity-70" />

          <NavLink to={`${base}/campanhas`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Megaphone className="h-4 w-4 shrink-0" />
            Todas as campanhas
          </NavLink>
          <NavLink to={`${base}/campanhas/nova`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Sparkles className="h-4 w-4 shrink-0" />
            Nova campanha
          </NavLink>
          <NavLink to={`${base}/aprovacoes`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <ClipboardList className="h-4 w-4 shrink-0" />
            Aprovações
            {pending > 0 ? (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {pending}
              </Badge>
            ) : null}
          </NavLink>
          <NavLink to={`${base}/auditoria`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Shield className="h-4 w-4 shrink-0" />
            Auditoria
          </NavLink>
          <NavLink to={`${base}/landings`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <FileText className="h-4 w-4 shrink-0" />
            Páginas de venda
          </NavLink>
          <NavLink to={`${base}/equipa`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Users className="h-4 w-4 shrink-0" />
            Equipa
          </NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
