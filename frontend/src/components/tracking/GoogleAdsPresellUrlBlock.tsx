import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGoogleAdsPresellUrlParts } from "@/lib/googleAdsPresellUrl";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

/**
 * UI estilo pré-21/11: um único URL para colar no campo «URL final» do Google Ads
 * (lander + UTMs). O sufixo separado continua disponível na lib para integrações/API.
 */
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
  const [copiedBare, setCopiedBare] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const bareUrl = parts.finalUrl;
  const fullUrl = parts.finalUrlSuffix ? parts.combinedTrackingUrl : parts.finalUrl;
  const pathHint = displayPathHint(parts.finalUrl);

  const labelClass = cn(
    "text-[11px] font-medium",
    editorChrome ? "text-editor-fg-muted" : "text-muted-foreground",
  );
  const monoClass = cn(
    "break-all font-mono text-[11px] sm:text-xs leading-relaxed select-all rounded-lg border px-3 py-2.5",
    editorChrome ? "border-editor-border/60 bg-editor-panel text-editor-fg/90" : "border-border/60 bg-background text-foreground/90",
  );

  if (!bareUrl) return null;

  const copyBare = async () => {
    if (!bareUrl) return;
    await navigator.clipboard.writeText(bareUrl);
    setCopiedBare(true);
    toast.success(t("pages.createPresell.copyBareUrlDone"));
    setTimeout(() => setCopiedBare(false), 2000);
  };

  const copyFull = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedFull(true);
    toast.success(t("pages.createPresell.copyCombinedUrlDone"));
    setTimeout(() => setCopiedFull(false), 2000);
  };

  return (
    <div className={cn("space-y-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3", className)}>
      <p className={cn(labelClass, "text-foreground font-semibold")}>{t("pages.createPresell.finalUrlTitle")}</p>
      {pathHint ? (
        <p className="text-[11px] text-muted-foreground">
          {t("pages.createPresell.googleAdsUrlDisplayHint")}{" "}
          <span className="font-medium text-foreground/80">{pathHint}</span>
        </p>
      ) : null}

      <div className="space-y-2">
        <p className={labelClass}>{t("pages.createPresell.barePresellUrlLabel")}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.createPresell.barePresellUrlHint")}</p>
        <p className={monoClass}>{bareUrl}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5", editorChrome && "border-editor-border bg-editor-panel text-editor-fg")}
          onClick={() => void copyBare()}
        >
          {copiedBare ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t("pages.createPresell.copyBareUrl")}
        </Button>
      </div>

      <div className="space-y-2 border-t border-primary/15 pt-3">
        <p className={labelClass}>{t("pages.createPresell.fullTrackingUrlLabel")}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.createPresell.combinedUrlHint")}</p>
        <p className={monoClass}>{fullUrl}</p>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5", editorChrome && "border-editor-border bg-editor-panel text-editor-fg")}
          onClick={() => void copyFull()}
        >
          {copiedFull ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t("pages.createPresell.copyCombinedUrl")}
        </Button>
      </div>
    </div>
  );
}