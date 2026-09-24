import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { analyticsService } from "@/services/analyticsService";
import { presellService } from "@/services/presellService";
import { useAuth } from "@/contexts/AuthContext";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoYmd(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Início: uma pergunta — o que fazer agora?
 * Novo → criar presell. Com dados → 4 KPIs + ver resultados.
 */
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const from = daysAgoYmd(14);
  const to = todayYmd();

  const { data: pages = [], isLoading: loadingPages } = useQuery({
    queryKey: ["presells", "home"],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: dash, isLoading: loadingDash } = useQuery({
    queryKey: ["dashboard", "home", from, to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from, to });
      if (error) throw new Error(error);
      return data;
    },
    enabled: pages.length > 0,
  });

  if (loadingPages) return <LoadingState message="A carregar…" />;

  const isNew = pages.length === 0;
  const clicks = dash?.total_clicks ?? 0;
  const conversions = dash?.approved_sales_count ?? dash?.total_conversions ?? 0;
  const revenue = dash?.revenue ?? 0;
  const rate = dash?.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const currency =
    dash?.media_buyer?.spend_currency || dash?.google_ads_metrics?.currency_code || "EUR";

  if (isNew) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10">
        <PageHeader
          centered
          title={`Bem-vindo${user?.full_name ? `, ${String(user.full_name).split(" ")[0]}` : ""}`}
          description="Crie a sua primeira presell em poucos passos. O tracking fica activo automaticamente."
        />
        <Button
          size="lg"
          className="mt-8 w-full gap-2 gradient-primary border-0 text-primary-foreground"
          onClick={() => navigate("/presells/nova")}
        >
          <Plus className="h-5 w-5" />
          Criar presell
        </Button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já tem conta noutra área?{" "}
          <Link to="/presells" className="text-primary underline-offset-2 hover:underline">
            Ver Presells
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title="Visão geral" description="Últimos 14 dias na sua conta." />
        <Button className="gap-2 shrink-0" onClick={() => navigate("/presells/nova")}>
          <Plus className="h-4 w-4" />
          Nova presell
        </Button>
      </div>

      {loadingDash ? (
        <LoadingState message="A carregar resultados…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Cliques", value: clicks.toLocaleString("pt-PT"), hint: "Humanos (sem bots)" },
            { label: "Vendas", value: conversions.toLocaleString("pt-PT"), hint: "Postback aprovado" },
            {
              label: "Receita",
              value: revenue.toLocaleString("pt-PT", {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              }),
              hint: "Só vendas aprovadas",
            },
            {
              label: "Taxa",
              value: `${rate.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`,
              hint: "Vendas ÷ cliques",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{s.value}</p>
              {"hint" in s && s.hint ? (
                <p className="mt-1 text-[10px] text-muted-foreground leading-snug">{s.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="gap-2" asChild>
        <Link to="/resultados">
          Ver resultados
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
