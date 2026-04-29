import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/** Usado em Conta para o utilizador voltar a ver o cartão após «Ocultar». */
export const DASHBOARD_USER_GUIDE_DISMISSED_KEY = "dclickora_dashboard_user_guide_dismissed_v1";

type GuideLink = { to: string; label: string };

type GuideStep = {
  id: string;
  title: string;
  body: ReactNode;
  links: GuideLink[];
};

const TRACKING_STEPS: GuideStep[] = [
  {
    id: "step-1",
    title: "Página e medição de cliques",
    body: (
      <>
        Link público <span className="font-mono text-[11px]">/p/…</span> conta impressões/cliques sem colar script; script no{" "}
        <strong className="text-foreground">&lt;head&gt;</strong> só se a página for HTML fora da app — mesma presell nos relatórios.
      </>
    ),
    links: [
      { to: "/presell/dashboard", label: "Presells" },
      { to: "/tracking/dashboard", label: "Script no dashboard" },
    ],
  },
  {
    id: "step-2",
    title: "URLs de anúncio e parâmetros",
    body: (
      <>
        <strong className="text-foreground">Links</strong> ou <strong className="text-foreground">Construtor</strong>: o anúncio aponta ao URL público com{" "}
        <span className="font-mono text-[11px]">gclid</span> / <span className="font-mono text-[11px]">fbclid</span> /{" "}
        <span className="font-mono text-[11px]">ttclid</span> conforme a rede.
      </>
    ),
    links: [
      { to: "/tracking/links", label: "Links de tracking" },
      { to: "/tracking/url-builder", label: "Construtor de URL" },
    ],
  },
  {
    id: "step-2-macros",
    title: "Macros: palavra-chave, campanha, criativo",
    body: (
      <>
        Copie macros das redes (<span className="font-mono text-[11px]">utm_term</span>, <span className="font-mono text-[11px]">sub1</span>…) em{" "}
        <strong className="text-foreground">Links</strong> ou <strong className="text-foreground">Construtor</strong> — a rede substitui no clique.
      </>
    ),
    links: [
      { to: "/tracking/links", label: "Links — Macros das redes" },
      { to: "/tracking/url-builder", label: "Construtor — Macros" },
    ],
  },
  {
    id: "step-3",
    title: "Vendas das redes de afiliados",
    body: (
      <>
        <strong className="text-foreground">Plataformas</strong>: cole o postback na rede de afiliados; e-mail opcional para alertas.
      </>
    ),
    links: [{ to: "/tracking/plataformas", label: "Plataformas" }],
  },
  {
    id: "step-4",
    title: "Notificações e integrações",
    body: (
      <>
        <strong className="text-foreground">Integrações</strong>: Telegram, Web Push e outros webhooks quando o workspace permitir.
      </>
    ),
    links: [{ to: "/tracking/integrations", label: "Integrações" }],
  },
  {
    id: "step-5",
    title: "Google, Meta, TikTok e Microsoft",
    body: (
      <>
        No resumo configure conversões para <strong className="text-foreground">Google</strong>, <strong className="text-foreground">Meta</strong> e{" "}
        <strong className="text-foreground">TikTok</strong>; Microsoft e modelos em <strong className="text-foreground">Ferramentas de tracking</strong>.
      </>
    ),
    links: [
      { to: "/tracking/dashboard", label: "Configuração aqui" },
      { to: "/tracking/tools", label: "Ferramentas / postbacks" },
    ],
  },
  {
    id: "step-6",
    title: "Analisar resultados",
    body: (
      <>
        <strong className="text-foreground">Analytics</strong>, vendas e relatórios com estado de sincronização quando os postbacks estiverem a chegar.
      </>
    ),
    links: [
      { to: "/tracking/analytics", label: "Analytics" },
      { to: "/tracking/vendas", label: "Vendas" },
      { to: "/tracking/relatorios", label: "Relatórios" },
    ],
  },
];

const HOME_STEPS: GuideStep[] = [
  {
    id: "home-1",
    title: "Começar em 30 segundos",
    body: (
      <>
        <strong className="text-foreground">Presell</strong> em <span className="font-mono text-[11px]">/p/…</span> para anúncios;{" "}
        <strong className="text-foreground">Assistente</strong> quando precisar de checklist (postback, redes).
      </>
    ),
    links: [
      { to: "/presell/dashboard", label: "Presells" },
      { to: "/tracking/setup-assistant", label: "Assistente" },
      { to: "/tracking/dashboard", label: "Rastreamento" },
    ],
  },
  {
    id: "home-2",
    title: "Quando precisar de mais",
    body: (
      <>
        Script só com HTML fora da app; macros em <strong className="text-foreground">Links</strong> ou <strong className="text-foreground">Construtor</strong> ·{" "}
        <strong className="text-foreground">Aprender</strong> para o guia completo.
      </>
    ),
    links: [
      { to: "/ajuda", label: "Aprender" },
      { to: "/tracking/links", label: "Links" },
      { to: "/guia-vendas-afiliados", label: "Guia longo (site)" },
    ],
  },
];

function StepLinks({ links }: { links: GuideLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <Button key={l.to + l.label} variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs" asChild>
          <Link to={l.to}>{l.label}</Link>
        </Button>
      ))}
    </div>
  );
}

export type DashboardUserGuideProps = {
  /** `tracking`: guia longo com opção de ocultar. `home`: versão curta na entrada da app. */
  variant?: "tracking" | "home";
  className?: string;
  /**
   * Só aplica a `variant="tracking"`. Se `false`, o bloco nunca fica oculto e não há botão de fechar
   * (útil na rota /ajuda).
   */
  allowDismiss?: boolean;
};

export function DashboardUserGuide({ variant = "tracking", className, allowDismiss = true }: DashboardUserGuideProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (variant !== "tracking" || !allowDismiss) return;
    try {
      setDismissed(localStorage.getItem(DASHBOARD_USER_GUIDE_DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [variant, allowDismiss]);

  if (variant === "tracking" && allowDismiss && dismissed) return null;

  const steps = variant === "home" ? HOME_STEPS : TRACKING_STEPS;
  const defaultOpen = steps[0]?.id ?? "step-1";

  return (
    <Card
      className={cn(
        "border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-card to-primary/[0.04] shadow-sm",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold leading-tight text-foreground">
                {variant === "home" ? "Bem-vindo — por onde começo?" : "Guia rápido — do clique à venda"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {variant === "home"
                  ? "Use os cartões abaixo; o menu traz o resto."
                  : "Ordem típica: medição → URLs/macros → postbacks → integrações → redes → relatórios."}
              </p>
            </div>
          </div>
          {variant === "tracking" && allowDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                try {
                  localStorage.setItem(DASHBOARD_USER_GUIDE_DISMISSED_KEY, "1");
                } catch {
                  /* ignore */
                }
                setDismissed(true);
              }}
              aria-label="Ocultar guia"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <Accordion type="single" collapsible defaultValue={defaultOpen} className="mt-2 w-full">
          {steps.map((step) => (
            <AccordionItem key={step.id} value={step.id} className="border-border/60">
              <AccordionTrigger className="py-3 text-left text-sm font-medium hover:no-underline [&[data-state=open]]:text-primary">
                {step.title}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                <StepLinks links={step.links} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

      </CardContent>
    </Card>
  );
}
