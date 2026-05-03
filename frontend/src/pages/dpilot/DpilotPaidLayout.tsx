import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { useViewportMinWidth, VIEWPORT_LG_MIN_PX } from "@/hooks/useViewportMinWidth";
import { useDpilotPaid } from "./DpilotPaidContext";

const navItem =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground";
const navActive = "bg-primary/10 text-foreground font-medium";
const navSub = "flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-sm text-muted-foreground transition hover:bg-muted/80 hover:text-foreground border-l-2 border-border/70 ml-1.5";
const navSubActive = "bg-primary/10 text-foreground font-medium";

type PlatKey = "g" | "m" | "t";

function deriveSectionOpen(base: string, pathname: string) {
  return {
    g:
      pathname.startsWith(`${base}/google`) ||
      pathname.startsWith(`${base}/campanhas`) ||
      pathname.startsWith(`${base}/campanhas/nova`),
    m: pathname.startsWith(`${base}/meta`),
    t: pathname.startsWith(`${base}/tiktok`),
  };
}

export function DpilotPaidLayout() {
  const location = useLocation();
  const { projectId, changeRequests } = useDpilotPaid();
  const { projectId: pid } = useParams();
  const base = `/tracking/dpilot/p/${projectId || pid}`;
  const pending = changeRequests.filter((c) => c.status === "pending").length;

  const d = deriveSectionOpen(base, location.pathname);

  /** Quando navega entre rotas, o estado volta ao derivado; o utilizador pode abrir/fechar até mudar de página. */
  const [manual, setManual] = useState<Partial<Record<PlatKey, boolean>>>({});

  useEffect(() => {
    setManual({});
  }, [location.pathname]);

  const og = manual.g ?? d.g;
  const om = manual.m ?? d.m;
  const ot = manual.t ?? d.t;

  const persistId = String(projectId || pid || "anon");
  const lgLayout = useViewportMinWidth(VIEWPORT_LG_MIN_PX);

  const sidebarInner = (
    <>
        <div className="mb-4 space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Studio de anúncios</p>
          <p className="px-1 text-[11px] leading-snug text-muted-foreground">
            Piloto dentro dos seus limites: criação guiada nas três redes. Em modo automático pode publicar sozinho; em modo
            com confirmação, sempre passa primeiro por «Aprovações».
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to={`${base}/visao`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Visão geral
          </NavLink>
          <NavLink to={`${base}/ligacoes`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Link2 className="h-4 w-4 shrink-0" />
            Ligações (OAuth)
          </NavLink>

          <Separator className="my-2 opacity-70" />

          <Collapsible open={og} onOpenChange={(next) => setManual((prev) => ({ ...prev, g: next }))}>
            <CollapsibleTrigger
              type="button"
              className={cn(
                navItem,
                "w-full justify-between font-medium text-foreground/90",
                og && "bg-muted/40 text-foreground",
              )}
              aria-expanded={og}
            >
              <span className="flex items-center gap-2.5">
                <BarChart3 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                Google Ads
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", og && "-rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-none pb-1">
              <div className="flex flex-col gap-0.5 pt-1">
                <NavLink to={`${base}/google`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  Conta e ligações
                </NavLink>
                <NavLink to={`${base}/campanhas/nova`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  <Sparkles className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Nova campanha (assistente)
                </NavLink>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={om} onOpenChange={(next) => setManual((prev) => ({ ...prev, m: next }))}>
            <CollapsibleTrigger
              type="button"
              className={cn(
                navItem,
                "w-full justify-between font-medium text-foreground/90",
                om && "bg-muted/40 text-foreground",
              )}
              aria-expanded={om}
            >
              <span className="flex items-center gap-2.5">
                <Facebook className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                Meta (FB + IG)
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", om && "-rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-none pb-1">
              <div className="flex flex-col gap-0.5 pt-1">
                <NavLink to={`${base}/meta`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  Conta e ligações
                </NavLink>
                <NavLink to={`${base}/meta/campanhas`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  <Workflow className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Campanhas
                </NavLink>
                <NavLink to={`${base}/meta/nova`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  <Sparkles className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Nova campanha (assistente)
                </NavLink>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={ot} onOpenChange={(next) => setManual((prev) => ({ ...prev, t: next }))}>
            <CollapsibleTrigger
              type="button"
              className={cn(
                navItem,
                "w-full justify-between font-medium text-foreground/90",
                ot && "bg-muted/40 text-foreground",
              )}
              aria-expanded={ot}
            >
              <span className="flex items-center gap-2.5">
                <Music2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                TikTok Ads
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", ot && "-rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-none pb-1">
              <div className="flex flex-col gap-0.5 pt-1">
                <NavLink to={`${base}/tiktok`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  Conta e ligações
                </NavLink>
                <NavLink to={`${base}/tiktok/campanhas`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  <Workflow className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Campanhas
                </NavLink>
                <NavLink to={`${base}/tiktok/nova`} className={({ isActive }) => cn(navSub, isActive && navSubActive)} end>
                  <Sparkles className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Nova campanha (assistente)
                </NavLink>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2 opacity-70" />

          <NavLink to={`${base}/campanhas`} className={({ isActive }) => cn(navItem, isActive && navActive)} end>
            <Megaphone className="h-4 w-4 shrink-0" />
            Todas as campanhas
          </NavLink>
          <p className="px-3 pb-1 text-[10px] leading-snug text-muted-foreground">
            Consolida rascunhos e campanhas activas; filtre por rede nos menus Google, Meta ou TikTok acima.
          </p>

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
            Auditoria & motor
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
    </>
  );

  return lgLayout ? (
    <div className="mx-auto flex min-h-[min(880px,calc(100vh-140px))] w-full flex-1 flex-col px-4 py-4">
      <div className="flex min-h-[min(720px,calc(100vh-180px))] flex-1 flex-col rounded-xl border border-border/70 bg-muted/20 p-1">
        <p className="border-b border-border/50 px-3 py-2 text-[10px] leading-snug text-muted-foreground">
          Ponteiro sobre a barra entre menu e página para redimensionar. Guardado só neste navegador por projecto.
        </p>
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId={`dpilot-paid-layout-${persistId}`}
          className="min-h-0 flex-1 rounded-b-lg bg-background"
        >
          <ResizablePanel defaultSize={22} minSize={16} maxSize={42} className="min-w-0">
            <aside className="h-full overflow-y-auto border-r border-border/60 p-3 pr-2">{sidebarInner}</aside>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            title="Redimensionar menu e conteúdo"
            className="w-3 shrink-0 bg-border/70 transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30"
          />
          <ResizablePanel defaultSize={78} minSize={48} className="min-w-0">
            <main className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 pl-3">
              <Outlet />
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-6 px-2 py-4 lg:px-4">
      <aside className="w-full shrink-0">{sidebarInner}</aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
