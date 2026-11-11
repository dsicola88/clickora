import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { cn } from "@/lib/utils";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellProfessionalDocStrip } from "@/components/presell/PresellProfessionalDocStrip";

type Surface = "dashboard" | "editor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configSettings: PresellConfigSettings;
  setConfigSettings: React.Dispatch<React.SetStateAction<PresellConfigSettings>>;
  trackingEmbedScript: string;
  surface?: Surface;
  /** Texto do trigger (ex.: mesma etiqueta no dashboard e no editor manual). */
  triggerLabel?: string;
};

/**
 * Bloco «Opcional: configurações e rastreamento» partilhado entre
 * criação automática (`PresellDashboard`) e editor manual (`PresellManualBuilderPage`).
 */
export function PresellAdvancedTrackingCollapsible({
  open,
  onOpenChange,
  configSettings,
  setConfigSettings,
  trackingEmbedScript,
  surface = "dashboard",
  triggerLabel,
}: Props) {
  const { t } = useAppLocale();
  const resolvedTrigger = triggerLabel ?? t("pages.presells.advanced.triggerDefault");
  const [copiedTrackingScript, setCopiedTrackingScript] = useState(false);
  const isEditor = surface === "editor";

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-4 sm:px-6 border transition-colors cursor-pointer text-left min-w-0",
            isEditor
              ? "bg-editor-panel-2 border-editor-border text-editor-fg hover:bg-editor-border/80"
              : "bg-card border-border/50 hover:bg-muted/30 text-card-foreground",
          )}
        >
          <span className={cn("font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
            {resolvedTrigger}
          </span>
          {open ? (
            <ChevronDown className={cn("h-4 w-4 shrink-0", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")} />
          ) : (
            <ChevronRight className={cn("h-4 w-4 shrink-0", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={cn(
              "rounded-b-xl px-4 py-4 sm:px-6 border-x border-b space-y-6 w-full min-w-0",
              isEditor
                ? "bg-editor-panel border-editor-border text-editor-fg"
                : "bg-card border-border/50 text-card-foreground",
            )}
          >
            <PresellProfessionalDocStrip isEditor={isEditor} />

            <p
              className={cn(
                "text-[11px] leading-relaxed rounded-md border px-2.5 py-2",
                isEditor
                  ? "border-editor-border/80 bg-editor-bg/50 text-editor-fg-muted"
                  : "border-border/60 bg-muted/30 text-muted-foreground",
              )}
            >
              <span className={cn("font-medium", isEditor ? "text-editor-fg" : "text-foreground")}>
                {t("pages.presells.advanced.multiAccountLead")}{" "}
              </span>
              {t("pages.presells.advanced.multiAccountBody")}
            </p>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  {t("pages.presells.advanced.exitPopup")}
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {t("pages.presells.advanced.exitPopupHint")}
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.exitPopup)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, exitPopup: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  {t("pages.presells.advanced.countdown")}
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {t("pages.presells.advanced.countdownHint")}
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.countdownTimer)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, countdownTimer: v }))}
              />
            </div>
            {configSettings.countdownTimer ? (
              <div
                className={cn(
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-dashed px-3 py-2",
                  isEditor ? "border-editor-border bg-editor-panel-2/50" : "border-border/60 bg-muted/20",
                )}
              >
                <Label className={cn("text-xs shrink-0", isEditor ? "text-editor-fg" : "")}>
                  {t("pages.presells.advanced.countdownMinutes")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  className={cn("max-w-[8rem] sm:max-w-[10rem]", isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "")}
                  value={String(configSettings.countdownDurationMinutes ?? "15")}
                  onChange={(e) =>
                    setConfigSettings((p) => ({ ...p, countdownDurationMinutes: e.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  {t("pages.presells.advanced.socialProof")}
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {t("pages.presells.advanced.socialProofHint")}
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.socialProof)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, socialProof: v }))}
              />
            </div>
            <div className="space-y-2 max-w-2xl">
              <Label htmlFor={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}>
                {t("pages.presells.advanced.forwardLabel")}
              </Label>
              <p
                className={cn(
                  "text-[10px] leading-snug",
                  isEditor ? "text-editor-fg-muted" : "text-muted-foreground",
                )}
              >
                {t("pages.presells.advanced.forwardHint")}
              </p>
              <Input
                id={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}
                placeholder={t("pages.presells.advanced.forwardPlaceholder")}
                value={String(configSettings.offerQueryForwardAllowlist ?? "")}
                onChange={(e) =>
                  setConfigSettings((p) => ({ ...p, offerQueryForwardAllowlist: e.target.value }))
                }
                className={cn(
                  "font-mono text-sm",
                  isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                )}
              />
            </div>
            {/* Pixels de anúncios — automático (IDs) ou manual (colar script) */}
            <div
              className={cn(
                "space-y-4 rounded-xl border px-3 py-3 sm:px-4",
                isEditor ? "border-editor-accent/35 bg-editor-panel-2/50" : "border-primary/20 bg-primary/[0.03]",
              )}
            >
              <div>
                <p className={cn("text-sm font-semibold", isEditor ? "text-editor-fg" : "text-foreground")}>
                  {t("pages.presells.advanced.pixelsTitle")}
                </p>
                <p className={cn("mt-1 text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {t("pages.presells.advanced.pixelsHint")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "auto" as const, label: t("pages.presells.advanced.modeAuto") },
                    { id: "manual" as const, label: t("pages.presells.advanced.modeManual") },
                  ]
                ).map((opt) => {
                  const active =
                    String(configSettings.adPixelsMode ?? "auto").toLowerCase() === opt.id ||
                    (!configSettings.adPixelsMode && opt.id === "auto");
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const prev = String(configSettings.adPixelsMode ?? "auto").toLowerCase();
                        if (prev === opt.id) return;
                        if (opt.id === "manual") {
                          const hasIds = Boolean(
                            String(configSettings.fbPixelId ?? "").trim() ||
                              String(configSettings.tiktokPixelId ?? "").trim() ||
                              String(configSettings.bingUetTagId ?? "").trim() ||
                              String(configSettings.googleTrackingCode ?? "").trim() ||
                              String(configSettings.googleConversionEvent ?? "").trim(),
                          );
                          const hasScript = Boolean(
                            String(configSettings.conversionTrackingScript ?? "").trim(),
                          );
                          if (hasIds && !hasScript) {
                            toast.warning(t("pages.presells.advanced.manualNoScriptTitle"), {
                              description: t("pages.presells.advanced.manualNoScriptDesc"),
                            });
                          } else {
                            toast.message(t("pages.presells.advanced.manualModeTitle"), {
                              description: t("pages.presells.advanced.manualModeDesc"),
                            });
                          }
                        } else {
                          toast.message(t("pages.presells.advanced.autoModeTitle"), {
                            description: t("pages.presells.advanced.autoModeDesc"),
                          });
                        }
                        setConfigSettings((p) => ({ ...p, adPixelsMode: opt.id }));
                      }}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? isEditor
                            ? "border-editor-accent bg-editor-accent/15 text-editor-fg"
                            : "border-primary bg-primary/10 text-foreground"
                          : isEditor
                            ? "border-editor-border bg-editor-bg text-editor-fg-muted hover:text-editor-fg"
                            : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {String(configSettings.adPixelsMode ?? "auto").toLowerCase() !== "manual" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <Label>{t("pages.presells.advanced.metaPixel")}</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.metaPixelHint")}
                      </p>
                      <Input
                        placeholder={t("pages.presells.advanced.metaPixelPlaceholder")}
                        inputMode="numeric"
                        value={String(configSettings.fbPixelId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, fbPixelId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor={isEditor ? "presell-fb-track-editor" : "fbTrackName"}>
                        {t("pages.presells.advanced.metaEvent")}
                      </Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.metaEventHint")}
                      </p>
                      <Input
                        id={isEditor ? "presell-fb-track-editor" : "fbTrackName"}
                        placeholder={t("pages.presells.advanced.metaEventPlaceholder")}
                        value={String(configSettings.fbTrackName ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, fbTrackName: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>{t("pages.presells.advanced.tiktokPixel")}</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.tiktokHint")}
                      </p>
                      <Input
                        placeholder={t("pages.presells.advanced.tiktokPlaceholder")}
                        value={String(configSettings.tiktokPixelId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, tiktokPixelId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>{t("pages.presells.advanced.bingPixel")}</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.bingHint")}
                      </p>
                      <Input
                        placeholder={t("pages.presells.advanced.bingPlaceholder")}
                        inputMode="numeric"
                        value={String(configSettings.bingUetTagId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, bingUetTagId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>{t("pages.presells.advanced.googleTag")}</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.googleTagHint")}
                      </p>
                      <Input
                        placeholder={t("pages.presells.advanced.googleTagPlaceholder")}
                        value={String(configSettings.googleTrackingCode ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, googleTrackingCode: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>{t("pages.presells.advanced.googleConv")}</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        {t("pages.presells.advanced.googleConvHint")}
                      </p>
                      <Input
                        placeholder={t("pages.presells.advanced.googleConvPlaceholder")}
                        value={String(configSettings.googleConversionEvent ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, googleConversionEvent: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("pages.presells.advanced.fullScript")}</Label>
                  <p className={cn("text-[10px] leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    {t("pages.presells.advanced.fullScriptHint")}
                  </p>
                  <Textarea
                    rows={7}
                    placeholder={t("pages.presells.advanced.fullScriptPlaceholder")}
                    value={String(configSettings.conversionTrackingScript ?? "")}
                    onChange={(e) =>
                      setConfigSettings((p) => ({ ...p, conversionTrackingScript: e.target.value }))
                    }
                    className={cn(
                      "font-mono text-xs min-h-[8rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                  />
                </div>
              )}
            </div>

            <div
              className={cn(
                "space-y-4 rounded-xl border px-3 py-3",
                isEditor ? "border-editor-border bg-editor-panel-2/60" : "border-border/60 bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                    {t("pages.presells.advanced.cloakTitle")}
                  </p>
                  <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    {t("pages.presells.advanced.cloakHint")}
                  </p>
                </div>
                <Switch
                  checked={Boolean(configSettings.enterpriseCloak)}
                  onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, enterpriseCloak: v }))}
                />
              </div>
              {configSettings.enterpriseCloak ? (
                <div className="space-y-3">
                  <p
                    className={cn(
                      "text-[11px] leading-relaxed rounded-md border px-2.5 py-2",
                      isEditor
                        ? "border-amber-500/40 bg-amber-500/10 text-editor-fg"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                    )}
                  >
                    {t("pages.presells.advanced.cloakWarn")}
                  </p>
                  <div className="space-y-2">
                    <Label>{t("pages.presells.advanced.cloakSafeTitle")}</Label>
                    <Input
                      placeholder={t("pages.presells.advanced.cloakSafeTitlePlaceholder")}
                      value={String(configSettings.cloakSafeTitle ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakSafeTitle: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pages.presells.advanced.cloakSafeBody")}</Label>
                    <Textarea
                      rows={3}
                      placeholder={t("pages.presells.advanced.cloakSafeBodyPlaceholder")}
                      value={String(configSettings.cloakSafeBody ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakSafeBody: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pages.presells.advanced.cloakCountries")}</Label>
                    <Input
                      placeholder={t("pages.presells.advanced.cloakCountriesPlaceholder")}
                      value={String(configSettings.cloakGeoDeny ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakGeoDeny: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                    <p className={cn("text-[10px]", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                      {t("pages.presells.advanced.cloakCountriesHint")}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={cn("space-y-4 border-t pt-6", isEditor ? "border-editor-border" : "border-border/50")}>
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  {t("pages.presells.advanced.scriptsTitle")}
                </p>
                <p className={cn("text-xs mt-1", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {t("pages.presells.advanced.scriptsHint")}
                </p>
              </div>

              {String(configSettings.adPixelsMode ?? "auto").toLowerCase() !== "manual" ? (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-3 space-y-2",
                    isEditor ? "border-editor-accent/40 bg-editor-panel-2/80" : "border-primary/25 bg-muted/20",
                  )}
                >
                  <Label className={cn("text-sm", isEditor ? "text-editor-fg" : "")}>
                    {t("pages.presells.advanced.extraConv")}
                  </Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    {t("pages.presells.advanced.extraConvHint")}
                  </p>
                  <Textarea
                    rows={3}
                    placeholder={t("pages.presells.advanced.extraConvPlaceholder")}
                    value={String(configSettings.conversionTrackingScript ?? "")}
                    onChange={(e) =>
                      setConfigSettings((p) => ({ ...p, conversionTrackingScript: e.target.value }))
                    }
                    className={cn(
                      "font-mono text-xs min-h-[4rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                    id={isEditor ? "presell-conversion-head-editor" : "conversionTrackingScript"}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm">{t("pages.presells.advanced.clickoraScript")}</Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    {t("pages.presells.advanced.clickoraScriptHint")}
                  </p>
                  {trackingEmbedScript ? (
                    <div className="space-y-2">
                      <Textarea
                        readOnly
                        rows={3}
                        value={trackingEmbedScript}
                        className={cn(
                          "font-mono text-xs min-h-[4.5rem]",
                          isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "bg-muted/30 border-border/80",
                        )}
                        aria-label={t("pages.presells.advanced.clickoraScriptAria")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("gap-2", isEditor && "border-editor-border bg-editor-panel-2 text-editor-fg")}
                        onClick={() => {
                          void navigator.clipboard.writeText(trackingEmbedScript);
                          setCopiedTrackingScript(true);
                          setTimeout(() => setCopiedTrackingScript(false), 2000);
                          toast.success(t("pages.presells.advanced.scriptCopied"));
                        }}
                      >
                        {copiedTrackingScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTrackingScript ? t("common.copied") : t("pages.presells.advanced.copyScript")}
                      </Button>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        "text-xs rounded-lg border px-3 py-2",
                        isEditor
                          ? "border-editor-border bg-editor-bg text-editor-fg-muted"
                          : "border-dashed border-border/70 bg-muted/20 text-muted-foreground",
                      )}
                    >
                      {t("pages.presells.advanced.signInScript")}
                    </p>
                  )}
                </div>

                <div className={cn("space-y-2 min-w-0", !isEditor && "lg:border-l lg:border-border/50 lg:pl-8")}>
                  <Label htmlFor={isEditor ? "presell-adv-head-editor" : "headerCode"} className="text-sm">
                    {t("pages.presells.advanced.headCode")}
                  </Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    {t("pages.presells.advanced.headCodeHint")}
                  </p>
                  <Textarea
                    id={isEditor ? "presell-adv-head-editor" : "headerCode"}
                    rows={3}
                    placeholder={`<script src="…/track/v2/clickora.min.js" data-id="…"></script>`}
                    value={String(configSettings.headerCode ?? "")}
                    onChange={(e) => setConfigSettings((p) => ({ ...p, headerCode: e.target.value }))}
                    className={cn(
                      "font-mono text-xs min-h-[4.5rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-body-editor" : "bodyCode"}>{t("pages.presells.advanced.bodyCode")}</Label>
                <Textarea
                  id={isEditor ? "presell-adv-body-editor" : "bodyCode"}
                  rows={2}
                  placeholder={t("pages.presells.advanced.bodyPlaceholder")}
                  value={String(configSettings.bodyCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, bodyCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[3.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-foot-editor" : "footerCode"}>{t("pages.presells.advanced.footerCode")}</Label>
                <Textarea
                  id={isEditor ? "presell-adv-foot-editor" : "footerCode"}
                  rows={3}
                  placeholder={t("pages.presells.advanced.footerPlaceholder")}
                  value={String(configSettings.footerCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, footerCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[4.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-css-editor" : "customCss"}>{t("pages.presells.advanced.customCss")}</Label>
                <Textarea
                  id={isEditor ? "presell-adv-css-editor" : "customCss"}
                  rows={3}
                  placeholder={t("pages.presells.advanced.customCssPlaceholder")}
                  value={String(configSettings.customCss ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, customCss: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[3.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
