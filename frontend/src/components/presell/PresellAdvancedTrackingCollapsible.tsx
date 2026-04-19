import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";

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
  triggerLabel = "Opcional: configurações e rastreamento",
}: Props) {
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
            {triggerLabel}
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
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Popup de saída
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Ao tentar sair da página
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
                  Contagem regressiva
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Urgência com timer
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.countdownTimer)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, countdownTimer: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Prova social
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Notificações de compras
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.socialProof)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, socialProof: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Google Analytics / tag</Label>
                <Input
                  placeholder="ID ou snippet curto"
                  value={String(configSettings.googleTrackingCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, googleTrackingCode: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Conversão Google Ads (opcional)</Label>
                <Input
                  placeholder="AW-…/…"
                  value={String(configSettings.googleConversionEvent ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, googleConversionEvent: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Pixel Facebook</Label>
                <Input
                  placeholder="ID do pixel"
                  value={String(configSettings.fbPixelId ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, fbPixelId: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
            </div>

            <div className={cn("space-y-4 border-t pt-6", isEditor ? "border-editor-border" : "border-border/50")}>
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Scripts na página pública
                </p>
                <p className={cn("text-xs mt-1", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  O script Clickora da conta é aplicado ao <span className="opacity-90">head</span> ao guardar. Podes
                  acrescentar outros scripts (pixels de anúncios, ferramentas de terceiros). Executam na presell publicada em{" "}
                  <span className="opacity-90">&lt;head&gt;</span>, início do corpo e rodapé.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm">Script Clickora (rastreamento)</Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    O mesmo valor que em «Código no &lt;head&gt;» ao guardar (<span className="font-mono text-[11px]">data-id</span> = o teu
                    utilizador).
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
                        aria-label="Script de rastreamento Clickora"
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
                          toast.success("Script copiado.");
                        }}
                      >
                        {copiedTrackingScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTrackingScript ? "Copiado" : "Copiar script"}
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
                      Inicia sessão para gerar o teu script de rastreamento.
                    </p>
                  )}
                </div>

                <div className={cn("space-y-2 min-w-0", !isEditor && "lg:border-l lg:border-border/50 lg:pl-8")}>
                  <Label htmlFor={isEditor ? "presell-adv-head-editor" : "headerCode"} className="text-sm">
                    Código no &lt;head&gt;
                  </Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    O Clickora é antecipado automaticamente; edita ou acrescenta outros scripts (pixels, ferramentas de
                    terceiros, etc.) se precisares.
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
                <Label htmlFor={isEditor ? "presell-adv-body-editor" : "bodyCode"}>Código no início do conteúdo</Label>
                <Textarea
                  id={isEditor ? "presell-adv-body-editor" : "bodyCode"}
                  rows={2}
                  placeholder="Opcional — após &lt;body&gt;"
                  value={String(configSettings.bodyCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, bodyCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[3.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-foot-editor" : "footerCode"}>Código no rodapé (fim da página)</Label>
                <Textarea
                  id={isEditor ? "presell-adv-foot-editor" : "footerCode"}
                  rows={3}
                  placeholder="Opcional — antes de </body>"
                  value={String(configSettings.footerCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, footerCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[4.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-css-editor" : "customCss"}>CSS personalizado (opcional)</Label>
                <Textarea
                  id={isEditor ? "presell-adv-css-editor" : "customCss"}
                  rows={3}
                  placeholder=".minha-classe { ... }"
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
