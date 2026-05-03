import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DpilotAdsWizardPlatform } from "./DpilotAdsCampaignWizardShell";

const SECTION_ACCENT: Record<DpilotAdsWizardPlatform, string> = {
  google: "border-l-blue-600 dark:border-l-blue-400",
  meta: "border-l-indigo-600 dark:border-l-indigo-400",
  tiktok: "border-l-rose-600 dark:border-l-rose-400",
};

const STEP_DOT: Record<DpilotAdsWizardPlatform, string> = {
  google: "bg-blue-600 shadow-[0_0_0_3px_rgb(37_99_235/0.28)] dark:bg-blue-400 dark:shadow-[0_0_0_3px_rgb(96_165_250/0.25)]",
  meta: "bg-indigo-600 shadow-[0_0_0_3px_rgb(79_70_229/0.28)] dark:bg-indigo-400 dark:shadow-[0_0_0_3px_rgb(129_140_248/0.25)]",
  tiktok:
    "bg-rose-600 shadow-[0_0_0_3px_rgb(225_29_72/0.28)] dark:bg-rose-400 dark:shadow-[0_0_0_3px_rgb(251_113_133/0.25)]",
};

type Props = {
  id: string;
  platform: DpilotAdsWizardPlatform;
  /** Ex.: «Passo 3 de 7» ou «Secção». */
  stepLabel: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Bloco de formulário ao estilo criadores enterprise: numeração, título,
 * texto de suporte e barra lateral de ênfase por plataforma.
 */
export function DpilotWizardFormSection({
  id,
  platform,
  stepLabel,
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 sm:scroll-mt-32",
        /** Espaço entre secções tipo «painel». */
        "rounded-xl border border-border/60 bg-muted/[0.2] p-5 sm:p-6",
        "shadow-sm dark:bg-muted/10",
        className,
      )}
    >
      <header className="mb-6 border-b border-border/70 pb-5">
        <div className={cn("flex gap-4 border-l-[3px] pl-4", SECTION_ACCENT[platform])}>
          <span
            className={cn(
              "mt-1.5 hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block",
              STEP_DOT[platform],
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stepLabel}</p>
            <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground sm:text-lg">{title}</h2>
            {description ? (
              <div className="max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{description}</div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
