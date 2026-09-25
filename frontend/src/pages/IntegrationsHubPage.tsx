import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Megaphone, Plug, XCircle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";
import { analyticsService } from "@/services/analyticsService";
import { rangeLast14Days } from "@/lib/dateRangePresets";
import { useMemo } from "react";

/**
 * Hub Integrações — fluxo profissional com checklist ao vivo.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const range = useMemo(() => rangeLast14Days(), []);

  const { data: dash } = useQuery({
    queryKey: ["dashboard", "integrations-health", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from: range.from, to: range.to });
      if (error) return null;
      return data;
    },
    staleTime: 60_000,
  });

  const health = dash?.account_health;
  const steps = [
    {
      t: "Presell publicada",
      d: "Crie a página com o hoplink da rede. A Clickora injeta o ID do clique (BuyGoods: subid · SmartAdv: sub3 · Digistore: cid).",
      id: "presell_published",
      href: "/presells/nova",
    },
    {
      t: "Postback na rede",
      d: "Em Vendas da rede, escolha BuyGoods ou SmartAdv, copie o URL com macros e cole no painel da plataforma.",
      id: "postback_configured",
      href: "/integracoes/postback",
    },
    {
      t: "Anúncio com o link da Clickora",
      d: "Use o URL da campanha (UTMs + gclid). A Google substitui {keyword} e {adgroupid} no clique real.",
      id: "campaign_linked",
      href: "/campanhas",
    },
    {
      t: "Google Ads + custos",
      d: "Ligue OAuth e sincronize custos para ROAS do período. Automizer em dry-run primeiro.",
      id: "google_ads",
      href: "/integracoes/automizer",
    },
  ] as const;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Integrações"
        description="Do anúncio à venda atribuída: postback da rede + (opcional) envio ao Google / Meta / TikTok."
      />

      {health ? (
        <section className="rounded-xl border border-border/60 bg-card p-4 max-w-2xl mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Saúde operacional</p>
              <p className="text-xs text-muted-foreground">Últimos 14 dias · ver detalhe em Resultados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold tabular-nums ${
                health.score >= 85 ? "text-emerald-600" : health.score >= 60 ? "text-amber-600" : "text-destructive"
              }`}
            >
              {health.score}%
            </span>
            <Link to="/resultados" className="text-xs text-primary hover:underline">
              Abrir
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border/60 bg-card p-5 max-w-2xl mb-2">
        <h2 className="text-sm font-semibold text-foreground mb-3">Go-live (checklist)</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {steps.map((s, i) => {
            const check = health?.checks.find((c) => c.id === s.id);
            const ok = check?.ok;
            return (
              <li key={s.t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                    {ok === true ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    ) : ok === false ? (
                      <XCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
                    )}
                    {s.t}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed">{check?.detail || s.d}</p>
                  {ok === false ? (
                    <Link to={s.href} className="text-xs text-primary hover:underline mt-1 inline-block">
                      Resolver →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 max-w-2xl">
        <Link
          to="/integracoes/automizer"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground flex items-center gap-2">
              Automizer &amp; custos
              <Badge variant="secondary" className="text-[10px]">
                Pro
              </Badge>
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Sync diário Google/Meta/TikTok · pausa keywords sem receita · dry-run primeiro · auditoria de acções.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
        </Link>
        <Link
          to="/integracoes/postback"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">1. Vendas da rede (Postback)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              BuyGoods, SmartAdv, Digistore24, Hotmart e outras. Obrigatório para conversões no painel.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar postback <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/tracking/integrations-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">2. Google / Meta / TikTok (envio)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Offline conversions, CAPI e Events — opcional, depois do postback estar a bater.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar envio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {dpilot ? (
          <Link
            to="/dpilot"
            className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">dPilot Ads</h2>
              <p className="mt-1 text-sm text-muted-foreground">Copilot / Autopilot Google Search (módulo do plano).</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
