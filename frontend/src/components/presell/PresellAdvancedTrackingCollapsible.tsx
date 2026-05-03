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
                Multi-conta:{" "}
              </span>
              estes valores aplicam-se só a esta presell. Cada afiliado ou página tem os seus próprios IDs e scripts —
              nada é misturado entre contas.
            </p>

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
            {configSettings.countdownTimer ? (
              <div
                className={cn(
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-dashed px-3 py-2",
                  isEditor ? "border-editor-border bg-editor-panel-2/50" : "border-border/60 bg-muted/20",
                )}
              >
                <Label className={cn("text-xs shrink-0", isEditor ? "text-editor-fg" : "")}>
                  Duração do timer (minutos)
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
            <div className="space-y-2 max-w-2xl">
              <Label htmlFor={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}>
                Propagar parâmetros da URL para o hoplink
              </Label>
              <p
                className={cn(
                  "text-[10px] leading-snug",
                  isEditor ? "text-editor-fg-muted" : "text-muted-foreground",
                )}
              >
                <span className="font-mono">sub1</span>, <span className="font-mono">sub2</span> e{" "}
                <span className="font-mono">sub3</span> passam sempre para o link da oferta quando lá ainda não
                existem. Acrescenta aqui mais nomes (vírgula ou espaço): só <span className="font-mono">a-z</span>,{" "}
                <span className="font-mono">0-9</span>, <span className="font-mono">-</span> e{" "}
                <span className="font-mono">_</span>, até 32 nomes. Nunca sobrepõe o que o hoplink já define.
              </p>
              <Input
                id={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}
                placeholder="ex.: txn_id, aff_sub, ext_click_id"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Google Analytics / tag</Label>
                <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Measurement ID <span className="font-mono">G-…</span>, contentor{" "}
                  <span className="font-mono">GTM-…</span>, ou cola um <span className="font-mono">&lt;script&gt;</span>{" "}
                  completo. A app injeta no head na ordem correta.
                </p>
                <Input
                  placeholder="G-XXXXXXXX ou GTM-XXXX ou &lt;script&gt;…"
                  value={String(configSettings.googleTrackingCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, googleTrackingCode: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Conversão Google Ads (opcional)</Label>
                <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Formato <span className="font-mono">AW-123456789/AbCdEfGh</span> (copiado de Conversões em Google Ads).
                  Combinado com o campo acima, dispara <span className="font-mono">gtag('event','conversion')</span>.
                </p>
                <Input
                  placeholder="AW-123456789/AbCdEfGh"
                  value={String(configSettings.googleConversionEvent ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, googleConversionEvent: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Pixel Facebook (Meta)</Label>
                <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Só dígitos (Gestor de eventos → Pixel). O PageView dispara na carga; opcionalmente um evento extra
                  abaixo.
                </p>
                <Input
                  placeholder="ex.: 1234567890123456"
                  inputMode="numeric"
                  value={String(configSettings.fbPixelId ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, fbPixelId: e.target.value }))}
                  className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                />
              </div>
            </div>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor={isEditor ? "presell-fb-track-editor" : "fbTrackName"}>
                Nome do evento Meta (opcional)
              </Label>
              <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                Se preencheres, dispara <span className="font-mono">trackCustom</span> com este nome após o PageView.
              </p>
              <Input
                id={isEditor ? "presell-fb-track-editor" : "fbTrackName"}
                placeholder="ex.: Lead ou Subscribe"
                value={String(configSettings.fbTrackName ?? "")}
                onChange={(e) => setConfigSettings((p) => ({ ...p, fbTrackName: e.target.value }))}
                className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
              />
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

              <div
                className={cn(
                  "rounded-xl border px-3 py-3 space-y-2",
                  isEditor ? "border-editor-accent/40 bg-editor-panel-2/80" : "border-primary/25 bg-muted/20",
                )}
              >
                <Label className={cn("text-sm", isEditor ? "text-editor-fg" : "")}>
                  Script de rastreamento de conversões (opcional)
                </Label>
                <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Cola aqui o snippet da rede (Google Ads, etiqueta global gtag, etc.). Na página publicada é injetado no{" "}
                  <span className="font-mono text-[11px]">&lt;head&gt;</span>{" "}
                  <span className="font-medium">antes</span> do campo «Código no &lt;head&gt;», para respeitar a ordem
                  habitual de medição de conversões.
                </p>
                <Textarea
                  rows={4}
                  placeholder={`<!-- Ex.: evento de conversão Google Ads -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-…"></script>\n<script>…</script>`}
                  value={String(configSettings.conversionTrackingScript ?? "")}
                  onChange={(e) =>
                    setConfigSettings((p) => ({ ...p, conversionTrackingScript: e.target.value }))
                  }
                  className={cn(
                    "font-mono text-xs min-h-[5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                  id={isEditor ? "presell-conversion-head-editor" : "conversionTrackingScript"}
                />
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
