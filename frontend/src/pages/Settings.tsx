import { useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Zap, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import type { UserPlan } from "@/types/api";

function planTypeLabel(t: UserPlan["plan_type"]): string {
  switch (t) {
    case "free_trial":
      return "Experimental";
    case "monthly":
      return "Mensal";
    case "quarterly":
      return "Trimestral";
    case "annual":
      return "Anual";
    default:
      return t;
  }
}

export default function Settings() {
  const { userPlan } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    toast.success(`Tema alterado para ${newTheme === "dark" ? "escuro" : "claro"}`);
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Configurações"
        description="Preferências da aplicação e resumo do teu plano. Perfil, senha e foto: menu Conta → Perfil."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="gradient-primary rounded-2xl w-20 h-20 flex items-center justify-center">
              <Zap className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Tema</h3>
            <p className="text-sm text-muted-foreground">Claro ou escuro neste dispositivo.</p>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-3 px-6 py-3 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted transition-colors"
            >
              {theme === "light" ? (
                <>
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-card-foreground">Modo claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 text-blue-400" />
                  <span className="text-sm font-medium text-card-foreground">Modo escuro</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4 flex flex-col">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Plano</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Limites e nome vêm da tua conta.</p>
            </div>
          </div>
          {userPlan ? (
            <div className="space-y-2 text-sm border-t border-border/50 pt-4">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium text-card-foreground text-right">{userPlan.plan_name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ciclo</span>
                <span className="text-card-foreground text-right">{planTypeLabel(userPlan.plan_type)}</span>
              </div>
              {userPlan.max_pages != null && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Máx. páginas presell</span>
                  <span className="text-card-foreground tabular-nums">{userPlan.max_pages}</span>
                </div>
              )}
              {userPlan.max_clicks != null && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Máx. cliques / mês</span>
                  <span className="text-card-foreground tabular-nums">{userPlan.max_clicks.toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">Sem plano associado neste momento.</p>
          )}
          <Button className="w-full mt-auto gap-2 rounded-xl" variant="secondary" asChild>
            <Link to="/">Ver e alterar planos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
