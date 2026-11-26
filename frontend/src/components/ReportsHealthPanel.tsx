import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";
import type { SyncHealthPayload } from "@/components/SyncHealthBanner";
import { getNextAccountHealthStep, type AccountHealthCheckRow } from "@/lib/accountHealthSteps";

type Props = {
  syncHealth?: SyncHealthPayload | null;
  /** Visitas com sinais de anúncio pagos mas sem ID de clique (só nos separadores de visitas/cliques). */
  paidUntracked?: number;
  checks?: AccountHealthCheckRow[] | null;
  className?: string;
};

type HealthItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  cta: string;
};

/**
 * Um único painel de saúde para Relatórios (substitui a pilha de avisos no topo).
 * - Só mostra o que é acionável: falhas de envio, vendas de origem Google/Meta/TikTok sem ID,
 *   visitas pagas sem rastreio e o próximo passo da conta.
 * - Quando está tudo bem, mostra uma linha discreta de confirmação.
 */
export function ReportsHealthPanel({ syncHealth, paidUntracked = 0, checks, className }: Props) {
  const { t } = useAppLocale();
  const step = getNextAccountHealthStep(checks);
  const sh = syncHealth ?? null;

  const items: HealthItem[] = [];
  if (sh) {
    const tiktokFail = sh.tiktok_events_failed ?? 0;
    const noGclid = sh.google_ads_skipped_no_gclid ?? 0;
    const noFbclid = sh.meta_capi_skipped_no_fbclid ?? 0;
    const noTtclid = sh.tiktok_events_skipped_no_ttclid ?? 0;
    if (sh.google_ads_failed > 0) {
      items.push({
        id: "google-fail",
        label: fill(t("pages.syncHealth.googleFail"), { n: sh.google_ads_failed }),
        href: "/integracoes/google-ads",
        cta: t("common.resolve"),
      });
    }
    if (noGclid > 0) {
      items.push({
        id: "google-no-id",
        label: fill(t("pages.syncHealth.googleNoId"), { n: noGclid }),
        href: "/integracoes/google-ads",
        cta: t("common.resolve"),
      });
    }
    if (sh.meta_capi_failed > 0) {
      items.push({
        id: "meta-fail",
        label: fill(t("pages.syncHealth.metaFail"), { n: sh.meta_capi_failed }),
        href: "/integracoes/pixels",
        cta: t("common.resolve"),
      });
    }
    if (noFbclid > 0) {
      items.push({
        id: "meta-no-id",
        label: fill(t("pages.syncHealth.metaNoId"), { n: noFbclid }),
        href: "/integracoes/pixels",
        cta: t("common.resolve"),
      });
    }
    if (tiktokFail > 0) {
      items.push({
        id: "tiktok-fail",
        label: fill(t("pages.syncHealth.tiktokFail"), { n: tiktokFail }),
        href: "/integracoes/pixels",
        cta: t("common.resolve"),
      });
    }
    if (noTtclid > 0) {
      items.push({
        id: "tiktok-no-id",
        label: fill(t("pages.syncHealth.tiktokNoId"), { n: noTtclid }),
        href: "/integracoes/pixels",
        cta: t("common.resolve"),
      });
    }
  }
  if (paidUntracked > 0) {
    items.push({
      id: "paid-untracked",
      label: fill(t("pages.reports.untrackedVisits"), { n: paidUntracked }),
      hint: t("pages.reports.untrackedBanner"),
      href: "/integracoes/google-ads",
      cta: t("common.resolve"),
    });
  }

  // Sem dados de saúde carregados e sem nada a fazer: não afirmar estado nenhum.
  if (!sh && items.length === 0 && !step) return null;

  if (items.length === 0 && !step) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-2.5 text-sm text-foreground ${className ?? ""}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span>{fill(t("pages.reports.healthOk"), { days: sh?.period_days ?? 30 })}</span>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="reports-health-title"
      className={`rounded-xl border border-amber-500/30 bg-card shadow-card ${className ?? ""}`}
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <h2 id="reports-health-title" className="text-sm font-semibold text-foreground">
          {t("pages.reports.healthTitle")}
        </h2>
        <span className="ml-auto rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-900 dark:text-amber-200">
          {items.length + (step ? 1 : 0)}
        </span>
      </header>
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-foreground">{item.label}</p>
              {item.hint ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" asChild>
              <Link to={item.href}>
                {item.cta}
                <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </Link>
            </Button>
          </li>
        ))}
        {step ? (
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                {t("pages.integrations.nextAction")}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{t(step.titleKey)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {step.detail?.trim() || t(step.descKey)}
              </p>
            </div>
            <Button size="sm" className="shrink-0 gap-1.5" asChild>
              <Link to={step.href}>
                {t("common.resolve")}
                <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </Link>
            </Button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
