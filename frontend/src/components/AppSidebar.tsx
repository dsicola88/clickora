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
  ListChecks,
  Home,
  Sparkles,
  LayoutGrid,
  FileStack,
  LinkIcon,
  Shuffle,
  Plug,
  BookOpen,
  Settings,
  ScrollText,
  CreditCard,
  ShieldAlert,
  LogIn,
  LogOut,
  User,
  Wrench,
  Megaphone,
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
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { presellDashboardAnalyticsHref, PRESELL_DASH_ANALYTICS_TAB_PARAM } from "@/lib/presellDashboardAnalyticsTab";
import { Badge } from "@/components/ui/badge";

const sidebarItemClassName =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const sidebarItemActiveClassName =
  "bg-sidebar-primary/18 font-semibold text-sidebar-primary-foreground shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Texto ao pairar: quando usar esta página vs as outras do mesmo grupo */
  hint?: string;
};

/** Caminho principal: criar e publicar presells. */
const presellNavEssential: NavItem[] = [
  { title: "Minhas Presells", url: "/presell/dashboard", icon: FileText },
  { title: "Templates", url: "/presell/templates", icon: Sparkles },
];

/** Editor manual e lista de páginas — útil, mas secundário para quem só usa presell guiada. */
const presellNavAdvanced: NavItem[] = [
  {
    title: "Páginas criadas",
    url: "/presell/paginas-criadas",
    icon: FileStack,
    hint: "Só páginas do editor manual da sua conta: visualizar, editar, exportar ou remover.",
  },
  {
    title: "Editor manual",
    url: "/presell/builder",
    icon: LayoutGrid,
    hint: "Construtor visual de páginas; a página pública usa o mesmo link /p/… que as presells automáticas.",
  },
];

/** O que a maioria usa no dia a dia. */
const trackingNavEssential: NavItem[] = [
  {
    title: "Assistente",
    url: "/tracking/setup-assistant",
    icon: ListChecks,
    hint: "Checklist: presell publicada, UTMs, cliques, postback e Google Ads — com verificações da conta.",
  },
  {
    title: "Resumo e guia",
    url: "/tracking/dashboard",
    icon: LayoutDashboard,
    hint: "KPIs do período (vendas, Google Ads na conta), guia e integrações. Métricas do script nas páginas: Minhas Presells.",
  },
  {
    title: "Vendas / Funil",
    url: "/tracking/vendas",
    icon: ShoppingCart,
    hint: "Funil e etapas da jornada de conversão.",
  },
  {
    title: "Plataformas",
    url: "/tracking/plataformas",
    icon: Globe,
    hint: "Webhook de postback de afiliado: liga vendas ao clique (clickora_click_id).",
  },
  {
    title: "Relatórios",
    url: "/tracking/relatorios",
    icon: ClipboardList,
    hint: "Tabelas com filtro por data: impressões, cliques e conversões (mais detalhe).",
  },
  {
    title: "Links",
    url: "/tracking/links",
    icon: Link2,
    hint: "Gerar links de redirect com UTMs ligados à presell.",
  },
];

const trackingNavAdvanced: NavItem[] = [
  {
    title: "Analytics",
    url: "/tracking/analytics",
    icon: BarChart3,
    hint: "Visão rápida: totais e gráfico por presell. Para listagens por data, use Relatórios.",
  },
  {
    title: "Rotadores",
    url: "/tracking/rotadores",
    icon: Shuffle,
    hint: "Distribuir cliques por vários destinos (A/B, geo, dispositivo) — URL público único.",
  },
  {
    title: "Tracking Tools",
    url: "/tracking/tools",
    icon: Crosshair,
    hint: "Diagnóstico: IP (GeoLite), GCLID no clique, auditoria de postbacks.",
  },
  {
    title: "IP & proteções",
    url: "/tracking/blacklist",
    icon: ShieldBan,
    hint: "Blacklist, whitelist e regras de proteção do tracking.",
  },
  {
    title: "Construtor de URL",
    url: "/tracking/url-builder",
    icon: LinkIcon,
    hint: "Montar o URL público da presell com UTMs e macros das redes.",
  },
  {
    title: "Integrações",
    url: "/tracking/integrations",
    icon: Plug,
    hint: "Google Ads, CSV, Telegram e ferramentas ligadas ao tracking.",
  },
  {
    title: "Configurações",
    url: "/tracking/settings",
    icon: Settings,
    hint: "Domínios personalizados, notificações e preferências da conta.",
  },
  {
    title: "Logs",
    url: "/tracking/logs",
    icon: ScrollText,
    hint: "Histórico de atividade e eventos recentes.",
  },
];

const presellNavMetrics: NavItem[] = [
  {
    title: "Rastreamento (script)",
    url: presellDashboardAnalyticsHref("rastreamento"),
    icon: BarChart3,
    hint: "Aba: totais do script nas páginas, CTR e gráfico diário.",
  },
  {
    title: "Cliques por país",
    url: presellDashboardAnalyticsHref("pais"),
    icon: Globe,
    hint: "Aba: cliques do script por país (IP).",
  },
];

function isActiveSubPath(
  item: NavItem,
  path: string,
  locationHash: string = "",
  locationSearch: string = "",
): boolean {
  const rawUrl = item.url;
  const searchNorm = locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch;
  const locQs = new URLSearchParams(searchNorm);
  const abaPresell = locQs.get(PRESELL_DASH_ANALYTICS_TAB_PARAM);

  if (rawUrl === "/presell/dashboard" && path === "/presell/dashboard") {
    const hashOk = locationHash === "" || locationHash === "#";
    if (!hashOk) return false;
    return abaPresell == null || abaPresell === "";
  }

  if (rawUrl === presellDashboardAnalyticsHref("rastreamento")) {
    return path === "/presell/dashboard" && abaPresell !== "pais";
  }
  if (rawUrl === presellDashboardAnalyticsHref("pais")) {
    return path === "/presell/dashboard" && abaPresell === "pais";
  }

  const hashIdx = rawUrl.indexOf("#");
  if (hashIdx >= 0) {
    const base = rawUrl.slice(0, hashIdx);
    const frag = rawUrl.slice(hashIdx + 1);
    if (path !== base) return false;
    return locationHash === `#${frag}`;
  }

  if (path === rawUrl) return true;
  if (rawUrl === "/presell/builder" && path.startsWith("/presell/builder")) return true;
  if (rawUrl === "/tracking/relatorios" && path.startsWith("/tracking/relatorios")) return true;
  if (rawUrl === "/tracking/analytics" && path.startsWith("/tracking/analytics")) return true;
  if (rawUrl === "/presell/templates" && path.startsWith("/presell/templates")) return true;
  if (rawUrl === "/tracking/tools" && path.startsWith("/tracking/tools")) return true;
  return false;
}

function SubNavLinkRows({
  items,
  path,
  locationHash = "",
  locationSearch = "",
}: {
  items: NavItem[];
  path: string;
  locationHash?: string;
  locationSearch?: string;
}) {
  return (
    <>
      {items.map((item) => (
        <SidebarMenuSubItem key={item.url}>
          <SidebarMenuSubButton
            asChild
            isActive={isActiveSubPath(item, path, locationHash, locationSearch)}
            size="md"
          >
            <NavLink
              to={item.url}
              end={
                item.url !== "/presell/builder" &&
                item.url !== "/presell/templates" &&
                !item.url.includes("#") &&
                !item.url.includes("?")
              }
              title={item.hint ?? item.title}
              className={({ isActive: a }) =>
                cn("no-underline", a && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="leading-snug">{item.title}</span>
            </NavLink>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </>
  );
}

function SubNavLinks({
  items,
  path,
  locationHash = "",
  locationSearch = "",
}: {
  items: NavItem[];
  path: string;
  locationHash?: string;
  locationSearch?: string;
}) {
  return (
    <SidebarMenuSub>
      <SubNavLinkRows items={items} path={path} locationHash={locationHash} locationSearch={locationSearch} />
    </SidebarMenuSub>
  );
}

function PresellNavWithAdvanced({
  path,
  locationHash,
  locationSearch,
  collapsed,
  advancedOpen,
  onAdvancedOpenChange,
}: {
  path: string;
  locationHash: string;
  locationSearch: string;
  collapsed: boolean;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}) {
  if (collapsed) {
    return (
      <SubNavLinks
        items={[...presellNavEssential, ...presellNavAdvanced, ...presellNavMetrics]}
        path={path}
        locationHash={locationHash}
        locationSearch={locationSearch}
      />
    );
  }
  return (
    <SidebarMenuSub>
      <SubNavLinkRows items={presellNavEssential} path={path} locationHash={locationHash} locationSearch={locationSearch} />
      <SidebarMenuSubItem>
        <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground w-full"
              isActive={
                path.startsWith("/presell/paginas-criadas") || path.startsWith("/presell/builder")
              }
            >
              <Wrench className="h-4 w-4 shrink-0" />
              <span className="truncate">Páginas e editor</span>
              <ChevronRight
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
                  advancedOpen && "rotate-90",
                )}
              />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-none">
            <SidebarMenuSub className="mx-0 mt-0.5 border-l border-sidebar-border pl-2">
              <SubNavLinkRows
                items={presellNavAdvanced}
                path={path}
                locationHash={locationHash}
                locationSearch={locationSearch}
              />
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
      <SubNavLinkRows items={presellNavMetrics} path={path} locationHash={locationHash} locationSearch={locationSearch} />
    </SidebarMenuSub>
  );
}

function TrackingNavWithAdvanced({
  path,
  locationHash,
  locationSearch,
  collapsed,
  advancedOpen,
  onAdvancedOpenChange,
}: {
  path: string;
  locationHash: string;
  locationSearch: string;
  collapsed: boolean;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}) {
  if (collapsed) {
    return (
      <SubNavLinks
        items={[...trackingNavEssential, ...trackingNavAdvanced]}
        path={path}
        locationHash={locationHash}
        locationSearch={locationSearch}
      />
    );
  }
  return (
    <SidebarMenuSub>
      <SubNavLinkRows items={trackingNavEssential} path={path} locationHash={locationHash} locationSearch={locationSearch} />
      <SidebarMenuSubItem>
        <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground w-full"
              isActive={
                path.startsWith("/tracking/analytics") ||
                path.startsWith("/tracking/rotadores") ||
                path.startsWith("/tracking/tools") ||
                path.startsWith("/tracking/blacklist") ||
                path.startsWith("/tracking/url-builder") ||
                path.startsWith("/tracking/integrations") ||
                path.startsWith("/tracking/settings") ||
                path.startsWith("/tracking/logs")
              }
            >
              <Wrench className="h-4 w-4 shrink-0" />
              <span className="truncate">Mais ferramentas</span>
              <ChevronRight
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
                  advancedOpen && "rotate-90",
                )}
              />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-none">
            <SidebarMenuSub className="mx-0 mt-0.5 border-l border-sidebar-border pl-2">
              <SubNavLinkRows
                items={trackingNavAdvanced}
                path={path}
                locationHash={locationHash}
                locationSearch={locationSearch}
              />
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const path = location.pathname;
  const { user, isAdmin, isSuperAdmin, userPlan, signOut } = useAuth();

  const inPresell = path.startsWith("/presell");
  const inTracking = path.startsWith("/tracking") && !path.startsWith("/tracking/dpilot");
  const inPaidAdsRoute = path.startsWith("/tracking/dpilot");
  const canAccessPaidAds = userCanAccessDpilotAds(user, isSuperAdmin);

  const presellAdvancedRoute =
    path.startsWith("/presell/paginas-criadas") || path.startsWith("/presell/builder");
  const trackingAdvancedRoute =
    path.startsWith("/tracking/analytics") ||
    path.startsWith("/tracking/rotadores") ||
    path.startsWith("/tracking/tools") ||
    path.startsWith("/tracking/blacklist") ||
    path.startsWith("/tracking/url-builder") ||
    path.startsWith("/tracking/integrations") ||
    path.startsWith("/tracking/settings") ||
    path.startsWith("/tracking/logs");

  const [presellOpen, setPresellOpen] = useState(inPresell);
  const [trackingOpen, setTrackingOpen] = useState(inTracking);
  const [presellAdvancedOpen, setPresellAdvancedOpen] = useState(presellAdvancedRoute);
  const [trackingAdvancedOpen, setTrackingAdvancedOpen] = useState(trackingAdvancedRoute);

  useEffect(() => {
    setPresellOpen(inPresell);
  }, [inPresell]);

  useEffect(() => {
    setTrackingOpen(inTracking);
  }, [inTracking]);

  useEffect(() => {
    setPresellAdvancedOpen(presellAdvancedRoute);
  }, [presellAdvancedRoute]);

  useEffect(() => {
    setTrackingAdvancedOpen(trackingAdvancedRoute);
  }, [trackingAdvancedRoute]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/80">
        <NavLink to="/inicio" className="flex items-center gap-2.5 group/logo">
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/ajuda"} tooltip="Aprender — centro de ajuda e atalhos">
                  <NavLink to="/ajuda" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Aprender</span>}
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
                    <PresellNavWithAdvanced
                      path={path}
                      locationHash={location.hash}
                      locationSearch={location.search}
                      collapsed={collapsed}
                      advancedOpen={presellAdvancedOpen}
                      onAdvancedOpenChange={setPresellAdvancedOpen}
                    />
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
                    <TrackingNavWithAdvanced
                      path={path}
                      locationHash={location.hash}
                      locationSearch={location.search}
                      collapsed={collapsed}
                      advancedOpen={trackingAdvancedOpen}
                      onAdvancedOpenChange={setTrackingAdvancedOpen}
                    />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </SidebarMenu>
            </Collapsible>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={inPaidAdsRoute} tooltip="Anúncios — Google, Meta e TikTok (Premium)">
                  <NavLink
                    to="/tracking/dpilot"
                    end
                    className={sidebarItemClassName}
                    activeClassName={sidebarItemActiveClassName}
                  >
                    <Megaphone className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">Anúncios</span>
                        {!canAccessPaidAds && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                            Premium
                          </Badge>
                        )}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
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
                <SidebarMenuButton
                  asChild
                  isActive={path === "/planos" || path === "/plans"}
                  tooltip="Planos"
                >
                  <NavLink to="/planos" end className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
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
                  <SidebarMenuButton asChild isActive={path.startsWith("/admin")} tooltip="Admin">
                    <NavLink to="/admin/overview" className={sidebarItemClassName} activeClassName={sidebarItemActiveClassName}>
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
