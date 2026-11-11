import { useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Zap, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CustomDomainSettings } from "@/components/settings/CustomDomainSettings";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { plansService } from "@/services/plansService";
import type { UserPlan } from "@/types/api";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";

function planTypeLabel(t: UserPlan["plan_type"]): string {
  switch (t) {
    case "free_trial":
      return "Trial (Starter)";
    case "monthly":
      return "Mensal (Pro)";
    case "quarterly":
      return "Trimestral";
    case "annual":
      return "Pro Anual";
    default:
      return t;
  }
}

const APP_THEME_KEY = "clickora:app-theme";

function readAppTheme(): "light" | "dark" {
  try {
    const raw = localStorage.getItem(APP_THEME_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* ignore */
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyAppTheme(next: "light" | "dark") {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem(APP_THEME_KEY, next);
  } catch {
    /* ignore */
  }
}

export default function Settings() {
  const { t } = useAppLocale();
  const { userPlan, refreshUser } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => readAppTheme());
  const [cancelling, setCancelling] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyAppTheme(newTheme);
    toast.success(
      fill(t("pages.settings.themeChanged"), {
        theme: t(newTheme === "dark" ? "pages.settings.themeDark" : "pages.settings.themeLight"),
      }),
    );
  };

  const cancelSubscription = async () => {
    const ok = window.confirm(t("pages.settings.cancelSubscriptionConfirm"));
    if (!ok) return;
    setCancelling(true);
    try {
      const { error } = await plansService.cancel();
      if (error) {
        toast.error(error);
        return;
      }
      await refreshUser();
      toast.success(t("pages.settings.subscriptionCancelled"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Domínio e preferências"
        description="Liga o teu domínio às páginas /p/…. Tema e plano nesta página; perfil em Conta."
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
              {userPlan.max_custom_domains !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Domínios personalizados</span>
                  <span className="text-card-foreground tabular-nums text-right">
                    {userPlan.max_custom_domains === 0
                      ? "Não incluído (use HTML / dclickora)"
                      : `Até ${userPlan.max_custom_domains}`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">Sem plano associado neste momento.</p>
          )}
          <div className="mt-auto space-y-2 pt-2">
            <Button className="w-full gap-2 rounded-xl" variant="secondary" asChild>
              <Link to="/planos">Ver e alterar planos</Link>
            </Button>
            {userPlan ? (
              <Button
                type="button"
                className="w-full gap-2 rounded-xl"
                variant="outline"
                disabled={cancelling}
                onClick={() => void cancelSubscription()}
              >
                {cancelling ? "A cancelar…" : "Cancelar assinatura"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <CustomDomainSettings />
    </div>
  );
}
