import { type CSSProperties, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyMarketingLandingHead } from "@/lib/marketingSiteSeo";
import { useAuth } from "@/contexts/AuthContext";

const TOC: { id: string; label: string }[] = [
  { id: "criar-presell-rapido", label: "Criar presell rápido" },
  { id: "ferramenta-para-afiliados", label: "Ferramenta para afiliados" },
  { id: "rastrear-cliques-afiliados", label: "Rastrear cliques (afiliados)" },
  { id: "alternativa-click-tracker", label: "Alternativa ao click tracker" },
  { id: "como-criar-presell-que-converte", label: "Como criar presell que converte" },
  { id: "rastrear-cliques-marketing-digital", label: "Rastrear cliques no marketing digital" },
  { id: "erros-afiliados-vendas", label: "Erros que custam vendas" },
];

export default function AffiliateGuidePage() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    return applyMarketingLandingHead(pathname);
  }, [pathname]);

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
            {user ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link to="/ajuda">
                    <BookOpen className="h-3.5 w-3.5" />
                    Aprender
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/inicio">Início</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/planos">Planos</Link>
                </Button>
                <Button size="sm" className="gap-1.5" asChild>
                  <Link to="/auth?trial=1">
                    Começar <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">
          Recurso · Afiliação
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl leading-[1.15]">
          Guia prático: presell, tracking e conversões para quem vende com tráfego
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
          Da presell rápida ao rastreio no digital — foco em afiliados e CPA com dados.
        </p>

        <nav
          className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4 md:p-5"
          aria-label="Índice do guia"
        >
          <p className="text-sm font-semibold text-foreground mb-3">Neste artigo</p>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-primary underline-offset-4 hover:underline inline-flex gap-2"
                >
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-12 text-[0.97rem] leading-relaxed text-foreground/90 md:text-base">
          <section id="criar-presell-rapido" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Criar presell rápido (sem sacrificar conversão)
            </h2>
            <p>
              Hero alinhado ao anúncio, prova e um CTA — templates e presell + tracking na mesma app reduzem fricção.
            </p>
            <p className="mt-3">
              <Link to="/presell-para-afiliados" className="text-primary font-medium underline-offset-4 hover:underline">
                Ver página dedicada a presell para afiliados →
              </Link>
            </p>
          </section>

          <section id="ferramenta-para-afiliados" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Ferramenta para afiliados: o que validar antes de assinar
            </h2>
            <p>
              Presell + conversões + leitura de campanha no mesmo fluxo — evita relatório solto num Excel.
            </p>
          </section>

          <section id="rastrear-cliques-afiliados" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Rastrear cliques de afiliados com método
            </h2>
            <p>
              Um conjunto UTMs por campanha/criativo; ligue cliques ao que a presell conta — métricas soltas enganam.
            </p>
            <p className="mt-3">
              <Link
                to="/rastreamento-afiliados"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Ver página sobre rastreamento e conversões →
              </Link>
            </p>
          </section>

          <section id="alternativa-click-tracker" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Alternativa ao «click tracker» genérico
            </h2>
            <p>
              No mesmo serviço: mensagem na presell + mesmo motor de clique — menos atribuição partida que um tracker genérico.
            </p>
          </section>

          <section id="como-criar-presell-que-converte" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Como criar presell que converte
            </h2>
            <p>
              Promessa = anúncio, prova específica, CTA rastreado — testar uma hipótese de cada vez para saber o que mexeu na taxa.
            </p>
          </section>

          <section id="rastrear-cliques-marketing-digital" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Como rastrear cliques no marketing digital
            </h2>
            <p>
              UTMs consistentes na rede; evite links sem parâmetros. Queremos origem → presell → oferta sem buracos na linha temporal.
            </p>
          </section>

          <section id="erros-afiliados-vendas" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Erros que fazem afiliados perder vendas
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Presell diferente do anúncio</strong> — abandono antes do CTA.
              </li>
              <li>
                <strong>UTMs misturadas</strong> — não sabe qual campanha pagou conversões.
              </li>
              <li>
                <strong>Muitos CTAs</strong> — um próximo passo claro ganha.
              </li>
              <li>
                <strong>Só beleza nos números</strong> sem clique até à oferta rastreada.
              </li>
            </ul>
            <p className="mt-4">
              Corrigir página e medição rende mais do que só trocar o anúncio.
            </p>
          </section>
        </div>

        <section className="mt-14 text-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 px-6 py-10 text-white shadow-xl border border-white/10">
          <h2 className="text-xl font-bold tracking-tight">Passar teoria a números na tua conta</h2>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            Presell + tracking na mesma conta; planos ou teste grátis com UTMs limpas.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
              asChild
            >
              <Link to="/planos">Ver planos</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link to="/auth?trial=1">Criar conta — teste grátis</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link to="/presell-para-afiliados" className="underline-offset-4 hover:underline">
            Presell para afiliados
          </Link>
          {" · "}
          <Link to="/rastreamento-afiliados" className="underline-offset-4 hover:underline">
            Rastreamento
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:underline">
            Início
          </Link>
        </p>
      </article>
    </div>
  );
}
