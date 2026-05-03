import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AppSidebar, AppSidebarDocked } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const mainChrome =
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-12 md:p-6 md:pb-14 lg:p-8 lg:pb-16";

export function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      {isMobile ? (
        <div className="flex min-h-svh w-full flex-col">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4 lg:hidden">
              <SidebarTrigger />
              <span className="ml-3 font-extrabold tracking-tight text-foreground">dclickora</span>
            </header>
            <main className={mainChrome}>{children}</main>
          </div>
        </div>
      ) : (
        <div className="flex min-h-svh w-full flex-col md:p-2">
          <div
            className={cn(
              "flex flex-1 flex-col overflow-hidden rounded-none border border-border/60 bg-muted/15 p-1 md:min-h-[calc(100svh-16px)] md:rounded-xl",
            )}
          >
            <p className="border-b border-border/50 px-3 py-2 text-[10px] leading-snug text-muted-foreground md:rounded-t-[calc(0.75rem-2px)]">
              Ponteiro sobre a barra entre o menu principal e esta área para ajustar a largura — guardado neste navegador.
            </p>
            <ResizablePanelGroup
              direction="horizontal"
              autoSaveId="clickora-app-shell-sidebar"
              className="min-h-0 flex-1 rounded-b-xl bg-background"
            >
              <ResizablePanel defaultSize={20} minSize={14} maxSize={40} className="min-w-0">
                <div className="flex h-full min-h-0 flex-col md:rounded-bl-[calc(0.75rem-2px)]">
                  <AppSidebarDocked />
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                title="Redimensionar menu principal e página"
                className="w-3 shrink-0 bg-border/70 transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30"
              />
              <ResizablePanel defaultSize={80} minSize={45} className="min-w-0">
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:rounded-br-[calc(0.75rem-2px)]">
                  <main className={mainChrome}>{children}</main>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
