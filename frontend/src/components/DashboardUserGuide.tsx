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

/** Percurso operacional completo — sem WordPress, domínio próprio, postback e GCLID. */
const TRACKING_STEPS: GuideStep[] = [
  {
    id: "step-1",
    title: "1. Domínio próprio",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Configurações → Domínio</strong>, adicione o seu domínio e cole os
          valores do cartão no painel onde o comprou. Quando estiver{" "}
          <strong className="text-foreground">Pronto para anúncios</strong>, use esse link nos anúncios.
        </p>
      </>
    ),
    links: [
      { to: "/configuracoes/dominio", label: "Configurações / domínio" },
      { to: "/presells", label: "Presells" },
    ],
  },
  {
    id: "step-2",
    title: "2. Criar e publicar a presell",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Presells → Nova</strong>, cole o link da oferta (BuyGoods, SmartAdv,
          Digistore…). A Clickora importa a página e gera o link para o anúncio.
        </p>
      </>
    ),
    links: [
      { to: "/presells/nova", label: "Nova presell" },
      { to: "/presells", label: "Lista de presells" },
      { to: "/presell/builder", label: "Editor manual" },
    ],
  },
  {
    id: "step-3",
    title: "3. Link do anúncio",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Campanhas</strong>, copie o URL e cole no Google Ads, Meta ou TikTok.
          A Clickora guarda o ID do clique da rede para ligar a venda ao anúncio.
        </p>
      </>
    ),
    links: [
      { to: "/campanhas", label: "Campanhas" },
      { to: "/tracking/url-builder", label: "Construtor de URL (avançado)" },
    ],
  },
  {
    id: "step-4",
    title: "4. Aviso de venda na rede",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Integrações → Vendas da rede</strong>, escolha a plataforma e clique em{" "}
          <strong className="text-foreground">Copiar</strong>. Cole esse URL no aviso de venda da rede. Sem isto, os
          cliques entram mas as vendas não.
        </p>
      </>
    ),
    links: [
      { to: "/integracoes", label: "Integrações" },
      { to: "/integracoes/postback", label: "Postback por rede" },
    ],
  },
  {
    id: "step-5",
    title: "5. Do clique à venda",
    body: (
      <>
        <p>
          Anúncio → presell → clique na oferta → a rede avisa a venda → aparece em{" "}
          <strong className="text-foreground">Resultados → Conversões</strong>.
        </p>
      </>
    ),
    links: [
      { to: "/resultados", label: "Resultados" },
      { to: "/resultados/funil", label: "Funil" },
      { to: "/resultados/conversoes", label: "Conversões" },
    ],
  },
  {
    id: "step-6",
    title: "6. (Opcional) Google Ads / Meta / TikTok",
    body: (
      <>
        <p>
          Em Integrações, ligue a conta de anúncios para enviar vendas aprovadas de volta à rede.
        </p>
      </>
    ),
    links: [
      { to: "/integracoes", label: "Integrações" },
      { to: "/integracoes/avancado", label: "Contas de anúncios" },
    ],
  },
];

const HOME_STEPS: GuideStep[] = [
  {
    id: "home-1",
    title: "Começar em 4 passos",
    body: (
      <>
        <ol className="list-decimal pl-4 space-y-1.5">
          <li>
            Domínio em <strong className="text-foreground">Configurações</strong> (ou use dclickora entretanto).
          </li>
          <li>
            <strong className="text-foreground">Nova presell</strong> com o hoplink da rede.
          </li>
          <li>
            <strong className="text-foreground">Integrações</strong> → postback BuyGoods / SmartAdv / Digistore.
          </li>
          <li>
            Copie o link em <strong className="text-foreground">Campanhas</strong> para o anúncio.
          </li>
        </ol>
      </>
    ),
    links: [
      { to: "/presells/nova", label: "Nova presell" },
      { to: "/integracoes", label: "Integrações" },
      { to: "/ajuda", label: "Aprender (guia completo)" },
    ],
  },
  {
    id: "home-2",
    title: "Quando algo falha",
    body: (
      <>
        Sem aviso de venda → sem vendas no painel. Sem o link correcto no anúncio → a venda pode não ligar à Google.
        Abra <strong className="text-foreground">Aprender</strong> para o detalhe.
      </>
    ),
    links: [
      { to: "/ajuda", label: "Aprender" },
      { to: "/resultados/funil", label: "Funil" },
      { to: "/resultados/conversoes", label: "Conversões" },
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
                {variant === "home" ? "Bem-vindo — por onde começo?" : "Guia operacional — do domínio à venda"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {variant === "home"
                  ? "Quatro passos para estar a correr. Detalhe completo em Aprender."
                  : "Domínio, presell, aviso de venda e link do anúncio — na ordem correcta."}
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
