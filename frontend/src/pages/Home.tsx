import { useNavigate } from "react-router-dom";
import { FileText, BarChart3, ArrowRight, Zap } from "lucide-react";
import presellIcon from "@/assets/presell-icon.png";
import trackingIcon from "@/assets/tracking-icon.png";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[80vh] w-full min-w-0 max-w-7xl flex-col justify-center px-4",
        isAdmin ? "space-y-10" : "space-y-6",
      )}
    >
      <div className={cn("text-center", isAdmin ? "space-y-4" : "space-y-2")}>
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-primary-foreground gradient-primary">
          <Zap className="h-4 w-4" /> dclickora
        </div>
        <PageHeader
          centered
          title={isAdmin ? "O que você deseja fazer?" : "O que fazer?"}
          description={
            isAdmin
              ? "Escolha uma das ferramentas para começar. Crie páginas presell ou acompanhe a performance em rastreamento."
              : undefined
          }
        />
      </div>

      <div className={cn("grid w-full max-w-5xl grid-cols-1 self-center md:grid-cols-2", isAdmin ? "gap-6" : "gap-4")}>
        {/* Presell Module */}
        <button
          onClick={() => navigate("/presell/dashboard")}
          className={cn(
            "group bg-card rounded-2xl shadow-card border-2 border-border/50 hover:border-primary hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden",
            isAdmin ? "p-8" : "p-5",
          )}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <img
            src={presellIcon}
            alt="Criador de Páginas"
            width={180}
            height={180}
            className={cn("mx-auto group-hover:scale-105 transition-transform duration-300", isAdmin ? "mb-4" : "mb-3 max-h-[140px] w-auto")}
          />
          <div className="flex items-center gap-3 mb-3">
            <div className="gradient-primary rounded-xl p-2.5">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground">Criador de Presell</h2>
          </div>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Crie páginas presell profissionais que não são bloqueadas pelo Google. Templates prontos, editor visual e publicação com link automático.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">Páginas e link público.</p>
          )}
          <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
            Acessar <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* Tracking Module */}
        <button
          onClick={() => navigate("/tracking/dashboard")}
          className={cn(
            "group bg-card rounded-2xl shadow-card border-2 border-border/50 hover:border-accent hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden",
            isAdmin ? "p-8" : "p-5",
          )}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-accent/5 to-transparent rounded-bl-full" />
          <img
            src={trackingIcon}
            alt="Rastreamento"
            width={180}
            height={180}
            className={cn("mx-auto group-hover:scale-105 transition-transform duration-300", isAdmin ? "mb-4" : "mb-3 max-h-[140px] w-auto")}
          />
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-accent rounded-xl p-2.5">
              <BarChart3 className="h-5 w-5 text-accent-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground">Rastreamento</h2>
          </div>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Rastreie vendas, cliques, impressões e conversões. Integre com plataformas de afiliados e monitore sua performance em tempo real.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">Cliques e vendas.</p>
          )}
          <div className="flex items-center gap-2 text-accent font-medium text-sm group-hover:gap-3 transition-all">
            Acessar <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
