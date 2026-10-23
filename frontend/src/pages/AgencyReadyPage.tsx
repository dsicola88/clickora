import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Layers, LineChart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";

/**
 * Go-to-market Agency / profissionais (Fase 2): o que um media buyer top espera.
 */
export default function AgencyReadyPage() {
  const pillars = [
    {
      icon: LineChart,
      t: "Tracking profissional",
      d: "Click ID estável, postbacks multi-rede, Situação Real/Bot/Datacenter, P&L com custos Ads, rotador lander→oferta.",
      href: "/resultados/relatorios/cliques",
    },
    {
      icon: Layers,
      t: "Presell auto + manual",
      d: "Import da oferta, CTAs no /track/r, domínio próprio, checklist «pronta a anunciar».",
      href: "/presells/nova",
    },
    {
      icon: Shield,
      t: "Confiança operativa",
      d: "Request-id, alertas de vendas sem atribuição, blacklist manual, health da conta.",
      href: "/integracoes",
    },
  ];

  const onboarding = [
    "Criar conta e publicar 1ª presell (< 15 min)",
    "Copiar postback com macros (MaxWeb: SUBID2)",
    "Ligar domínio ou usar URL pública",
    "Colar URL do anúncio / rotador no Google Ads",
    "Ver cliques Real vs Bot e primeira venda atribuída",
  ];

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Pronto para Agency"
        subtitle="Dois pilares num produto: tracking de referência + presell de referência — para profissionais que pagam Voluum e ainda usam um builder à parte."
      />

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

      <ProPanel title="Onboarding em menos de 30 min" description="Checklist para um media buyer sério.">
        <div className="px-4 py-3 space-y-4">
          <ol className="space-y-2">
            {onboarding.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>
                  {step}
                </span>
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
          </div>
        </div>
      </ProPanel>
    </div>
  );
}
