import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-svh flex w-full">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="h-14 flex shrink-0 items-center border-b border-border bg-card px-4 lg:hidden">
            <SidebarTrigger />
            <span className="ml-3 font-extrabold tracking-tight text-foreground">dclickora</span>
          </header>
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-12 md:p-6 md:pb-14 lg:p-8 lg:pb-16">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
