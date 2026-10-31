import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppCommandPalette } from "@/components/AppCommandPalette";
import { AppUpdateNotice } from "@/components/AppUpdateNotice";
import { SaleChimeListener } from "@/components/SaleChimeListener";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { Separator } from "@/components/ui/separator";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { cn } from "@/lib/utils";

const mainChrome =
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-10 md:p-5 md:pb-12 lg:p-6 lg:pb-14";

/**
 * Shell app: sidebar encolhível (ícones) estilo tracker — desktop e mobile.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useAppLocale();
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full">
        <SaleChimeListener />
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1">
          <AppUpdateNotice />
          <header
            className={cn(
              "sticky top-0 z-30 relative flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            )}
          >
            <div className="z-10 flex shrink-0 items-center gap-2">
              <SidebarTrigger
                className="h-9 w-9 shrink-0 touch-manipulation md:h-8 md:w-8"
                title={t("chrome.toggleMenu")}
                aria-label={t("chrome.toggleMenu")}
              />
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
            </div>
            {/* Pesquisa centrada no header (padrão Linear / Notion). */}
            <div className="pointer-events-none absolute inset-x-0 flex justify-center px-14 sm:px-28 md:px-36">
              <div className="pointer-events-auto w-full max-w-md md:max-w-lg">
                <AppCommandPalette className="w-full max-w-none" />
              </div>
            </div>
            <div className="z-10 ml-auto flex shrink-0 items-center justify-end gap-2">
              <LocaleSwitcher compact className="hidden sm:flex" />
              <WorkspaceSwitcher />
            </div>
          </header>
          <main className={mainChrome}>{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
