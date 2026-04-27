import { NavLink, Outlet, useParams } from "react-router-dom";
import {
  BarChart3,
  Facebook,
  FileText,
  LayoutDashboard,
  Megaphone,
  Music2,
  ClipboardList,
  Link2,
  Shield,
  Users,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDpilotPaid } from "./DpilotPaidContext";

const navItem =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground";
const navActive = "bg-primary/10 text-foreground font-medium";

export function DpilotPaidLayout() {
  const { projectId, changeRequests } = useDpilotPaid();
  const { projectId: pid } = useParams();
  const base = `/tracking/dpilot/p/${projectId || pid}`;
  const pending = changeRequests.filter((c) => c.status === "pending").length;

  return (
    <div className="flex flex-col gap-6 px-2 py-4 lg:flex-row lg:px-4">
      <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-56">
        <div className="mb-4 space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Paid Autopilot</p>
          <p className="px-1 text-[11px] text-muted-foreground">No dclickora — monólito</p>
        </div>
        <nav className="flex flex-col gap-0.5">
          <NavLink to={`${base}/visao`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Visão geral
          </NavLink>
          <NavLink to={`${base}/ligacoes`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Link2 className="h-4 w-4 shrink-0" />
            Ligações (OAuth)
          </NavLink>
          <NavLink to={`${base}/google`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <BarChart3 className="h-4 w-4 shrink-0" />
            Google Ads
          </NavLink>
          <NavLink to={`${base}/campanhas/nova`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Sparkles className="h-4 w-4 shrink-0" />
            Google · nova campanha
          </NavLink>
          <NavLink to={`${base}/meta`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Facebook className="h-4 w-4 shrink-0" />
            Meta (FB + IG)
          </NavLink>
          <NavLink to={`${base}/meta/campanhas`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Workflow className="h-4 w-4 shrink-0" />
            Meta · campanhas
          </NavLink>
          <NavLink to={`${base}/meta/nova`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Sparkles className="h-4 w-4 shrink-0" />
            Meta · nova campanha
          </NavLink>
          <NavLink to={`${base}/tiktok`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Music2 className="h-4 w-4 shrink-0" />
            TikTok Ads
          </NavLink>
          <NavLink to={`${base}/tiktok/campanhas`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Workflow className="h-4 w-4 shrink-0" />
            TikTok · campanhas
          </NavLink>
          <NavLink to={`${base}/tiktok/nova`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Sparkles className="h-4 w-4 shrink-0" />
            TikTok · nova campanha
          </NavLink>
          <NavLink to={`${base}/campanhas`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Megaphone className="h-4 w-4 shrink-0" />
            Campanhas
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
