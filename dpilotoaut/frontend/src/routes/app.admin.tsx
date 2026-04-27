import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { FileStack, LayoutDashboard, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/branding";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/auth/sign-in" });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Área reservada a administradores da plataforma (vendedor / operação de produto).
        </p>
        <Button asChild>
          <Link to="/app">Voltar à aplicação</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Operação (comercial)</p>
              <p className="text-xs text-muted-foreground">
                {APP_NAME} — métricas, landings, Hotmart
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminNavPills />
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app">App</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/conta">Conta</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function AdminNavPills() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPanel = pathname === "/app/admin" || pathname === "/app/admin/";
  const isLandings = pathname.startsWith("/app/admin/landings");
  return (
    <nav className="flex items-center gap-1 rounded-md border border-border p-0.5">
      <Link
        to="/app/admin"
        className={cn(
          "inline-flex items-center rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
          isPanel
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
        Painel
      </Link>
      <Link
        to="/app/admin/landings"
        className={cn(
          "inline-flex items-center rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
          isLandings
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <FileStack className="mr-1.5 h-3.5 w-3.5" />
        Landings
      </Link>
    </nav>
  );
}
