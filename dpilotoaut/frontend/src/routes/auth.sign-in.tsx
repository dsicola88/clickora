import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { useAuth } from "@/providers/AuthProvider";
import { getAuthConfig, signIn } from "@/server/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

const schema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(128),
});

function SignIn() {
  const navigate = useNavigate();
  const { afterCredentialLogin } = useAuth();
  const [inviteParam, setInviteParam] = useState<string | null>(null);
  const fetchAuthConfig = useServerFn(getAuthConfig);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setInviteParam(sp.get("invite"));
    const g = sp.get("google_error");
    if (g) {
      try {
        setError(decodeURIComponent(g));
      } catch {
        setError(g);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAuthConfig()
      .then((c) => setGoogleEnabled(c.googleSignIn))
      .catch(() => setGoogleEnabled(false));
  }, [fetchAuthConfig]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn({ data: parsed.data });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await afterCredentialLogin(res.user);
      toast.success("Bem-vindo de volta");
      if (inviteParam) {
        await navigate({
          to: "/auth/accept-invite",
          search: { token: inviteParam },
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
    <AuthLayout title="Entrar" subtitle="Bem-vindo de volta ao Paid Autopilot.">
      {googleEnabled && (
        <div className="mb-6 space-y-3">
          <Button variant="outline" className="w-full" asChild>
            <a href="/hooks/auth-google/start" className="inline-flex items-center justify-center gap-2">
              <GoogleGlyph />
              Continuar com Google
            </a>
          </Button>
          <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:left-0 before:top-1/2 before:h-px before:w-[42%] before:bg-border after:absolute after:right-0 after:top-1/2 after:h-px after:w-[42%] after:bg-border">
            <span className="relative bg-card px-2">ou e-mail e senha</span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Novo por aqui?{" "}
        {inviteParam ? (
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={`/auth/sign-up?invite=${encodeURIComponent(inviteParam)}`}
          >
            Criar uma conta
          </a>
        ) : (
          <Link to="/auth/sign-up" className="text-primary underline-offset-4 hover:underline">
            Criar uma conta
          </Link>
        )}
      </p>
    </AuthLayout>
  );
}

export function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.972 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-gradient-glow" />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Paid Autopilot</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
