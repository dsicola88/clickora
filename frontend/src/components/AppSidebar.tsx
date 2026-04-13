import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Link2,
  ChevronLeft,
  ChevronRight,
  Zap,
  ShoppingCart,
  Globe,
  ClipboardList,
  Crosshair,
  ShieldBan,
  Home,
  Sparkles,
  LinkIcon,
  Plug,
  Settings,
  ScrollText,
  CreditCard,
  ShieldAlert,
  LogIn,
  LogOut,
  User,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const sidebarItemClassName =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const sidebarItemActiveClassName =
  "bg-sidebar-primary/18 font-semibold text-sidebar-primary-foreground shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const presellNavItems: NavItem[] = [
  { title: "Minhas Presells", url: "/presell/dashboard", icon: FileText },
  { title: "Templates", url: "/presell/templates", icon: Sparkles },
];

const trackingNavItems: NavItem[] = [
  { title: "Resumo e guia", url: "/tracking/dashboard", icon: LayoutDashboard },
  { title: "Vendas / Funil", url: "/tracking/vendas", icon: ShoppingCart },
  { title: "Plataformas", url: "/tracking/plataformas", icon: Globe },
  { title: "Relatórios", url: "/tracking/relatorios", icon: ClipboardList },
  { title: "Analytics", url: "/tracking/analytics", icon: BarChart3 },
  { title: "Links", url: "/tracking/links", icon: Link2 },
  { title: "Tracking Tools", url: "/tracking/tools", icon: Crosshair },
  { title: "Blacklist", url: "/tracking/blacklist", icon: ShieldBan },
  { title: "Construtor de URL", url: "/tracking/url-builder", icon: LinkIcon },
  { title: "Integrações", url: "/tracking/integrations", icon: Plug },
  { title: "Configurações", url: "/tracking/settings", icon: Settings },
  { title: "Logs", url: "/tracking/logs", icon: ScrollText },
];

function SubNavLinks({ items, path }: { items: NavItem[]; path: string }) {
  return (
    <SidebarMenuSub>
      {items.map((item) => (
        <SidebarMenuSubItem key={item.url}>
          <SidebarMenuSubButton asChild isActive={path === item.url} size="md">
            <NavLink
              to={item.url}
              end
              className={({ isActive: a }) =>
                cn("no-underline", a && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const path = location.pathname;
  const { user, isAdmin, userPlan, signOut } = useAuth();

  const inPresell = path.startsWith("/presell");
  const inTracking = path.startsWith("/tracking");

  const [presellOpen, setPresellOpen] = useState(inPresell);
  const [trackingOpen, setTrackingOpen] = useState(inTracking);

  useEffect(() => {
    setPresellOpen(inPresell);
  }, [inPresell]);

  useEffect(() => {
    setTrackingOpen(inTracking);
  }, [inTracking]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/80">
        <NavLink to="/plans" className="flex items-center gap-2.5 group/logo">
          <div className="gradient-primary rounded-md w-8 h-8 flex items-center justify-center flex-shrink-0 shadow-md shadow-black/20 ring-1 ring-white/10">
            <Zap className="w-4 h-4 text-primary-foreground drop-shadow-sm" />
          </div>
          {!collapsed && (
            <span className="text-lg font-extrabold text-sidebar-accent-foreground tracking-tight group-hover/logo:text-sidebar-primary-foreground transition-colors">
              dclickora
            </span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="p-2 space-y-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/inicio"} tooltip="Escolher área">
                  <NavLink to="/inicio" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
                    <Home className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Escolher área</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3">Área de trabalho</SidebarGroupLabel>
          )}
          <SidebarGroupContent className="space-y-1">
            <Collapsible open={presellOpen} onOpenChange={setPresellOpen}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Minha presell"
                      className="w-full justify-between gap-2"
                      isActive={inPresell}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate">Minha presell</span>}
                      </span>
                      {!collapsed && (
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
                            presellOpen && "rotate-90",
                          )}
                        />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SubNavLinks items={presellNavItems} path={path} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </SidebarMenu>
            </Collapsible>

            <Collapsible open={trackingOpen} onOpenChange={setTrackingOpen}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Meu Rastreamento"
                      className="w-full justify-between gap-2"
                      isActive={inTracking}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <BarChart3 className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate">Meu Rastreamento</span>}
                      </span>
                      {!collapsed && (
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
                            trackingOpen && "rotate-90",
                          )}
                        />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SubNavLinks items={trackingNavItems} path={path} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </SidebarMenu>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3">Conta</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/conta"} tooltip="Perfil e segurança">
                  <NavLink to="/conta" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
                    <User className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Perfil</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/plans"} tooltip="Planos">
                  <NavLink to="/plans" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
                    <CreditCard className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="flex items-center gap-2">
                        Planos
                        {userPlan && <span className="text-[10px] bg-sidebar-accent px-1.5 py-0.5 rounded-full">{userPlan.plan_name}</span>}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/admin"} tooltip="Admin">
                    <NavLink to="/admin" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-xs text-sidebar-muted truncate">{user.email}</p>
          </div>
        )}
        {user ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:text-destructive hover:bg-sidebar-accent transition-colors w-full text-sm"
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
        ) : (
          <NavLink
            to="/auth"
            aria-label="Entrar"
            title="Entrar"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:text-sidebar-primary-foreground hover:bg-sidebar-accent transition-colors w-full text-sm"
          >
            <LogIn className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Entrar</span>}
          </NavLink>
        )}
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors w-full"
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span className="text-sm">Recolher</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
