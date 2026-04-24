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
          Este guia reúne as pesquisas mais comuns — desde <strong>criar presell rápido</strong> até{" "}
          <strong>como rastrear cliques no marketing digital</strong> — com foco em afiliados que precisam de
          CPA previsível e decisões com dados, não com opiniões.
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
              «Rápido» não deve significar página frágil. O segredo é <strong>reutilizar estrutura</strong>: hero
              alinhado ao anúncio, prova (depoimentos, números ou demo) e um único CTA claro para o link de afiliado.
              Quem parte de templates e blocos — em vez de HTML estático reinventado a cada campanha — itera Páginas
              e criativos em paralelo. Na dclickora, a presell e o mesmo ecossistema dos cliques: poupas tempo e
              manténs congruência entre o que o utilizador viu no anúncio e o que lê na página.
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
              Uma <strong>ferramenta para afiliados</strong> útil não é só um gerador de links: junta{" "}
              <strong>presell</strong>, <strong>rastreamento de conversões</strong> e leitura de campanhas (origem,
              meio, criativo). Evita sandes em que o click sai de um sítio, a página vive em outro e o relatório em
              Excel. Quando o fluxo é único, consegues saber qual presell + qual anúncio gerou venda — essencial para
              escalar o que funciona e cortar o resto.
            </p>
          </section>

          <section id="rastrear-cliques-afiliados" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Rastrear cliques de afiliados com método
            </h2>
            <p>
              Para <strong>rastrear cliques</strong> com sentido, defines uma convenção: um link (ou conjunto de
              parâmetros UTM) por campanha e por criativo. Assim comparas canais sem misturar conversões. O próximo
              passo é ligar impressões e cliques ao mesmo universo da tua presell — senão estás a optimizar «cliques
              soltos» que não correspondem à narrativa da página. Um painel que mostra tráfego → presell → clique na
              oferta fecha essa história.
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
              Muitos <strong>click trackers</strong> contam visitas, mas ignoram o contexto da afiliação: presells,
              múltiplos produtos e o caminho até ao checkout do produtor. Uma <strong>alternativa</strong> sólida
              junta o controlo da mensagem na presell com o mesmo motor que regista o clique final. O objetivo não é
              «mais métricas», é <strong>decisões mais rápidas</strong>: pausar anúncio, mudar headline ou duplicar
              criativo com base no que a folha de resultado mostra.
            </p>
          </section>

          <section id="como-criar-presell-que-converte" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Como criar presell que converte
            </h2>
            <p>
              <strong>Como criar presell que converte</strong> costuma resumir-se a três perguntas: (1) O título
              repete a promessa do anúncio? (2) A prova é específica ao nicho (não genérica)? (3) O CTA leva ao link
              certo, rastreado? Se uma falha, o tráfego mais caro não salva. Testa uma variante de headline ou de
              prova de cada vez — senão não sabes o que moveu a taxa de clique para a oferta.
            </p>
          </section>

          <section id="rastrear-cliques-marketing-digital" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Como rastrear cliques no marketing digital
            </h2>
            <p>
              Em marketing digital, <strong>rastrear cliques</strong> é combinar URLs com UTMs consistentes, evitar
              links «nuas» em slides ou vídeo sem parâmetros e rever semanalmente o que alimenta cada campanha. No
              fundo queres uma linha do tempo: de onde veio o clique → o que a pessoa viu na presell → se chegou à
              oferta. Sem isso, optimizar orçamento é adivinhar. Integrar presell + tracking no mesmo serviço reduz
              erros de atribuição e cópia de links errados.
            </p>
          </section>

          <section id="erros-afiliados-vendas" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              Erros que fazem afiliados perder vendas
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Presell desalinhada do criativo</strong> — a pessoa clica por uma promessa e lê outra
                história; sai antes do CTA.
              </li>
              <li>
                <strong>Links sem rastreamento ou com UTMs misturados</strong> — não sabes qual campanha paga as
                conversões.
              </li>
              <li>
                <strong>Muitos CTAs ou distrações</strong> — uma presell de performance vive de um próximo passo
                claro.
              </li>
              <li>
                <strong>Não medir até ao clique na oferta</strong> — impressões bonitas não pagam contas; o
                utilizador tem de chegar ao teu link de afiliado com intenção.
              </li>
            </ul>
            <p className="mt-4">
              Corrigir estes pontos costuma baixar custo por lead mais do que «mudar só o anúncio» sem tocar na página.
            </p>
          </section>
        </div>

        <section className="mt-14 text-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 px-6 py-10 text-white shadow-xl border border-white/10">
          <h2 className="text-xl font-bold tracking-tight">Passar teoria a números na tua conta</h2>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            Testa presells e tracking no mesmo sítio: escolhe um plano ou abre uma conta grátis e liga a tua primeira
            campanha com UTMs consistentes.
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
