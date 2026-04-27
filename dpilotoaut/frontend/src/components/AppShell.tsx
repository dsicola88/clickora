import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Facebook,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  FileStack,
  ScrollText,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  Shield,
  User as UserIcon,
  Users,
  Video,
} from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/branding";
import type { WorkspaceOption } from "@/server/app-data.functions";
import { useClickoraEmbed } from "@/hooks/useClickoraEmbed";

interface AppShellProps {
  projectId: string;
  projectName: string;
  orgName: string;
  /** Workspaces (tenants) do utilizador; com mais de um, mostra-se o selector. */
  workspaces?: WorkspaceOption[];
  activeOrganizationId?: string;
  onWorkspaceChange?: (organizationId: string) => void;
  children: ReactNode;
}

const navItems = (projectId: string) => [
  {
    to: "/app/projects/$projectId/paid",
    label: "Visão geral",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/app/projects/$projectId/paid/campaigns",
    label: "Google Ads",
    icon: Megaphone,
  },
  {
    to: "/app/projects/$projectId/paid/meta",
    label: "Meta (FB + IG)",
    icon: Facebook,
  },
  {
    to: "/app/projects/$projectId/paid/tiktok",
    label: "TikTok Ads",
    icon: Video,
  },
  {
    to: "/app/projects/$projectId/paid/approvals",
    label: "Aprovações",
    icon: ListChecks,
  },
  {
    to: "/app/projects/$projectId/paid/audit",
    label: "Auditoria",
    icon: ScrollText,
  },
  {
    to: "/app/projects/$projectId/landings",
    label: "Páginas de venda",
    icon: FileStack,
    end: true,
  },
  {
    to: "/app/projects/$projectId/organization/members",
    label: "Equipa",
    icon: Users,
    end: true,
  },
];

function WorkspaceLabel({
  workspaces,
  activeOrganizationId,
  orgName,
  onWorkspaceChange,
  compact,
}: {
  workspaces: WorkspaceOption[];
  activeOrganizationId: string;
  orgName: string;
  onWorkspaceChange: (organizationId: string) => void;
  compact?: boolean;
}) {
  if (workspaces.length <= 1) {
    return (
      <p
        className={cn(
          "truncate text-[11px] text-muted-foreground",
          compact && "text-center",
        )}
      >
        {orgName}
      </p>
    );
  }
  return (
    <Select value={activeOrganizationId} onValueChange={onWorkspaceChange}>
      <SelectTrigger
        className={cn(
          "h-8 border-sidebar-border bg-sidebar/50 text-left text-xs font-normal",
          compact && "max-w-full",
        )}
        aria-label="Trocar de conta (empresa)"
      >
        <SelectValue placeholder="Conta" />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((w) => (
          <SelectItem key={w.organizationId} value={w.organizationId}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AppShell({
  projectId,
  projectName,
  orgName,
  workspaces = [],
  activeOrganizationId,
  onWorkspaceChange,
  children,
}: AppShellProps) {
  const { signOut, user } = useAuth();
  const isStoreAdmin = user?.isPlatformAdmin;
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clickoraEmbed = useClickoraEmbed();

  const items = navItems(projectId);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (clickoraEmbed) {
    return (
      <div className="flex h-full min-h-full w-full min-w-0 flex-col bg-background text-foreground">
        <main
          id="conteudo-app"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 min-w-0 bg-background text-foreground">
      {/* Com `top-4` + -translate-y-full parte do botão ficava visível (corte no topo). */}
      <a
        href="#conteudo-app"
        className="fixed left-4 top-0 z-[200] -translate-y-full rounded-b-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-md transition-transform focus:translate-y-0 focus:top-4 focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar para o conteúdo
      </a>
      <aside
        className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
        aria-label="Navegação do projeto"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Bot className="h-4 w-4 text-primary-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{APP_NAME}</p>
            {activeOrganizationId && onWorkspaceChange ? (
              <WorkspaceLabel
                workspaces={workspaces}
                activeOrganizationId={activeOrganizationId}
                orgName={orgName}
                onWorkspaceChange={onWorkspaceChange}
              />
            ) : (
              <p className="truncate text-[11px] text-muted-foreground">{orgName}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 px-3 py-3">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {projectName}
          </p>
        </div>
        <nav
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 pb-2"
          aria-label="Secções de paid media"
        >
          {items.map((item) => {
            const fullPath = item.to.replace("$projectId", projectId);
            const isActive = item.end ? pathname === fullPath : pathname.startsWith(fullPath);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                params={{ projectId }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground">Conectado</p>
            </div>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mb-2 flex flex-col gap-1.5">
            <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
              <Link to="/app/conta" className="text-xs">
                <UserIcon className="mr-1.5 h-3.5 w-3.5" /> Conta
              </Link>
            </Button>
            {isStoreAdmin && (
              <>
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link to="/app/admin" className="text-xs">
                    <Shield className="mr-1.5 h-3.5 w-3.5" /> Painel comercial
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link to="/app/admin/landings" className="text-xs">
                    <FileStack className="mr-1.5 h-3.5 w-3.5" /> Página de vendas (site)
                  </Link>
                </Button>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-1 h-3.5 w-3.5" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-card/60 px-4 backdrop-blur md:hidden">
          <div className="min-w-0 flex-1">
            <Link to="/app" className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-primary">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="truncate text-sm font-semibold">{projectName}</span>
            </Link>
            {activeOrganizationId && onWorkspaceChange && workspaces.length > 1 && (
              <div className="pl-9 pt-0.5">
                <WorkspaceLabel
                  workspaces={workspaces}
                  activeOrganizationId={activeOrganizationId}
                  orgName={orgName}
                  onWorkspaceChange={onWorkspaceChange}
                  compact
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav
          className="order-last flex border-t border-border bg-card/60 backdrop-blur md:hidden"
          aria-label="Navegação móvel"
        >
          {items.map((item) => {
            const fullPath = item.to.replace("$projectId", projectId);
            const isActive = item.end ? pathname === fullPath : pathname.startsWith(fullPath);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                params={{ projectId }}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main
          id="conteudo-app"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 border-b border-border px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8"
      role="banner"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 text-primary" aria-hidden />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
