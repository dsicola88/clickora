import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";

/** Mostrado em `/app` quando ainda não existe sub-rota (ex.: utilizador sem projectos após o bootstrap). */
export const Route = createFileRoute("/app/")({
  component: AppIndexEmpty,
});

function AppIndexEmpty() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
        <Bot className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Ainda sem projecto</h1>
        <p className="text-sm text-muted-foreground">
          A sua conta ainda não tem um <strong>projecto</strong> de paid media. Numa instalação
          local, na raiz do repositório execute{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">npm run db:setup</code> (ou crie projecto
          pelo registo).
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="default">
          <Link to="/auth/sign-up">Criar conta (novo workspace)</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">{APP_NAME}</Link>
        </Button>
      </div>
    </div>
  );
}
