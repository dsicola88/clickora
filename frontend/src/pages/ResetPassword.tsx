import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema, type ResetPasswordForm } from "@/lib/validations";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || new URLSearchParams(window.location.hash.replace("#", "?")).get("token");
    setToken(t);
  }, []);

  const onSubmit = async (values: ResetPasswordForm) => {
    if (!token) return;
    setLoading(true);
    try {
      const { error } = await authService.updatePassword(token, values.password);
      if (error) throw new Error(error);
      toast.success("Senha atualizada com sucesso!");
      navigate("/auth");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar senha";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
          <p className="text-muted-foreground mb-4">Este link de recuperação expirou ou é inválido.</p>
          <Button onClick={() => navigate("/auth")}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" /> dclickora
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nova senha</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-card">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className={`pl-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                {...register("password")}
              />
            </div>
            <FieldError message={errors.password?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                className={`pl-10 ${errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                {...register("confirmPassword")}
              />
            </div>
            <FieldError message={errors.confirmPassword?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
