import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DpilotAdsWizardPlatform } from "./DpilotAdsCampaignWizardShell";

const SECTION_ACCENT: Record<DpilotAdsWizardPlatform, string> = {
  google: "border-l-blue-600 dark:border-l-blue-400",
  meta: "border-l-indigo-600 dark:border-l-indigo-400",
  tiktok: "border-l-rose-600 dark:border-l-rose-400",
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
 * Secção do assistente — sem caixa aninhada; só hierarquia tipográfica e acento.
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
      className={cn("scroll-mt-24 space-y-6 border-b border-border/50 pb-10 last:border-b-0 last:pb-0", className)}
    >
      <header className={cn("space-y-1.5 border-l-[3px] pl-4", SECTION_ACCENT[platform])}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stepLabel}</p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {description ? (
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
      </header>
      <div className="space-y-5 sm:pl-1">{children}</div>
    </section>
  );
}
