import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGoogleAdsPresellUrlParts } from "@/lib/googleAdsPresellUrl";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [copied, setCopied] = useState<"final" | "suffix" | null>(null);

  const copy = async (which: "final" | "suffix") => {
    const text = which === "final" ? parts.finalUrl : parts.finalUrlSuffix;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success(
      which === "final" ? t("pages.createPresell.copyFinalUrlDone") : t("pages.createPresell.copySuffixDone"),
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

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <p className={labelClass}>{t("pages.createPresell.finalUrlFieldLabel")}</p>
        <p className={monoClass}>{parts.finalUrl}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5", editorChrome && "border-editor-border bg-editor-panel text-editor-fg")}
          onClick={() => void copy("final")}
        >
          {copied === "final" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t("pages.createPresell.copyFinalUrl")}
        </Button>
      </div>
      {parts.finalUrlSuffix ? (
        <div className="space-y-1.5">
          <p className={labelClass}>{t("pages.createPresell.finalUrlSuffixFieldLabel")}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.createPresell.finalUrlBody")}</p>
          <p className={monoClass}>{parts.finalUrlSuffix}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn("gap-1.5", editorChrome && "border-editor-border bg-editor-panel text-editor-fg")}
            onClick={() => void copy("suffix")}
          >
            {copied === "suffix" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {t("pages.createPresell.copyUrlSuffix")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}