import { useEffect, useMemo, useRef } from "react";
import {
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
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
import {
  isAppNavActive,
  navGroupKeyPath,
  navTitleKeyPath,
  sidebarNavItems,
  type AppNavItem,
} from "@/lib/appNav";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

const itemClass =
  "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:min-h-0";
const itemActive =
  "bg-sidebar-primary/18 font-semibold text-sidebar-primary-foreground shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]";

const SIDEBAR_GROUPS: AppNavItem["group"][] = [
  "principal",
  "trabalho",
  "performance",
  "configuracao",
  "conta",
];

function NavRows({ items, path, collapsed }: { items: AppNavItem[]; path: string; collapsed: boolean }) {
  const { t } = useAppLocale();
  return (
    <>
      {items.map((item) => {
        const title = t(navTitleKeyPath(item.titleKey));
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild isActive={isAppNavActive(item.url, path, item.end)} tooltip={title}>
              <NavLink to={item.url} end={item.end} className={itemClass} activeClassName={itemActive}>
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex flex-1 items-center justify-between gap-2 truncate">
                    <span className="truncate">{title}</span>
                    {item.staffOnly ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("common.staff")}
                      </Badge>
                    ) : null}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <AppSidebarInner collapsed={!isMobile && state === "collapsed"} />
    </Sidebar>
  );
}

function AppSidebarInner({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const path = location.pathname;
  const { user, isAdmin, isSuperAdmin, signOut } = useAuth();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const { t } = useAppLocale();
  const staff = isAdmin || isSuperAdmin;

  const pathRef = useRef(path);
  useEffect(() => {
    if (pathRef.current === path) return;
    pathRef.current = path;
    if (isMobile) setOpenMobile(false);
  }, [path, isMobile, setOpenMobile]);

  const byGroup = useMemo(() => {
    const map = new Map<AppNavItem["group"], AppNavItem[]>();
    for (const g of SIDEBAR_GROUPS) map.set(g, []);
    for (const item of sidebarNavItems(staff)) {
      map.get(item.group)?.push(item);
    }
    return SIDEBAR_GROUPS.map((g) => ({ group: g, items: map.get(g) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [staff]);

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
            onClick={() => (isMobile ? setOpenMobile(false) : toggleSidebar())}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:h-8 md:w-8"
            title={
              isMobile ? t("chrome.closeMenu") : collapsed ? t("chrome.expandMenu") : t("chrome.collapseMenu")
            }
            aria-label={
              isMobile ? t("chrome.closeMenu") : collapsed ? t("chrome.expandMenu") : t("chrome.collapseMenu")
            }
          >
            {isMobile || !collapsed ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="space-y-1 p-2">
        {byGroup.map(({ group, items }) => (
          <SidebarGroup key={group}>
            {!collapsed && group !== "principal" && (
              <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-muted">
                {t(navGroupKeyPath(group))}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <NavRows items={items} path={path} collapsed={collapsed} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <SidebarMenu>
          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("chrome.signOut")}
                className={cn(itemClass, "w-full")}
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{t("chrome.signOut")}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("chrome.signIn")}>
                <NavLink to="/auth" className={itemClass} activeClassName={itemActive}>
                  <LogIn className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>{t("chrome.signIn")}</span>}
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
