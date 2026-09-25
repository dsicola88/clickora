import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Zap,
  ClipboardList,
  Home,
  LogIn,
  LogOut,
  User,
  CreditCard,
  Settings2,
  Plug,
  Megaphone,
  ShieldAlert,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Webhook,
  LineChart,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const itemClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const itemActive =
  "bg-sidebar-primary/18 font-semibold text-sidebar-primary-foreground shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const workNav: NavItem[] = [
  { title: "Presells", url: "/presells", icon: FileText },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "URL Builder", url: "/tracking/url-builder", icon: Link2 },
];

const resultsNav: NavItem[] = [
  { title: "P&L", url: "/resultados", icon: LayoutDashboard, end: true },
  { title: "Conversões", url: "/resultados/relatorios/conversoes", icon: ClipboardList, end: true },
  { title: "Relatórios", url: "/resultados/relatorios", icon: BarChart3, end: true },
];

const configNav: NavItem[] = [
  { title: "Integrações", url: "/integracoes", icon: Plug },
  { title: "Postback", url: "/integracoes/postback", icon: Webhook },
  { title: "Google Ads", url: "/integracoes/google-ads", icon: LineChart },
  { title: "Automizer", url: "/integracoes/automizer", icon: Zap },
  { title: "Configurações", url: "/configuracoes", icon: Settings2 },
];

function isNavActive(url: string, path: string, end?: boolean): boolean {
  if (end) return path === url;
  if (path === url) return true;
  if (url !== "/" && path.startsWith(`${url}/`)) return true;
  return false;
}

function NavRows({ items, path, collapsed }: { items: NavItem[]; path: string; collapsed: boolean }) {
  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={isNavActive(item.url, path, item.end)} tooltip={item.title}>
            <NavLink
              to={item.url}
              end={item.end}
              className={itemClass}
              activeClassName={itemActive}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <AppSidebarInner collapsed={state === "collapsed"} />
    </Sidebar>
  );
}

function AppSidebarInner({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const path = location.pathname;
  const { user, isAdmin, isSuperAdmin, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border/80 p-3">
        <div className="flex items-center gap-2">
          <NavLink to="/inicio" className="group/logo flex min-w-0 flex-1 items-center gap-2.5">
            <div className="gradient-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="truncate text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">
                dclickora
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
            title={collapsed ? "Expandir menu" : "Encolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Encolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="space-y-1 p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/inicio"} tooltip="Início">
                  <NavLink to="/inicio" end className={itemClass} activeClassName={itemActive}>
                    <Home className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Início</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-muted">
              Trabalho
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRows items={workNav} path={path} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-muted">
              Performance
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRows items={resultsNav} path={path} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-muted">
              Configuração
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRows items={configNav} path={path} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-muted">
              Conta
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/conta"} tooltip="Perfil">
                  <NavLink to="/conta" end className={itemClass} activeClassName={itemActive}>
                    <User className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Perfil</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/planos" || path === "/plans"} tooltip="Plano">
                  <NavLink to="/planos" className={itemClass} activeClassName={itemActive}>
                    <CreditCard className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Plano</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(isAdmin || isSuperAdmin) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/admin")} tooltip="Admin">
                    <NavLink to="/admin/overview" className={itemClass} activeClassName={itemActive}>
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between gap-2">
                          <span>Admin</span>
                          <Badge variant="secondary" className="text-[10px]">
                            Staff
                          </Badge>
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <SidebarMenu>
          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sair"
                className={cn(itemClass, "w-full")}
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>Sair</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Entrar">
                <NavLink to="/auth" className={itemClass} activeClassName={itemActive}>
                  <LogIn className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>Entrar</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {!collapsed && (
          <p className="px-3 pt-1 text-[10px] text-sidebar-foreground/45 truncate" title={user?.email}>
            {user?.email}
          </p>
        )}
      </SidebarFooter>
    </>
  );
}
