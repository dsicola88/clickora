import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";
import { type CSSProperties, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyMarketingLandingHead } from "@/lib/marketingSiteSeo";
import { useAuth } from "@/contexts/AuthContext";

const TOC: { id: string; key: MessageKey }[] = [
  { id: "criar-presell-rapido", key: "pages.affiliateGuide.toc1" },
  { id: "super-presell", key: "pages.affiliateGuide.toc2" },
  { id: "ferramenta-para-afiliados", key: "pages.affiliateGuide.toc3" },
  { id: "rastrear-cliques-afiliados", key: "pages.affiliateGuide.toc4" },
  { id: "alternativa-click-tracker", key: "pages.affiliateGuide.toc5" },
  { id: "como-criar-presell-que-converte", key: "pages.affiliateGuide.toc6" },
  { id: "rastrear-cliques-marketing-digital", key: "pages.affiliateGuide.toc7" },
  { id: "erros-afiliados-vendas", key: "pages.affiliateGuide.toc8" },
];

export default function AffiliateGuidePage() {
  const { t } = useAppLocale();
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
                    {t("pages.affiliateGuide.learn")}
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/inicio">{t("pages.affiliateGuide.home")}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/planos">{t("pages.affiliateGuide.plans")}</Link>
                </Button>
                <Button size="sm" className="gap-1.5" asChild>
                  <Link to="/auth?trial=1">
                    {t("pages.affiliateGuide.start")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">
          {t("pages.affiliateGuide.kicker")}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl leading-[1.15]">
          {t("pages.affiliateGuide.headline")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
          {t("pages.affiliateGuide.lede")}
        </p>

        <nav
          className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4 md:p-5"
          aria-label={t("pages.affiliateGuide.tocAria")}
        >
          <p className="text-sm font-semibold text-foreground mb-3">{t("pages.affiliateGuide.inThisArticle")}</p>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-primary underline-offset-4 hover:underline inline-flex gap-2"
                >
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                  {t(item.key)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-12 text-[0.97rem] leading-relaxed text-foreground/90 md:text-base">
          <section id="criar-presell-rapido" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s1Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s1Body")}</p>
            <p className="mt-3">
              <Link to="/presell-para-afiliados" className="text-primary font-medium underline-offset-4 hover:underline">
                {t("pages.affiliateGuide.s1Link")}
              </Link>
            </p>
          </section>

          <section id="super-presell" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s2Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s2Body")}</p>
            <p className="mt-3">{t("pages.affiliateGuide.s2Body2")}</p>
            <p className="mt-3">
              <Link to="/super-presell" className="text-primary font-medium underline-offset-4 hover:underline">
                {t("pages.affiliateGuide.s2Link")}
              </Link>
            </p>
          </section>

          <section id="ferramenta-para-afiliados" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s3Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s3Body")}</p>
          </section>

          <section id="rastrear-cliques-afiliados" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s4Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s4Body")}</p>
            <p className="mt-3">
              <Link
                to="/rastreamento-afiliados"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {t("pages.affiliateGuide.s4Link")}
              </Link>
            </p>
          </section>

          <section id="alternativa-click-tracker" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s5Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s5Body")}</p>
          </section>

          <section id="como-criar-presell-que-converte" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s6Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s6Body")}</p>
          </section>

          <section id="rastrear-cliques-marketing-digital" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s7Title")}
            </h2>
            <p>{t("pages.affiliateGuide.s7Body")}</p>
          </section>

          <section id="erros-afiliados-vendas" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">
              {t("pages.affiliateGuide.s8Title")}
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>{t("pages.affiliateGuide.err1")}</li>
              <li>{t("pages.affiliateGuide.err2")}</li>
              <li>{t("pages.affiliateGuide.err3")}</li>
              <li>{t("pages.affiliateGuide.err4")}</li>
            </ul>
            <p className="mt-4">{t("pages.affiliateGuide.s8Close")}</p>
          </section>
        </div>

        <section className="mt-14 text-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 px-6 py-10 text-white shadow-xl border border-white/10">
          <h2 className="text-xl font-bold tracking-tight">{t("pages.affiliateGuide.ctaTitle")}</h2>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            {t("pages.affiliateGuide.ctaBody")}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
              asChild
            >
              <Link to="/planos">{t("pages.affiliateGuide.viewPlans")}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link to="/auth?trial=1">{t("pages.affiliateGuide.trialCta")}</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link to="/presell-para-afiliados" className="underline-offset-4 hover:underline">
            {t("pages.affiliateGuide.footerPresell")}
          </Link>
          {" · "}
          <Link to="/super-presell" className="underline-offset-4 hover:underline">
            {t("pages.affiliateGuide.footerSuper")}
          </Link>
          {" · "}
          <Link to="/rastreamento-afiliados" className="underline-offset-4 hover:underline">
            {t("pages.affiliateGuide.footerTracking")}
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:underline">
            {t("pages.affiliateGuide.home")}
          </Link>
        </p>
      </article>
    </div>
  );
}
