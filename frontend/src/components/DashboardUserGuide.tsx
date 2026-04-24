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
        Se o tráfego abre o <strong className="text-foreground">link público da app</strong>{" "}
        (<span className="font-mono text-[11px]">/p/…</span>), <strong className="text-foreground">não precisa de colar o script</strong>: no
        carregamento regista-se a impressão (pixel) e os CTAs já apontam para o redirect de tracking. Para validar, na rede do navegador veja pedidos
        a <span className="font-mono text-[11px]">/track/pixel/</span> e, ao clicar, a <span className="font-mono text-[11px]">/track/r/</span>.
        Cole o <strong className="text-foreground">script</strong> da secção «Script da presell» (neste dashboard){" "}
        <strong className="text-foreground">só se publicar o HTML noutro sítio</strong> — aí o snippet liga medições à mesma presell.
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
        Monte o URL em <strong className="text-foreground">Links</strong> ou no <strong className="text-foreground">Construtor de URL</strong>{" "}
        (presell pública + query). Para Google o clique deve trazer <span className="font-mono text-[11px]">gclid</span>; para Meta,{" "}
        <span className="font-mono text-[11px]">fbclid</span> — o anúncio aponta para o URL público da página.
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
        Nos ecrãs <strong className="text-foreground">Links</strong> e <strong className="text-foreground">Construtor de URL</strong>, abra{" "}
        <strong className="text-foreground">Macros das redes</strong> ou <strong className="text-foreground">Macros (referência)</strong>: pesquise
        por rede, copie o marcador (ex. Google <span className="font-mono text-[11px]">{"{keyword}"}</span>, Meta{" "}
        <span className="font-mono text-[11px]">{"{{ad.name}}"}</span>) e cole em{" "}
        <span className="font-mono text-[11px]">utm_term</span>, <span className="font-mono text-[11px]">utm_content</span> ou{" "}
        <span className="font-mono text-[11px]">sub1</span>–<span className="font-mono text-[11px]">sub3</span>. A rede substitui pelo valor real
        no clique; os relatórios mostram esses campos.
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
        Em <strong className="text-foreground">Plataformas</strong>, copie o postback com macros e configure-o na rede (IPN/postback). Opcional:
        defina o e-mail para alertas de venda.
      </>
    ),
    links: [{ to: "/tracking/plataformas", label: "Plataformas" }],
  },
  {
    id: "step-4",
    title: "Notificações e integrações",
    body: (
      <>
        Ative <strong className="text-foreground">Telegram</strong>, <strong className="text-foreground">Web Push</strong> ou consulte o webhook
        global de afiliados na área de Integrações (consoante as suas permissões no workspace).
      </>
    ),
    links: [{ to: "/tracking/integrations", label: "Integrações" }],
  },
  {
    id: "step-5",
    title: "Google Ads, Meta e Microsoft",
    body: (
      <>
        Neste dashboard configure <strong className="text-foreground">Google Ads</strong> (OAuth e conversões) e <strong className="text-foreground">Meta CAPI</strong>.
        Para <strong className="text-foreground">Microsoft Ads</strong> use o URL de postback e macros indicados em Ferramentas de tracking — modelo
        diferente do Google.
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
        Veja tráfego em Analytics, lista de vendas e relatórios de conversões (inclui estado de envio para Google/Meta quando aplicável).
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
    title: "Escolher o que fazer primeiro",
    body: (
      <>
        O <strong className="text-foreground">Criador de Presell</strong> serve para páginas e o link público <span className="font-mono text-[11px]">/p/…</span>.
        O módulo <strong className="text-foreground">Rastreamento</strong> regista cliques, conversões, vendas de redes e ligação a anúncios.
      </>
    ),
    links: [
      { to: "/presell/dashboard", label: "Ir para Presell" },
      { to: "/tracking/dashboard", label: "Ir para Rastreamento" },
    ],
  },
  {
    id: "home-2",
    title: "Presell + tracking",
    body: (
      <>
        Com o link <span className="font-mono text-[11px]">/p/…</span>, o rastreamento base já vem na página publicada. No{" "}
        <strong className="text-foreground">dashboard de Rastreamento</strong> use o script apenas para HTML alojado fora da app; aí copie e cole no{" "}
        <span className="font-mono text-[11px]">head</span> ou antes de <span className="font-mono text-[11px]">&lt;/body&gt;</span>.
      </>
    ),
    links: [{ to: "/tracking/dashboard", label: "Abrir dashboard de rastreamento" }],
  },
  {
    id: "home-3",
    title: "Passo a passo, macros e relatórios",
    body: (
      <>
        No <strong className="text-foreground">dashboard de Rastreamento</strong> há o guia em passos (script, links, plataformas, integrações).
        Para <strong className="text-foreground">palavra-chave e parâmetros dinâmicos</strong> das redes, use{" "}
        <strong className="text-foreground">Links</strong> ou o <strong className="text-foreground">Construtor de URL</strong> (macros). O
        <strong className="text-foreground"> guia completo no painel</strong> (passo a passo) está em{" "}
        <span className="text-foreground">Ajuda</span> — quem quiser ainda pode abrir o artigo longo (SEO) no site.
      </>
    ),
    links: [
      { to: "/ajuda", label: "Aprender (centro de ajuda)" },
      { to: "/tracking/dashboard", label: "Dashboard de rastreamento" },
      { to: "/tracking/links", label: "Links e macros" },
      { to: "/guia-vendas-afiliados", label: "Artigo longo (público)" },
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
              <h2 className="text-base font-semibold leading-tight text-foreground">Guia rápido — do clique à venda</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {variant === "home"
                  ? "Resumo para começar. Rastreamento, links com UTMs e macros das redes estão a um clique."
                  : "Ordem sugerida: medição (script só se a página for externa ao /p/…) → URLs e macros (keyword em utm_term / sub1–3) → postbacks → integrações → anúncios → relatórios. Expanda cada passo quando precisar."}
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
