import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { Zap, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { toast } from "sonner";
import { loginSchema, registerSchema, recoverySchema, type LoginForm, type RegisterForm, type RecoveryForm } from "@/lib/validations";

type AuthMode = "login" | "register" | "recovery";

function LoginFormComponent({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: "onTouched" });

  const onSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const { error } = await signIn(values.email, values.password);
      if (error) throw new Error(error);
      toast.success("Login realizado com sucesso!");
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao fazer login";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" placeholder="seu@email.com" className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("email")} />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="password" type="password" placeholder="••••••••" className={`pl-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("password")} />
        </div>
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Processando..." : "Entrar"}
      </Button>
    </form>
  );
}

function RegisterFormComponent({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), mode: "onTouched" });

  const onSubmit = async (values: RegisterForm) => {
    setLoading(true);
    try {
      const { error } = await signUp(values.email, values.password, values.fullName);
      if (error) throw new Error(error);
      toast.success("Conta criada com sucesso!");
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao criar conta";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="fullName" placeholder="Seu nome" className={`pl-10 ${errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("fullName")} />
        </div>
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" placeholder="seu@email.com" className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("email")} />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="password" type="password" placeholder="••••••••" className={`pl-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("password")} />
        </div>
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Processando..." : "Criar conta"}
      </Button>
    </form>
  );
}

function RecoveryFormComponent() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RecoveryForm>({ resolver: zodResolver(recoverySchema), mode: "onTouched" });

  const onSubmit = async (values: RecoveryForm) => {
    setLoading(true);
    try {
      const { error } = await authService.resetPassword(values.email);
      if (error) throw new Error(error);
      toast.success("E-mail de recuperação enviado!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar e-mail";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" placeholder="seu@email.com" className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`} {...register("email")} />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Processando..." : "Enviar e-mail"}
      </Button>
    </form>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trialIntent =
    searchParams.get("trial") === "1" ||
    searchParams.get("intent") === "trial";

  const [mode, setMode] = useState<AuthMode>(() => (trialIntent ? "register" : "login"));

  useEffect(() => {
    if (trialIntent) setMode("register");
  }, [trialIntent]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" /> dclickora
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "login" && "Entrar na sua conta"}
            {mode === "register" && (trialIntent ? "Começar o teste grátis" : "Criar sua conta")}
            {mode === "recovery" && "Recuperar senha"}
          </h1>
          <p className="text-muted-foreground mt-2 text-pretty max-w-sm mx-auto">
            {mode === "login" && "Acesse sua plataforma de tracking e presell"}
            {mode === "register" &&
              (trialIntent
                ? "Crie a sua conta sem cartão. Depois, ative o plano Free Trial na página de planos."
                : "Comece gratuitamente com o plano Free Trial")}
            {mode === "recovery" && "Enviaremos um link para redefinir sua senha"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          {mode === "login" && (
            <div className="space-y-6">
              <GoogleSignInButton onSuccess={() => navigate("/inicio")} />
              {import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ? (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou com e-mail</span>
                  </div>
                </div>
              ) : null}
              <LoginFormComponent onSuccess={() => navigate("/")} />
            </div>
          )}
          {mode === "register" && <RegisterFormComponent onSuccess={() => navigate("/inicio")} />}
          {mode === "recovery" && <RecoveryFormComponent />}

          <div className="text-center text-sm space-y-2 mt-4">
            {mode === "login" && (
              <>
                <button type="button" onClick={() => setMode("recovery")} className="text-primary hover:underline block w-full">
                  Esqueceu sua senha?
                </button>
                <p className="text-muted-foreground">
                  Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/auth?trial=1", { replace: true });
                      setMode("register");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Criar conta — teste grátis
                  </button>
                </p>
              </>
            )}
            {mode === "register" && (
              <p className="text-muted-foreground">
                Já tem conta?{" "}
                <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Entrar</button>
              </p>
            )}
            {mode === "recovery" && (
              <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Voltar ao login
              </button>
            )}
          </div>
        </div>
        <p className="text-center mt-6">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Continuar sem entrar — ver planos
          </Link>
        </p>
      </div>
    </div>
  );
}
