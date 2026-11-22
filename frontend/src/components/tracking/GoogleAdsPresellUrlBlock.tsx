import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGoogleAdsPresellUrlParts } from "@/lib/googleAdsPresellUrl";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type UrlLayoutMode = "oneField" | "twoFields";

function displayPathHint(finalUrl: string): string {
  try {
    const u = new URL(finalUrl);
    const host = u.hostname.replace(/^www\./i, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const path = segs.length > 0 ? segs.join(" / ") : "—";
    return `${host} › ${path}`;
  } catch {
    return "";
  }
}

type Props = {
  basePresellUrl: string;
  campaignName: string;
  trafficSource?: string;
  className?: string;
  /** Estilo editor manual (PresellTrackingHealthPanel). */
  editorChrome?: boolean;
  disabled?: boolean;
};

export function GoogleAdsPresellUrlBlock({
  basePresellUrl,
  campaignName,
  trafficSource = "Google Ads",
  className,
  editorChrome = false,
  disabled = false,
}: Props) {
  const { t } = useAppLocale();
  const parts = useMemo(
  () => buildGoogleAdsPresellUrlParts(basePresellUrl.trim(), campaignName, trafficSource),
    [basePresellUrl, campaignName, trafficSource],
  );
  const [copied, setCopied] = useState<"final" | "suffix" | "combined" | null>(null);
  const [layout, setLayout] = useState<UrlLayoutMode>("oneField");

  const copy = async (which: "final" | "suffix" | "combined") => {
    const text =
      which === "final"
        ? parts.finalUrl
        : which === "suffix"
          ? parts.finalUrlSuffix
          : parts.combinedTrackingUrl;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success(
      which === "final"
        ? t("pages.createPresell.copyFinalUrlDone")
        : which === "suffix"
          ? t("pages.createPresell.copySuffixDone")
          : t("pages.createPresell.copyCombinedUrlDone"),
    );
    setTimeout(() => setCopied(null), 2000);
  };

  const labelClass = cn(
    "text-[11px] font-medium",
    editorChrome ? "text-editor-fg-muted" : "text-muted-foreground",
  );
  const monoClass = cn(
    "break-all font-mono text-[11px] sm:text-xs leading-relaxed select-all rounded-lg border px-3 py-2.5",
    editorChrome ? "border-editor-border/60 bg-editor-panel text-editor-fg/90" : "border-border/60 bg-background text-foreground/90",
  );

  if (!parts.finalUrl) return null;

  const showCombined = Boolean(parts.combinedTrackingUrl && parts.finalUrlSuffix);
  const pathHint = displayPathHint(parts.finalUrl);

  useEffect(() => {
    if (!showCombined) setLayout("twoFields");
  }, [showCombined]);

  const copyRow = (
    which: "final" | "suffix" | "combined",
    label: string,
    variant: "default" | "outline" = "outline",
  ) => (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      className={cn("gap-1.5", editorChrome && variant === "outline" && "border-editor-border bg-editor-panel text-editor-fg")}
      onClick={() => void copy(which)}
    >
      {copied === which ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "inline-flex rounded-lg border p-0.5 text-[11px]",
          editorChrome ? "border-editor-border/60 bg-editor-panel/40" : "border-border/60 bg-muted/40",
        )}
        role="tablist"
        aria-label={t("pages.createPresell.googleAdsUrlLayoutLabel")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={layout === "oneField"}
          disabled={disabled || !showCombined}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            layout === "oneField" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            (!showCombined || disabled) && layout !== "oneField" && "opacity-60",
          )}
          onClick={() => setLayout("oneField")}
        >
          {t("pages.createPresell.googleAdsUrlLayoutOneField")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={layout === "twoFields"}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            layout === "twoFields" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setLayout("twoFields")}
        >
          {t("pages.createPresell.googleAdsUrlLayoutTwoFields")}
        </button>
      </div>

      {layout === "oneField" && !showCombined ? (
        <div className="space-y-2 rounded-lg border border-border/60 px-3 py-3">
          <p className={labelClass}>{t("pages.createPresell.finalUrlFieldLabel")}</p>
          <p className={monoClass}>{parts.finalUrl}</p>
          {copyRow("final", t("pages.createPresell.copyFinalUrl"), "default")}
        </div>
      ) : null}

      {layout === "oneField" && showCombined ? (
        <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3">
          <p className={cn(labelClass, "text-foreground")}>{t("pages.createPresell.combinedUrlFieldLabel")}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.createPresell.combinedUrlHint")}</p>
          {pathHint ? (
            <p className="text-[11px] text-muted-foreground">
              {t("pages.createPresell.googleAdsUrlDisplayHint")}{" "}
              <span className="font-medium text-foreground/80">{pathHint}</span>
            </p>
          ) : null}
          <p className={monoClass}>{parts.combinedTrackingUrl}</p>
          {copyRow("combined", t("pages.createPresell.copyCombinedUrl"), "default")}
        </div>
      ) : null}

      {layout === "oneField" && showCombined ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted/30"
            >
              {t("pages.createPresell.googleAdsUrlExpandTwoFields")}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-3">
            <TwoFieldsBody
              parts={parts}
              labelClass={labelClass}
              monoClass={monoClass}
              finalUrlBody={t("pages.createPresell.finalUrlBody")}
              copyRow={copyRow}
              step1={t("pages.createPresell.googleAdsUrlStep1")}
              step2={t("pages.createPresell.googleAdsUrlStep2")}
              finalLabel={t("pages.createPresell.finalUrlFieldLabel")}
              suffixLabel={t("pages.createPresell.finalUrlSuffixFieldLabel")}
              copyFinal={t("pages.createPresell.copyFinalUrl")}
              copySuffix={t("pages.createPresell.copyUrlSuffix")}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {layout === "twoFields" ? (
        <TwoFieldsBody
          parts={parts}
          labelClass={labelClass}
          monoClass={monoClass}
          finalUrlBody={t("pages.createPresell.finalUrlBody")}
          copyRow={copyRow}
          step1={t("pages.createPresell.googleAdsUrlStep1")}
          step2={t("pages.createPresell.googleAdsUrlStep2")}
          finalLabel={t("pages.createPresell.finalUrlFieldLabel")}
          suffixLabel={t("pages.createPresell.finalUrlSuffixFieldLabel")}
          copyFinal={t("pages.createPresell.copyFinalUrl")}
          copySuffix={t("pages.createPresell.copyUrlSuffix")}
          googleStyle
        />
      ) : null}

      {layout === "twoFields" && showCombined ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.createPresell.combinedUrlHint")}</p>
      ) : null}
    </div>
  );
}

function TwoFieldsBody({
  parts,
  labelClass,
  monoClass,
  finalUrlBody,
  copyRow,
  step1,
  step2,
  finalLabel,
  suffixLabel,
  copyFinal,
  copySuffix,
  googleStyle = false,
}: {
  parts: ReturnType<typeof buildGoogleAdsPresellUrlParts>;
  labelClass: string;
  monoClass: string;
  finalUrlBody: string;
  copyRow: (which: "final" | "suffix" | "combined", label: string, variant?: "default" | "outline") => JSX.Element;
  step1: string;
  step2: string;
  finalLabel: string;
  suffixLabel: string;
  copyFinal: string;
  copySuffix: string;
  googleStyle?: boolean;
}) {
  const stepClass = googleStyle
    ? "space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40"
    : "space-y-1.5";

  return (
    <>
      <div className={stepClass}>
        <p className={cn(labelClass, googleStyle && "text-slate-800 dark:text-slate-100")}>{step1}</p>
        <p className={cn(labelClass, "!font-normal text-muted-foreground")}>{finalLabel}</p>
        <p className={monoClass}>{parts.finalUrl}</p>
        {copyRow("final", copyFinal)}
      </div>
      {parts.finalUrlSuffix ? (
        <div className={stepClass}>
          <p className={cn(labelClass, googleStyle && "text-slate-800 dark:text-slate-100")}>{step2}</p>
          <p className={cn(labelClass, "!font-normal text-muted-foreground")}>{suffixLabel}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{finalUrlBody}</p>
          <p className={monoClass}>{parts.finalUrlSuffix}</p>
          {copyRow("suffix", copySuffix)}
        </div>
      ) : null}
    </>
  );
}