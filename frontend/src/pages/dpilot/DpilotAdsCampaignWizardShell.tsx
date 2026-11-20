import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { paidModeCanonicalLine } from "@/lib/paidModeCopy";
import { cn } from "@/lib/utils";

export type DpilotAdsWizardPlatform = "google" | "meta" | "tiktok";

export type DpilotAdsWizardStep = { id: string; label: string };

const PLATFORM_THEME: Record<
  DpilotAdsWizardPlatform,
  { border: string; badge: string; dot: string; ribbon: string }
> = {
  google: {
    border: "border-l-blue-600 dark:border-l-blue-500",
    badge: "border-blue-500/25 bg-blue-500/[0.08] text-blue-950 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-50",
    dot: "bg-blue-600 dark:bg-blue-400",
    ribbon: "from-blue-600 via-blue-500/80 to-blue-400/30",
  },
  meta: {
    border: "border-l-indigo-600 dark:border-l-indigo-500",
    badge:
      "border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-950 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-50",
    dot: "bg-indigo-600 dark:bg-indigo-400",
    ribbon: "from-indigo-600 via-indigo-500/80 to-indigo-400/30",
  },
  tiktok: {
    border: "border-l-rose-600 dark:border-l-rose-500",
    badge: "border-rose-500/25 bg-rose-500/[0.08] text-rose-950 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-50",
    dot: "bg-rose-600 dark:bg-rose-400",
    ribbon: "from-rose-600 via-rose-500/80 to-rose-400/30",
  },
};

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type ShellProps = {
  platform: DpilotAdsWizardPlatform;
  /** Rótulo curto da rede (ex.: "Google Ads · Pesquisa"). */
  platformBadge: string;
  steps: DpilotAdsWizardStep[];
  title?: string;
  /** Frase de valor — aparece abaixo do título. */
  subtitle: ReactNode;
  /** Opcional: segunda linha menor (ex.: alinhamento técnico ao assistente da rede). */
  hint?: ReactNode;
  /** Modo Paid do projecto — frase canónica no chrome do assistente. */
  paidMode?: string | null;
  backHref: string;
  backLabel?: string;
  readiness?: ReactNode;
  children: ReactNode;
};

/**
 * Moldura do assistente — ampla, poucas caixas, hierarquia clara.
 */
export function DpilotAdsCampaignWizardShell({
  platform,
  platformBadge,
  steps,
  title = "Criar campanha",
  subtitle,
  hint,
  paidMode,
  backHref,
  backLabel = "Sair do assistente",
  readiness,
  children,
}: ShellProps) {
  const { t: tr } = useAppLocale();
  const t = PLATFORM_THEME[platform];
  const modeLine = paidModeCanonicalLine(paidMode, tr);

  return (
    <div className="pb-20">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,hsl(var(--primary)/0.05),transparent)]" />

      <div className="mx-auto max-w-6xl space-y-8">
        <header className={cn("border-l-[3px] pl-5 sm:pl-6", t.border)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Assistente
                </span>
                <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[11px] font-medium", t.badge)}>
                  {platformBadge}
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">
                {title}
              </h1>
              <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</div>
              {hint ? (
                <div className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground/90">{hint}</div>
              ) : null}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground/75">
                  <ListTree className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  Rascunho local
                </span>
                <span aria-hidden>·</span>
                <span>{modeLine}</span>
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 self-start" asChild>
              <Link to={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </header>

        <nav
          className="sticky top-2 z-20 -mx-1 rounded-lg border border-border/50 bg-background/95 px-2 py-2 shadow-sm backdrop-blur-md sm:mx-0 sm:px-3"
          aria-label="Índice do assistente de campanha"
        >
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                aria-label={`Passo ${i + 1}: ${s.label}`}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors",
                  "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="mr-1.5 tabular-nums text-muted-foreground/70">{i + 1}.</span>
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {readiness ? <div className="max-w-3xl">{readiness}</div> : null}

        <div className="space-y-10">{children}</div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Alterações ficam neste dispositivo até submeter. OAuth e guardrails aplicam-se ao publicar.
        </p>
      </div>
    </div>
  );
}
