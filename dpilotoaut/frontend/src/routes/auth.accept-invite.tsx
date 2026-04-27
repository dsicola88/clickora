import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/AuthProvider";
import { acceptOrganizationInvite } from "@/server/organization.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/accept-invite")({
  validateSearch: (raw: Record<string, unknown>) => ({
    token: typeof raw.token === "string" && raw.token.length > 0 ? raw.token : undefined,
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const accept = useServerFn(acceptOrganizationInvite);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"ok" | "err" | null>(null);
  const didAccept = useRef(false);

  useEffect(() => {
    if (!token || authLoading || !user || didAccept.current) return;
    let cancelled = false;
    (async () => {
      didAccept.current = true;
      setBusy(true);
      try {
        const r = await accept({ data: { token } });
        if (cancelled) return;
        toast.success(
          r.alreadyMember ? "Já era membro deste workspace" : "Entrou no workspace",
        );
        await navigate({ to: "/app", replace: true });
        setDone("ok");
      } catch (e) {
        didAccept.current = false;
        if (cancelled) return;
        setDone("err");
        toast.error("Convite", {
          description: e instanceof Error ? e.message : "Não foi possível aceitar.",
        });
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, authLoading, user, accept, navigate]);

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Falta o parâmetro <code className="rounded bg-muted px-1">token</code> no link.</p>
        <Button asChild variant="outline">
          <a href="/">Início</a>
        </Button>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    const sign = `/auth/sign-in?invite=${encodeURIComponent(token)}`;
    const reg = `/auth/sign-up?invite=${encodeURIComponent(token)}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold">Convite para o workspace</h1>
          <p className="text-sm text-muted-foreground">
            Inicie sessão ou crie uma conta com o e-mail a que o convite se destina. Depois voltará
            aqui automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <a href={sign}>Iniciar sessão</a>
          </Button>
          <Button asChild variant="outline">
            <a href={reg}>Criar conta</a>
          </Button>
        </div>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">A aceitar o convite…</p>
      </div>
    );
  }

  if (done === "err") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-destructive">Não foi possível aceitar o convite. Veja a mensagem acima.</p>
        <Button asChild variant="outline">
          <a href="/app">Abrir aplicação</a>
        </Button>
      </div>
    );
  }

  return null;
}
