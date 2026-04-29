import { useNavigate, Link } from "react-router-dom";
import { FileText, BarChart3, ArrowRight, Zap, ListChecks, Megaphone } from "lucide-react";
import presellIcon from "@/assets/presell-icon.png";
import trackingIcon from "@/assets/tracking-icon.png";
import { PageHeader } from "@/components/PageHeader";
import { DashboardUserGuide } from "@/components/DashboardUserGuide";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const dpilotUnlocked = userCanAccessDpilotAds(user, isSuperAdmin);

  return (
    <div className="mx-auto flex min-h-[80vh] w-full min-w-0 max-w-7xl flex-col justify-center space-y-10 px-4">
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-primary-foreground gradient-primary">
          <Zap className="h-4 w-4" /> dclickora
        </div>
        <PageHeader
          centered
          title="O que você deseja fazer?"
          description={
            <>
              Presell, rastreamento ou anúncios (Premium). Primeira vez:{" "}
              <Link
                to="/tracking/setup-assistant"
                className="text-primary font-medium underline-offset-4 hover:underline inline-flex items-center gap-1"
              >
                <ListChecks className="h-3.5 w-3.5 shrink-0" />
                Assistente
              </Link>
              .
            </>
          }
        />
      </div>

      <div className="w-full max-w-3xl self-center">
        <DashboardUserGuide variant="home" />
      </div>

      <div className="grid w-full max-w-6xl grid-cols-1 gap-6 self-center md:grid-cols-2 xl:grid-cols-3">
        {/* Presell Module */}
        <button
          onClick={() => navigate("/presell/dashboard")}
          className="group bg-card rounded-2xl p-8 shadow-card border-2 border-border/50 hover:border-primary hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <img src={presellIcon} alt="Criador de Páginas" width={180} height={180} className="mx-auto mb-4 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex items-center gap-3 mb-3">
            <div className="gradient-primary rounded-xl p-2.5">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground">Criador de Presell</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Automática (URL) ou manual (editor); anúncios com o link /p/….
          </p>
          <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
            Acessar <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* Tracking Module */}
        <button
          onClick={() => navigate("/tracking/dashboard")}
          className="group bg-card rounded-2xl p-8 shadow-card border-2 border-border/50 hover:border-accent hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-accent/5 to-transparent rounded-bl-full" />
          <img src={trackingIcon} alt="Rastreamento" width={180} height={180} className="mx-auto mb-4 group-hover:scale-105 transition-transform duration-300" />
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-accent rounded-xl p-2.5">
              <BarChart3 className="h-5 w-5 text-accent-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground">Rastreamento</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Cliques, conversões e vendas no período escolhido.
          </p>
          <div className="flex items-center gap-2 text-accent font-medium text-sm group-hover:gap-3 transition-all">
            Acessar <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate(dpilotUnlocked ? "/tracking/dpilot" : "/planos")}
          className="group bg-card rounded-2xl p-8 shadow-card border-2 border-border/50 hover:border-primary hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden md:col-span-2 xl:col-span-1"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <div className="mx-auto mb-4 flex h-[180px] w-[180px] items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <div className="rounded-2xl bg-primary/10 p-10 ring-2 ring-primary/20">
              <Megaphone className="h-16 w-16 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="gradient-primary rounded-xl p-2.5">
              <Megaphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground">Anúncios</h2>
            {!dpilotUnlocked && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Premium
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Google/Meta com revisão humana (Premium); Pro = presell + tracking.
          </p>
          <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
            {dpilotUnlocked ? "Abrir anúncios" : "Ver planos Premium"} <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
