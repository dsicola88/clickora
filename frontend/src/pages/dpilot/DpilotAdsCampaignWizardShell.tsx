import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  backHref: string;
  backLabel?: string;
  readiness?: ReactNode;
  children: ReactNode;
};

/**
 * Moldura comum aos assistentes de campanha — hierarquia tipo painel enterprise,
 * navegação entre secções persistente e identidade por rede.
 */
export function DpilotAdsCampaignWizardShell({
  platform,
  platformBadge,
  steps,
  title = "Criar campanha",
  subtitle,
  hint,
  backHref,
  backLabel = "Sair do assistente",
  readiness,
  children,
}: ShellProps) {
  const t = PLATFORM_THEME[platform];

  return (
    <div className="pb-16">
      {/* Fundo suave — separa o fluxo do resto da app */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />

      <div className="mx-auto max-w-5xl space-y-6">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/80 bg-card",
            "shadow-[0_2px_24px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)]",
            "dark:shadow-[0_2px_32px_-12px_rgba(0,0,0,0.65)] dark:ring-1 dark:ring-border/50",
            "border-l-[4px]",
            t.border,
          )}
        >
          <div className={cn("h-[3px] w-full bg-gradient-to-r opacity-[0.95]", t.ribbon)} aria-hidden />
          <div className="space-y-5 p-6 sm:p-8 sm:pb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full shadow-sm", t.dot)} aria-hidden />
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Assistente de campanhas
                  </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem] sm:leading-tight">
                  {title}
                </h1>
                <div className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</div>
                {hint ? (
                  <div className="max-w-3xl rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground dark:bg-muted/15">
                    {hint}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Badge variant="outline" className={cn("justify-center px-3 py-1 text-xs font-medium", t.badge)}>
                  {platformBadge}
                </Badge>
                <Button variant="outline" size="sm" className="whitespace-nowrap" asChild>
                  <Link to={backHref}>{backLabel}</Link>
                </Button>
              </div>
            </div>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-muted-foreground/90">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-0.5 font-medium text-foreground/80 dark:bg-muted/30">
                <ListTree className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Rascunho no navegador
              </span>
              <span className="text-muted-foreground/80">
                Nada é publicado até gerar o plano e usar «Aplicar na rede» quando autorizado pelo seu modo Copilot /
                guardrails.
              </span>
            </p>
          </div>
        </div>

        <div
          className={cn(
            "-mx-1 rounded-xl border border-border/70 bg-background/90 px-3 py-3 shadow-sm backdrop-blur-md",
            "sm:-mx-0 sm:px-4",
            "sticky top-2 z-20",
          )}
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Índice do fluxo</p>
            <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:inline">{steps.length} secções</span>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Índice do assistente de campanha">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
                  "border-border/80 bg-muted/30 text-[11px] font-medium text-muted-foreground",
                  "hover:border-primary/30 hover:bg-muted/55 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "shadow-sm dark:bg-muted/20",
                  "active:border-primary/40",
                )}
              >
                <span className="mr-1.5 inline-flex h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-md border border-border/70 bg-background/95 text-[10px] font-semibold tabular-nums text-muted-foreground shadow-sm">
                  {i + 1}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {readiness ? <div>{readiness}</div> : null}

        <div
          className={cn(
            "space-y-6 rounded-2xl border border-border/70 bg-card/80 p-5 sm:p-8",
            "shadow-[inset_0_1px_0_0_hsl(var(--border)/0.5)] dark:bg-card/50",
          )}
        >
          {children}
        </div>

        <p className="px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
          Alterações ficam apenas neste dispositivo até submeter. Ligações OAuth e guardrails aplicam-se no servidor ao
          publicar.
        </p>
      </div>
    </div>
  );
}
