import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Layers, LineChart, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { BrandKitProCard } from "@/components/BrandKitProCard";
import { plansService } from "@/services/plansService";
import { enterpriseService } from "@/services/enterpriseService";
import { analyticsService } from "@/services/analyticsService";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Go-to-market Agency (Fase 2): pricing real dos planos + checklist + dual-pillar.
 */
export default function AgencyReadyPage() {
  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansError,
  } = useQuery({
    queryKey: ["plans", "agency"],
    queryFn: async () => {
      const { data, error } = await plansService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: onboarding } = useQuery({
    queryKey: ["enterprise-onboarding", "agency"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getOnboardingStatus();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const from = isoDaysAgo(30);
  const to = isoDaysAgo(0);
  const { data: dash } = useQuery({
    queryKey: ["agency", "proof", from, to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from, to });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const pillars = [
    {
      icon: LineChart,
      t: "Tracking profissional",
      d: "ID de clique estável, avisos de venda da rede, Situação Real/Bot/Cloud, lucro, rotador com limites e regras.",
      href: "/resultados",
    },
    {
      icon: Layers,
      t: "Presell auto + manual",
      d: "Importar página, ligar botões ao rastreamento e publicar com qualidade no nicho Search. Kit de marca incluído.",
      href: "/presells/nova",
    },
    {
      icon: Shield,
      t: "Confiança operativa",
      d: "Avisos de falhas, vendas sem clique atribuído e saúde da conta — sem surpresas no Ads.",
      href: "/integracoes",
    },
  ];

  const arms = dash?.rotator_arm_performance ?? [];
  const clicks = dash?.total_clicks ?? 0;
  const sales = dash?.approved_sales_count ?? dash?.total_conversions ?? 0;
  const onboardingPctLive = onboarding?.progress?.total
    ? Math.round((onboarding.progress.done / onboarding.progress.total) * 100)
    : null;

  const cases = [
    {
      niche: "Esta conta (30 dias)",
      result: dash
        ? `${clicks} visitantes · ${sales} vendas aprovadas · ${arms.length} destino(s) de rotador no lucro.`
        : "A carregar prova da conta…",
    },
    {
      niche: "Rotador / limites",
      result:
        arms.length > 0
          ? arms
              .slice(0, 2)
              .map(
                (a) =>
                  `${a.arm_label}: ${a.clicks} cliques` +
                  (a.max_clicks != null
                    ? ` · limite ${a.clicks_delivered}/${a.max_clicks}`
                    : ""),
              )
              .join(" · ")
          : "Crie um rotador activo — os destinos e limites aparecem em Resultados.",
    },
    {
      niche: "Onboarding Agency",
      result:
        onboarding?.complete
          ? `Checklist essencial completo${onboardingPctLive != null ? ` (${onboardingPctLive}%)` : ""}.`
          : `Progresso ${onboarding?.progress?.done ?? "…"}/${onboarding?.progress?.total ?? "…"} — meta sob 30 min.`,
    },
  ];

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const paidPlans = plans
    .filter((p) => (p.price_cents ?? 0) > 0 || p.name.toLowerCase().includes("pro"))
    .slice(0, 4);

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Pronto para Agency"
        subtitle="Tracking e páginas de pre-sell num só sítio — um login, sem juntar tracker e builder à parte."
      />

      <SyncHealthBanner className="mb-4" syncHealth={dash?.sync_health} />
      <TrackPathStatus className="mb-6" />

      {onboarding ? (
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {onboarding.complete ? "Onboarding essencial completo" : "Onboarding da conta"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {onboarding.progress.done}/{onboarding.progress.total} passos essenciais
              {onboardingPctLive != null ? ` · ${onboardingPctLive}%` : ""}
              {onboarding.complete
                ? " — conta pronta a escalar Ads."
                : " — meta sob 30 min para um buyer sério."}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to={onboarding.complete ? "/resultados" : "/"}>
              {onboarding.complete ? "Ver resultados" : "Abrir checklist"}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {pillars.map((p) => (
          <ProPanel key={p.t} title={p.t}>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.d}</p>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to={p.href}>
                  Abrir
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </ProPanel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        <ProPanel title="Planos (pricing real)" description="Valores do catálogo activo — sem inventar SKUs.">
          <div className="px-4 py-3 space-y-3">
            {plansLoading ? (
              <p className="text-xs text-muted-foreground">A carregar planos…</p>
            ) : plansError ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">Não foi possível carregar o catálogo.</p>
            ) : paidPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem planos pagos no catálogo activo.</p>
            ) : (
              paidPlans.map((p) => (
                <div key={p.id} className="rounded-lg border border-border/50 px-3 py-2.5 flex justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.has_branding === false ? "White-label · " : ""}
                      {p.affiliate_webhook_enabled ? "Postback · " : ""}
                      {p.max_presell_pages != null ? `${p.max_presell_pages} pages` : "Pages"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {(p.price_cents ?? 0) > 0 ? formatPrice(p.price_cents!) : "Sob consulta"}
                  </p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/planos">Comparar planos e activar</Link>
            </Button>
          </div>
        </ProPanel>

        <ProPanel title="Prova desta conta" description="Números reais dos últimos 30 dias — sem cases inventados.">
          <div className="px-4 py-3 space-y-3">
            {cases.map((c) => (
              <div key={c.niche} className="rounded-lg border border-border/50 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{c.niche}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.result}</p>
              </div>
            ))}
          </div>
        </ProPanel>
      </div>

      <div className="mb-8">
        <BrandKitProCard />
      </div>

      <ProPanel title="Onboarding em menos de 30 min" description="Checklist para um media buyer sério.">
        <div className="px-4 py-3 space-y-4">
          <ol className="space-y-2">
            {(onboarding?.steps?.filter((s) => !s.optional).slice(0, 6) ?? []).map((step, i) => (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2
                  className={`h-4 w-4 mt-0.5 shrink-0 ${step.done ? "text-emerald-600" : "text-muted-foreground"}`}
                />
                <Link to={step.href} className="hover:underline">
                  <span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/presells/nova">Começar pela presell</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/planos">Ver planos</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/integracoes">Integrações</Link>
            </Button>
          </div>
        </div>
      </ProPanel>
    </div>
  );
}
