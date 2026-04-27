import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { useAuth } from "@/providers/AuthProvider";
import { getAuthConfig, signUp } from "@/server/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, GoogleGlyph } from "./auth.sign-in";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
});

const schema = z.object({
  fullName: z.string().trim().min(1, "Obrigatório").max(100),
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
});

function SignUp() {
  const navigate = useNavigate();
  const { afterCredentialLogin } = useAuth();
  const [inviteParam, setInviteParam] = useState<string | null>(null);
  const fetchAuthConfig = useServerFn(getAuthConfig);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInviteParam(new URLSearchParams(window.location.search).get("invite"));
    }
    void fetchAuthConfig()
      .then((c) => setGoogleEnabled(c.googleSignIn))
      .catch(() => setGoogleEnabled(false));
  }, [fetchAuthConfig]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSubmitting(true);
    try {
      const inv = inviteParam;
      const res = await signUp({ data: { ...parsed.data, skipBootstrap: Boolean(inv) } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await afterCredentialLogin(res.user);
      toast.success(
        inv ? "Conta criada. A juntar ao workspace…" : "Conta criada. Configurando seu workspace…",
      );
      if (inv) {
        await navigate({
          to: "/auth/accept-invite",
          search: { token: inv },
          replace: true,
        });
        return;
      }
      await navigate({ to: "/app", replace: true });
    } catch (err) {
      console.error(err);
      setError(
        "Não foi possível contactar o servidor. Confirme que `npm run dev` está a correr e veja a consola (F12) → Rede.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Criar conta" subtitle="Seu workspace fica pronto em segundos.">
      {googleEnabled && (
        <div className="mb-6 space-y-3">
          <Button variant="outline" className="w-full" asChild>
            <a href="/hooks/auth-google/start" className="inline-flex items-center justify-center gap-2">
              <GoogleGlyph />
              Continuar com Google
            </a>
          </Button>
          <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:left-0 before:top-1/2 before:h-px before:w-[42%] before:bg-border after:absolute after:right-0 after:top-1/2 after:h-px after:w-[42%] after:bg-border">
            <span className="relative bg-card px-2">ou registe-se com e-mail</span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        {inviteParam ? (
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={`/auth/sign-in?invite=${encodeURIComponent(inviteParam)}`}
          >
            Entrar
          </a>
        ) : (
          <Link to="/auth/sign-in" className="text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        )}
      </p>
    </AuthLayout>
  );
}
