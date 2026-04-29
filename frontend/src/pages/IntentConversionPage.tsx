import { type CSSProperties, useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, BarChart3, Gauge, LayoutTemplate, LineChart, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyMarketingLandingHead } from "@/lib/marketingSiteSeo";
type IntentKey = "presell" | "tracking";

type IntentConfig = {
  key: IntentKey;
  h1: string;
  lead: string;
  body: string[];
  bullets: { icon: typeof LayoutTemplate; title: string; text: string }[];
  forWho: string[];
  otherIntentHref: string;
  otherIntentLabel: string;
};

const INTENTS: Record<IntentKey, IntentConfig> = {
  presell: {
    key: "presell",
    h1: "Presell pages feitas para quem já traz tráfego e precisa converter",
    lead: "Presell entre anúncio e oferta; estrutura, VSL e CTAs ligados ao rastreamento.",
    body: [
      "Tu controlas narrativa e prova; a página default do produto não chega quando compras tráfego.",
      "Presell + tracking na mesma app — medir e otimizar no mesmo sítio.",
    ],
    bullets: [
      {
        icon: LayoutTemplate,
        title: "Editor com foco em conversão",
        text: "Blocos para carta, hero, galeria e CTAs sem partir do zero em código.",
      },
      {
        icon: Sparkles,
        title: "Export e presença de marca",
        text: "HTML, domínio próprio e URL pública pronta para anúncios.",
      },
      {
        icon: Link2,
        title: "Ligação ao link de afiliado",
        text: "Cliques e parâmetros para saber presell + criativo que vendem.",
      },
    ],
    forWho: [
      "Afiliados em Meta, Google ou vídeo.",
      "Quem já testou só a landing do produtor.",
      "Media buyers a iterar A/B com métricas no mesmo painel.",
    ],
    otherIntentHref: "/rastreamento-afiliados",
    otherIntentLabel: "Quero foco em rastreamento e relatórios",
  },
  tracking: {
    key: "tracking",
    h1: "Rastreamento de conversões e cliques para campanhas de afiliados",
    lead: "Centraliza links, UTMs e performance presell → oferta.",
    body: [
      "Contexto afiliação: tráfego → presell → clique com métricas para orçamento.",
      "Mesma conta para página e números — menos atrito para otimizar CPA.",
    ],
    bullets: [
      {
        icon: LineChart,
        title: "Painel de performance",
        text: "Impressões, cliques e conversões por campanha e origem.",
      },
      {
        icon: Gauge,
        title: "Links e UTMs organizados",
        text: "URLs consistentes sem folha à parte.",
      },
      {
        icon: BarChart3,
        title: "Pronto para o teu fluxo",
        text: "Teste → mede → ajusta em ciclos curtos.",
      },
    ],
    forWho: [
      "Afiliados com tráfego pago e ROI por campanha.",
      "Quem já tem presell e falta fechar conversões.",
      "Equipas que partilham links e precisam de um painel.",
    ],
    otherIntentHref: "/presell-para-afiliados",
    otherIntentLabel: "Quero destacar presell pages primeiro",
  },
};

const PATH_TO_INTENT: Record<string, IntentKey> = {
  "/presell-para-afiliados": "presell",
  "/rastreamento-afiliados": "tracking",
};

export default function IntentConversionPage() {
  const { pathname } = useLocation();
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const key = PATH_TO_INTENT[normalized];
  const cfg = key ? INTENTS[key] : null;

  useEffect(() => {
    return applyMarketingLandingHead(pathname);
  }, [pathname]);

  if (!cfg) {
    return <Navigate to="/" replace />;
  }

  const navSurface: CSSProperties = {
    backgroundColor: "hsl(var(--background) / 0.9)",
    borderColor: "hsl(var(--border) / 0.6)",
  };

  return (
    <div className="min-h-svh w-full bg-background text-foreground">
      <header
        className="sticky top-0 z-40 border-b border-border/60 py-3 backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md"
        style={navSurface}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 md:px-6">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-600 to-amber-500 bg-clip-text text-transparent"
          >
            dclickora
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/planos">Planos</Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link to="/auth?trial=1">
                Começar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-3">
          {cfg.key === "presell" ? "Presell pages" : "Rastreamento & conversões"}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl md:text-[2.35rem] leading-[1.15]">
          {cfg.h1}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">{cfg.lead}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button size="lg" className="w-full sm:w-auto min-w-[200px] text-base shadow-lg shadow-teal-500/20" asChild>
            <Link to="/planos">Ver planos e preços</Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px] text-base" asChild>
            <Link to="/auth?trial=1">Criar conta — teste grátis</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sem compromisso no registo; compara limites de presells e cliques nos cartões de plano.
        </p>

        <section className="mt-14 space-y-4" aria-labelledby="intent-body">
          <h2 id="intent-body" className="sr-only">
            Detalhes
          </h2>
          {cfg.body.map((p) => (
            <p key={p.slice(0, 48)} className="text-base leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </section>

        <section className="mt-12" aria-labelledby="beneficios">
          <h2 id="beneficios" className="text-lg font-semibold tracking-tight mb-6">
            O que levas na prática
          </h2>
          <ul className="space-y-6">
            {cfg.bullets.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-6 md:px-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Para quem é esta solução</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            {cfg.forWho.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12 text-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 px-6 py-10 text-white shadow-xl border border-white/10">
          <h2 className="text-xl font-bold tracking-tight">Pronto para assinar e escalar?</h2>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            Escolhe o plano que cabe no teu volume de presells e cliques. Mudas ou fazes upgrade quando fizer sentido.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
              asChild
            >
              <Link to="/planos">Comparar planos</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link to="/auth">Já tenho conta — entrar</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link to={cfg.otherIntentHref} className="text-primary font-medium underline-offset-4 hover:underline">
            {cfg.otherIntentLabel}
          </Link>
          {" · "}
          <Link to="/guia-vendas-afiliados" className="underline-offset-4 hover:underline">
            Guia: presell e tracking
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:underline">
            Início
          </Link>
        </p>
      </main>
    </div>
  );
}
