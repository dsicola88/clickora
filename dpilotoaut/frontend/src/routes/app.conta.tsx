import { createFileRoute, Link } from "@tanstack/react-router";
import { User, LayoutDashboard, Shield } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/branding";

function ContaPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Link
            to="/app"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Voltar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">A sua conta</h1>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Sessão</CardTitle>
            </div>
            <CardDescription>E-mail e acesso comercial (quando existir)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            {user.fullName && (
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="text-sm font-medium">{user.fullName}</p>
              </div>
            )}

            {user.isPlatformAdmin && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Administrador da plataforma</p>
                    <p className="text-xs text-muted-foreground">
                      Vendedor: métricas, landings, Hotmart, assinaturas e gráficos.
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="default">
                        <Link to="/app/admin">
                          <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                          Painel
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/admin/landings">Landings</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/app/conta")({
  component: ContaPage,
});
