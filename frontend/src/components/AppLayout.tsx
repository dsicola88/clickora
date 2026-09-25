import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const mainChrome =
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-10 md:p-5 md:pb-12 lg:p-6 lg:pb-14";

/**
 * Shell app: sidebar encolhível (ícones) estilo tracker — desktop e mobile.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1">
          <header
            className={cn(
              "sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            )}
          >
            <SidebarTrigger
              className="h-8 w-8"
              title="Encolher / expandir menu"
              aria-label="Encolher ou expandir menu"
            />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-semibold tracking-tight text-foreground md:hidden">dclickora</span>
            <span className="hidden text-[11px] text-muted-foreground md:inline">Menu</span>
          </header>
          <main className={mainChrome}>{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
