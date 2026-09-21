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
    title: "1. Domínio próprio (sem WordPress)",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Configurações</strong>, adicione o seu domínio e aponte o DNS (CNAME/A)
          conforme as instruções. Quando estiver <strong className="text-foreground">verificado</strong>, a presell
          pública fica em <span className="font-mono text-[11px]">https://seu-dominio/p/…</span> — sem WordPress.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Detalhes técnicos (opcional)
          </summary>
          <p className="mt-2 leading-relaxed">
            O SSL e o proxy são do mesmo deploy da Clickora. Sem domínio verificado, pode usar o domínio dclickora.com
            temporariamente; para anúncios profissionais use o seu.
          </p>
        </details>
      </>
    ),
    links: [
      { to: "/configuracoes", label: "Configurações / domínio" },
      { to: "/presells", label: "Presells" },
    ],
  },
  {
    id: "step-2",
    title: "2. Criar e publicar a presell",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Presells → Nova</strong>, cole o hoplink da rede (BuyGoods, SmartAdv,
          Digistore…). A Clickora importa a página, publica e gera o link{" "}
          <span className="font-mono text-[11px]">/p/…</span>. Alternativas: formulário rápido ou editor manual.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Detalhes técnicos (opcional)
          </summary>
          <p className="mt-2 leading-relaxed">
            O CTA da página passa por <span className="font-mono text-[11px]">/track/r/…</span>, que grava o clique e
            redirecciona para a oferta com o ID do clique nos parâmetros da rede.
          </p>
        </details>
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
    title: "3. Campanha e link do anúncio (UTMs + GCLID)",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Campanhas</strong>, copie o URL do anúncio. Já inclui UTMs. No Google
          Ads, o <span className="font-mono text-[11px]">{"{gclid}"}</span> é preenchido pela rede quando alguém clica —
          fica guardado no clique da Clickora.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            Nomes técnicos (Google, Meta, TikTok)
          </summary>
          <p className="mt-2 leading-relaxed">
            <span className="font-mono text-[11px]">gclid</span> (Google),{" "}
            <span className="font-mono text-[11px]">fbclid</span> (Meta),{" "}
            <span className="font-mono text-[11px]">ttclid</span> (TikTok). Sem estes IDs no URL do anúncio, a venda pode
            aparecer na Clickora mas não sincroniza na conta de anúncios.
          </p>
        </details>
      </>
    ),
    links: [
      { to: "/campanhas", label: "Campanhas" },
      { to: "/tracking/url-builder", label: "Construtor de URL (avançado)" },
    ],
  },
  {
    id: "step-4",
    title: "4. Postback na rede de afiliados",
    body: (
      <>
        <p>
          Em <strong className="text-foreground">Integrações → Vendas da rede</strong>, escolha a plataforma (BuyGoods,
          SmartAdv, Digistore24, Hotmart…). Clique <strong className="text-foreground">Copiar com macros</strong> e cole
          esse URL no postback / IPN da rede. Sem este passo, os cliques registam-se mas as vendas não entram.
        </p>
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/90 outline-none hover:underline">
            BuyGoods · SmartAdv · Digistore (o que a Clickora envia)
          </summary>
          <ul className="mt-2 list-disc pl-4 space-y-1 leading-relaxed">
            <li>
              <strong className="text-foreground">BuyGoods:</strong> hoplink recebe{" "}
              <span className="font-mono text-[11px]">subid</span>=UUID; no postback use{" "}
              <span className="font-mono text-[11px]">{"{SUBID}"}</span>.
            </li>
            <li>
              <strong className="text-foreground">SmartAdv:</strong> UUID em{" "}
              <span className="font-mono text-[11px]">sub3</span>; no postback{" "}
              <span className="font-mono text-[11px]">cid={"{sub3}"}</span>.
            </li>
            <li>
              <strong className="text-foreground">Digistore24:</strong>{" "}
              <span className="font-mono text-[11px]">cid</span> /{" "}
              <span className="font-mono text-[11px]">sid1</span> e macros oficiais no S2S.
            </li>
          </ul>
        </details>
      </>
    ),
    links: [
      { to: "/integracoes", label: "Integrações" },
      { to: "/tracking/plataformas-legacy", label: "Postback por rede" },
    ],
  },
  {
    id: "step-5",
    title: "5. Do clique à venda (nada se perde)",
    body: (
      <>
        <p>
          Visitante abre o link da campanha → vê a presell → clica no CTA → Clickora grava o clique (com GCLID se
          houver) e envia o ID à oferta → a rede, na venda, chama o postback → a conversão aparece em{" "}
          <strong className="text-foreground">Resultados → Conversões</strong>, ligada ao clique.
        </p>
        <p className="mt-2 text-xs">
          Se o postback chegar sem ID de clique, a venda <strong className="text-foreground">ainda é registada</strong>{" "}
          (não atribuída) — o registo não se perde; falta só a ligação ao anúncio.
        </p>
      </>
    ),
    links: [
      { to: "/resultados", label: "Resultados" },
      { to: "/resultados/conversoes", label: "Conversões" },
      { to: "/tracking/relatorios/sem-gclid", label: "Vendas sem GCLID" },
    ],
  },
  {
    id: "step-6",
    title: "6. (Opcional) Google Ads / Meta / TikTok",
    body: (
      <>
        <p>
          Em Integrações → Anúncios, ligue a conta para enviar vendas aprovadas de volta (offline / CAPI / Events).
          Exige GCLID / fbclid / ttclid no clique original.
        </p>
      </>
    ),
    links: [
      { to: "/integracoes", label: "Integrações" },
      { to: "/tracking/integrations-legacy", label: "Contas de anúncios" },
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
        Sem postback → sem vendas no painel. Sem GCLID no URL do anúncio → venda na Clickora mas sem upload Google.
        Abra <strong className="text-foreground">Aprender</strong> → percursos guiados para o detalhe.
      </>
    ),
    links: [
      { to: "/ajuda", label: "Aprender" },
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
                  : "Presell sem WordPress, rastreamento, postback (BuyGoods / SmartAdv), GCLID e conversões — na ordem correcta."}
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
