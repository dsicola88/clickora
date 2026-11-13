import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

type Attribution = {
  approved_sales: number;
  attributed_sales: number;
  unattributed_sales: number;
  attribution_rate: number | null;
};

type Check = {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
  href?: string;
};

type Props = {
  attribution?: Attribution | null;
  checks?: Check[] | null;
  className?: string;
  compact?: boolean;
};

/**
 * Alerta de atribuição / postback — Fase 0 do dual-pillar.
 * Mostra vendas sem clique e checklist de postback.
 */
export function AttributionHealthBanner({ attribution, checks, className, compact }: Props) {
  const { t } = useAppLocale();
  const unattr = attribution?.unattributed_sales ?? 0;
  const postback = checks?.find((c) => c.id === "postback_configured");
  // API already returns a percent (e.g. 80.5 = 80.5%) — do not rescale.
  const rate =
    attribution?.attribution_rate != null
      ? Math.round(attribution.attribution_rate * 10) / 10
      : null;

  if (!attribution && !postback) return null;

  const bad = unattr > 0 || postback?.ok === false;
  if (!bad && compact) return null;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        bad
          ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-emerald-500/30 bg-emerald-500/5 text-foreground",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {bad ? (
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden />
        )}
        <div className="min-w-0 space-y-1">
          {unattr > 0 ? (
            <p className="font-medium leading-snug">
              {fill(t("pages.home.attributionUnlinked"), { n: unattr })}
              {rate != null
                ? fill(t("pages.home.attributionRateSuffix"), { rate })
                : ""}
            </p>
          ) : (
            <p className="font-medium leading-snug">
              {t("pages.home.attributionOk")}
              {attribution && attribution.approved_sales > 0 && rate != null
                ? fill(t("pages.home.attributionOkRate"), { rate })
                : ""}
            </p>
          )}
          {unattr > 0 ? (
            <p className="text-xs opacity-90 leading-relaxed">
              {t("pages.home.attributionHintBefore")}{" "}
              <code className="font-mono text-[10px]">{"{SUBID2}"}</code>{" "}
              {t("pages.home.attributionHintMid")}{" "}
              <code className="font-mono text-[10px]">{"{sid1}"}</code>.{" "}
              <Link to="/integracoes/postback" className="font-medium underline underline-offset-2">
                {t("pages.home.attributionOpenPostback")}
              </Link>
            </p>
          ) : null}
          {postback?.ok === false ? (
            <p className="text-xs opacity-90 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
              <span>
                {postback.detail || t("pages.home.attributionPostbackMissing")}{" "}
                <Link
                  to={postback.href || "/integracoes/postback"}
                  className="font-medium underline underline-offset-2"
                >
                  {t("pages.home.attributionConfigure")}
                </Link>
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
