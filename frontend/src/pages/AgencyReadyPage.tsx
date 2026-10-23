import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Layers, LineChart, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { BrandKitProCard } from "@/components/BrandKitProCard";
import { plansService } from "@/services/plansService";
import { enterpriseService } from "@/services/enterpriseService";

/**
 * Go-to-market Agency (Fase 2): pricing real dos planos + checklist + dual-pillar.
 */
export default function AgencyReadyPage() {
  const { data: plans = [] } = useQuery({
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

  const pillars = [
    {
      icon: LineChart,
      t: "Tracking profissional",
      d: "Click ID estável, postbacks multi-rede, Situação Real/Bot/Datacenter, P&L, rotador com caps e regras.",
      href: "/resultados",
    },
    {
      icon: Layers,
      t: "Presell auto + manual",
      d: "Import → bake CTAs → gate publish. Brand kit e qualidade elite no nicho Search.",
      href: "/presells/nova",
    },
    {
      icon: Shield,
      t: "Confiança operativa",
      d: "Request-id, alertas burst 5xx, unattributed, SLO p95, health da conta.",
      href: "/integracoes",
    },
  ];

  const cases = [
    {
      niche: "Nutra Search (US/CA/AU)",
      result:
        "Ads → rotador/presell → hoplink com click id; P&L com custo Google; Situação separa bot/datacenter antes de escalar.",
    },
    {
      niche: "Ecom / MaxWeb",
      result: "Postback SUBID2 estável; checklist de macros no hub; primeira venda atribuída no mesmo dia de setup.",
    },
    {
      niche: "Agência multi-conta",
      result: "Workspaces + white-label Pro; onboarding medido; brand kit sincronizado com a conta.",
    },
  ];

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const paidPlans = plans
    .filter((p) => (p.price_cents ?? 0) > 0 || p.name.toLowerCase().includes("pro"))
    .slice(0, 4);

  const onboardingPct = onboarding?.progress?.total
    ? Math.round((onboarding.progress.done / onboarding.progress.total) * 100)
    : null;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Pronto para Agency"
        subtitle="Stack dual-pillar: tracking de referência + presell de referência — um login, sem Voluum + builder à parte."
      />

      <TrackPathStatus className="mb-6" />

      {onboarding && !onboarding.complete ? (
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Onboarding da conta</p>
            <p className="text-[11px] text-muted-foreground">
              {onboarding.progress.done}/{onboarding.progress.total} passos essenciais
              {onboardingPct != null ? ` · ${onboardingPct}%` : ""} — meta sob 30 min para um buyer sério.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/">Abrir checklist</Link>
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
            {paidPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">A carregar planos…</p>
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

        <ProPanel title="Referências de uso" description="Padrões que buyers top esperam.">
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
