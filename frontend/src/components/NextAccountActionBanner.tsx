import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  getNextAccountHealthStep,
  type AccountHealthCheckRow,
} from "@/lib/accountHealthSteps";

type Props = {
  checks?: AccountHealthCheckRow[] | null;
  className?: string;
};

/** Next-action canónico a partir de account_health — Início / Integrações / Relatórios. */
export function NextAccountActionBanner({ checks, className }: Props) {
  const { t } = useAppLocale();
  const step = getNextAccountHealthStep(checks);
  if (!step) return null;

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-3"
      }
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {t("pages.integrations.nextAction")}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{t(step.titleKey)}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
          {step.detail?.trim() || t(step.descKey)}
        </p>
      </div>
      <Button size="sm" className="gap-1.5 shrink-0" asChild>
        <Link to={step.href}>
          {t("common.resolve")}
          <ArrowRight className="h-3.5 w-3.5 opacity-80" />
        </Link>
      </Button>
    </div>
  );
}
