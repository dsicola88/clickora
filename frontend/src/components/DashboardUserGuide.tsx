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
    title: "A sua página conta visitas",
    body: (
      <>
        <p>
          Quando usa o link público que acaba em <span className="font-mono text-[11px]">/p/…</span>, já contam impressões e
          cliques — não precisa de colar nada manualmente neste caso.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Detalhes técnicos (opcional)
          </summary>
          <p className="mt-2 leading-relaxed">
            Só em páginas HTML alojadas à parte é que faz sentido o script no elemento{" "}
            <strong className="text-foreground">&lt;head&gt;</strong>; as instruções estão em{" "}
            <strong className="text-foreground">Resumo e guia</strong>.
          </p>
        </details>
      </>
    ),
    links: [
      { to: "/presell/dashboard", label: "Presells" },
      { to: "/tracking/dashboard", label: "Resumo e guia" },
    ],
  },
  {
    id: "step-2",
    title: "O anúncio aponta para a presell",
    body: (
      <>
        <p>
          Use o endereço completo gerado nos separadores{" "}
          <strong className="text-foreground">Links</strong> ou{" "}
          <strong className="text-foreground">Construtor</strong> como destino na rede — assim a própria rede acrescenta
          os marcadores para saber qual anúncio trouxe o visitante.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Nomes técnicos (Google, Meta, TikTok)
          </summary>
          <p className="mt-2 leading-relaxed">
            Exemplos de marcadores nos URLs:{" "}
            <span className="font-mono text-[11px]">gclid</span> (Google),{" "}
            <span className="font-mono text-[11px]">fbclid</span> /{" "}
            <span className="font-mono text-[11px]">fbc</span> (Meta),{" "}
            <span className="font-mono text-[11px]">ttclid</span> (TikTok), conforme a rede.
          </p>
        </details>
      </>
    ),
    links: [
      { to: "/tracking/links", label: "Links de tracking" },
      { to: "/tracking/url-builder", label: "Construtor de URL" },
    ],
  },
  {
    id: "step-2-macros",
    title: "Parâmetros que a própria rede preenche",
    body: (
      <>
        <p>
          Ao montar o link, pode usar «atalhos» oferecidos pelas redes (palavra-chave, número da campanha, etc.).
          Escolha estes placeholders em <strong className="text-foreground">Links</strong> ou{" "}
          <strong className="text-foreground">Construtor</strong> — a rede substitui automaticamente quando alguém clica.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Exemplos (macros / UTMs)
          </summary>
          <p className="mt-2 leading-relaxed">
            Como <span className="font-mono text-[11px]">{`{keyword}`}</span>, ou campos tipo{" "}
            <span className="font-mono text-[11px]">utm_term</span>,{" "}
            <span className="font-mono text-[11px]">sub1</span> conforme cada rede lista na documentação.
          </p>
        </details>
      </>
    ),
    links: [
      { to: "/tracking/links", label: "Links — macros das redes" },
      { to: "/tracking/url-builder", label: "Construtor — macros" },
    ],
  },
  {
    id: "step-3",
    title: "Vendas que vêm das redes de afiliação",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Plataformas</strong> aparece um endereço para colar nas definições da
          rede (tipo Hotmart). Assim cada venda aparece ligada ao clique quando a rede aceita enviar o aviso para a
          Clickora.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Termo técnico
          </summary>
          <p className="mt-2 leading-relaxed">Em muitas redes isto chama-se postback ou webhook — é o mesmo endereço que copiou.</p>
        </details>
      </>
    ),
    links: [{ to: "/tracking/plataformas", label: "Plataformas" }],
  },
  {
    id: "step-4",
    title: "Avisos (Telegram, e-mail…)",
    body: (
      <>
        <p>
          Configure avisos de venda em <strong className="text-foreground">Integrações</strong> quando o seu plano incluir
          (Telegram, notificações no browser, outros canais onde estiver disponível).
        </p>
      </>
    ),
    links: [{ to: "/tracking/integrations", label: "Integrações" }],
  },
  {
    id: "step-5",
    title: "Anunciar no Google, Meta ou TikTok com conversões",
    body: (
      <>
        <p>
          Para contar também o resultado dentro do Google Ads, Meta ou TikTok, siga os passos no{" "}
          <strong className="text-foreground">Resumo e guia</strong>. A Microsoft está entre as ferramentas de modelos —
          consulte as listas lá se usar Bing.
        </p>
      </>
    ),
    links: [
      { to: "/tracking/dashboard", label: "Resumo e guia" },
      { to: "/tracking/tools", label: "Ferramentas" },
    ],
  },
  {
    id: "step-6",
    title: "Ver números e exportar",
    body: (
      <>
        <p>
          Veja tendências nos separadores{" "}
          <strong className="text-foreground">Analytics</strong> ou <strong className="text-foreground">Vendas</strong>, ou
          tabelas com filtro de datas nos <strong className="text-foreground">Relatórios</strong>. À medida que as redes
          enviam os avisos, os totais ficam atualizados.
        </p>
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
        Crie uma <strong className="text-foreground">presell</strong> — o link público acaba em{" "}
        <span className="font-mono text-[11px]">/p/…</span> para usar nos anúncios. Precisa de ajuda ao longo do caminho? Abra o{" "}
        <strong className="text-foreground">Assistente</strong> na barra lateral.
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
        Ajuste links e etiquetas das redes em{" "}
        <strong className="text-foreground">Links</strong> ou <strong className="text-foreground">Construtor</strong>. Todo o texto explicativo está em{" "}
        <strong className="text-foreground">Aprender</strong>.
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
                  : "Ordem sugerida pelos passos abaixo — abra «Detalhes técnicos» só se precisar dos nomes exatos ou do jargão da rede."}
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
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{step.body}</div>
                <StepLinks links={step.links} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

      </CardContent>
    </Card>
  );
}
