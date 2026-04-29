import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  LifeBuoy,
  Link2,
  Puzzle,
  Rocket,
  Search,
  ShoppingBag,
  UserCircle,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DashboardUserGuide } from "@/components/DashboardUserGuide";
import { APP_PAGE_SHELL_LOOSE } from "@/lib/appPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LEARN_HUB_CATEGORIES,
  LEARN_HUB_SECTION_PERCURSOS_ID,
  type LearnHubCategory,
} from "@/lib/learnHubCategories";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  comecar: Rocket,
  presells: FileText,
  rastreamento: Link2,
  conversoes: ShoppingBag,
  "relatorios-analytics": BarChart3,
  integracoes: Puzzle,
  ferramentas: Wrench,
  problemas: LifeBuoy,
  conta: UserCircle,
};

function categorySearchBlob(cat: LearnHubCategory): string {
  const kw = (cat.keywords ?? []).join(" ");
  const hints = cat.links.map((l) => `${l.label} ${l.hint ?? ""}`).join(" ");
  return `${cat.title} ${cat.description} ${kw} ${hints}`.toLowerCase();
}

function filterCategories(query: string): LearnHubCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return LEARN_HUB_CATEGORIES;

  return LEARN_HUB_CATEGORIES.map((cat) => {
    const blob = categorySearchBlob(cat);
    if (blob.includes(q)) {
      return cat;
    }
    const links = cat.links.filter((l) => {
      const lb = `${l.label} ${l.hint ?? ""} ${l.to}`.toLowerCase();
      return lb.includes(q);
    });
    if (links.length === 0) return null;
    return { ...cat, links };
  }).filter((c): c is LearnHubCategory => c != null);
}

/**
 * Centro «Aprender»: categorias, pesquisa e atalhos (organização tipo knowledge base).
 * Os percursos em accordion reutilizam o `DashboardUserGuide`.
 */
export default function InAppUserGuidePage() {
  const { hash } = useLocation();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => filterCategories(search), [search]);

  useEffect(() => {
    const id = hash.replace(/^#/, "").trim();
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className={cn(APP_PAGE_SHELL_LOOSE, "pb-12")}>
      <PageHeader
        centered
        title="Aprender"
        description="Artigos por tema e pesquisa; atalhos e resolução de problemas (GCLID, postbacks)."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-3xl mx-auto w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por tema, rede, UTM, presell…"
            className="pl-9 h-11 bg-background"
            aria-label="Pesquisar no centro de ajuda"
          />
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
          <a href={`#${LEARN_HUB_SECTION_PERCURSOS_ID}`}>
            <BookOpen className="h-4 w-4" />
            Percursos guiados
          </a>
        </Button>
      </div>

      {filtered.length > 0 ? (
        <nav
          className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto"
          aria-label="Saltar para secção"
        >
          {filtered.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="inline-flex items-center rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-sm hover:bg-muted/80 hover:border-primary/30 transition-colors"
            >
              {cat.title}
            </a>
          ))}
        </nav>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum resultado. Limpe a pesquisa ou tente outra palavra-chave.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] ?? BookOpen;
          return (
            <section
              key={cat.id}
              id={cat.id}
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/50 shadow-sm p-5 space-y-4 transition-shadow hover:shadow-md hover:border-primary/15"
            >
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold leading-tight text-foreground">{cat.title}</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
                </div>
              </div>
              <ul className="space-y-0.5 border-t border-border/50 pt-3">
                {cat.links.map((link) => {
                  const isHashOnly = link.to.startsWith("#");
                  const isAjudaHash = link.to.startsWith("/ajuda#");
                  if (isHashOnly || isAjudaHash) {
                    const to = isAjudaHash ? link.to : `/ajuda${link.to}`;
                    return (
                      <li key={`${cat.id}-${to}-${link.label}`}>
                        <Link
                          to={to}
                          className="group flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-primary hover:bg-primary/5"
                        >
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100" />
                          <span className="min-w-0 leading-snug">{link.label}</span>
                        </Link>
                        {link.hint ? (
                          <p className="pl-7 pr-2 pb-1 text-[11px] text-muted-foreground leading-snug">{link.hint}</p>
                        ) : null}
                      </li>
                    );
                  }
                  return (
                    <li key={`${cat.id}-${link.to}-${link.label}`}>
                      <Link
                        to={link.to}
                        className="group flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-primary hover:bg-primary/5"
                      >
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100" />
                        <span className="min-w-0 leading-snug">{link.label}</span>
                      </Link>
                      {link.hint ? (
                        <p className="pl-7 pr-2 pb-1 text-[11px] text-muted-foreground leading-snug">{link.hint}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div
        id={LEARN_HUB_SECTION_PERCURSOS_ID}
        className="scroll-mt-24 max-w-4xl mx-auto space-y-8 pt-4 border-t border-border/60"
      >
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Percursos guiados no painel
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            O mesmo conteúdo dos cartões de boas-vindas e do «Resumo e guia» — passo a passo com botões para abrir cada
            ecrã.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Entrada: o que fazer primeiro</h3>
            <DashboardUserGuide variant="home" allowDismiss={false} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Do clique à venda</h3>
            <DashboardUserGuide variant="tracking" allowDismiss={false} />
          </div>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto border-border/60 bg-muted/15">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Artigo longo no site (SEO)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Versão pública com mais texto corrido — presell, tracking e erros comuns. Abre sem a barra lateral do
              painel.
            </p>
          </div>
          <Button variant="secondary" className="shrink-0 gap-2" asChild>
            <Link to="/guia-vendas-afiliados">
              Abrir guia público <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
